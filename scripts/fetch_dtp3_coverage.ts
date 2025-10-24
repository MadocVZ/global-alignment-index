import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { writeJson } from './lib/io.ts';

const START_YEAR = 1990;
const ISO3 = /^[A-Z]{3}$/;
const DENY = new Set([
  'WLD',
  'OED',
  'ECS',
  'EAS',
  'EAP',
  'ECA',
  'EUU',
  'EMU',
  'LCN',
  'LAC',
  'MEA',
  'MNA',
  'NAC',
  'SAS',
  'SSA',
  'SSF',
  'HIC',
  'INX',
  'LIC',
  'LMC',
  'LMY',
  'MIC',
  'UMC',
]);

const COVERAGE_SERIES = 'SH.IMM.IDPT';
const API_URL = `https://api.worldbank.org/v2/country/all/indicator/${COVERAGE_SERIES}?format=json&per_page=20000`;
const CACHE_PATH = resolve(process.cwd(), 'scripts/cache/dtp3_wdi.csv');
const POP_PATH = resolve(process.cwd(), 'data/raw/wld_population.json');
const POP_FALLBACK_CSV = resolve(process.cwd(), 'data/raw/pop_by_country.csv');
const OUTPUT_DATA = resolve(process.cwd(), 'public/data/dtp3_coverage.json');
const OUTPUT_LOG = resolve(process.cwd(), 'scripts/logs/dtp3_coverage.log.json');

const RANGE_MIN = 60;
const RANGE_MAX = 90;

const PUBLISHED_KEY_SIGNATURE = JSON.stringify(['value', 'year']);

const USER_AGENT = 'GAI-dtp3-coverage/1.0';

export type CoverageRow = { iso3: string; year: number; coverage: number };
export type PopRow = { iso3: string; year: number; population: number };
export type GlobalYear = { year: number; value: number };

// Keep PublishedPoint keys in sync with scripts/validate-datasets.cjs (global series expects ["year","value"]).
type PublishedPoint = { year: number; value: number };
const round1 = (n: number) => Math.round(n * 10) / 10;

type FetchResult = { rows: CoverageRow[]; source: 'wdi' | 'cache' };

type PopMaps = {
  byYear: Map<number, Map<string, number>>;
  totals: Map<number, number>;
};

type GaisumYear = {
  year: number;
  pop_share: number;
  coverage_ok: boolean;
  value_percent?: number;
  n_iso_joined?: number;
  n_iso_universe?: number;
};

type GaisumLog = {
  id: 'dtp3_coverage';
  rows: number;
  years: { min: number; max: number };
  global: {
    min: number;
    max: number;
    latest: { year: number; value: number };
  };
  coverage: Array<{
    year: number;
    pop_share: number;
    coverage_ok: boolean;
    value_percent?: number;
    n_iso_joined?: number;
    n_iso_universe?: number;
  }>;
  dropped_out_of_bounds: number;
  range_warning: boolean;
  continuity_warning: boolean;
  stale: boolean;
  schema: 'year,value(%)';
  source: 'wdi' | 'cache';
  ts: string;
};

async function main(): Promise<void> {
  console.log('[dtp3] start fetch');
  const { rows: rawRows, source } = await fetchCoverage();
  console.log(`[dtp3] fetched ${rawRows.length} rows from ${source}`);

  const population = await loadPopulation();
  console.log(`[dtp3] population years available: ${population.byYear.size}`);

  let droppedOutOfBounds = 0;
  const filtered: CoverageRow[] = [];

  for (const row of rawRows) {
    if (!isCountry(row.iso3)) continue;
    if (!Number.isInteger(row.year) || row.year < START_YEAR) continue;
    if (!Number.isFinite(row.coverage)) continue;
    if (row.coverage < 0 || row.coverage > 100) {
      droppedOutOfBounds++;
      continue;
    }
    filtered.push({ iso3: row.iso3, year: row.year, coverage: row.coverage });
  }

  if (!filtered.length) {
    throw new Error('[dtp3] no coverage rows after filtering');
  }

  const byYear = groupByYear(filtered);
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  const maxYear = years[years.length - 1];

  const published: PublishedPoint[] = [];
  const rawPublished: GlobalYear[] = [];
  const gaisumCoverage: GaisumYear[] = [];
  const yearDiagnostics = new Map<
    number,
    { popShare: number; weightTotal: number; nIsoJoined: number; nIsoUniverse: number }
  >();
  let continuityWarning = false;

  const candidateMax = Math.max(maxYear, START_YEAR);
  for (let year = START_YEAR; year <= candidateMax; year++) {
    const rows = byYear.get(year);
    if (!rows || rows.length === 0) {
      if (year <= maxYear) {
        continuityWarning = true;
      }
      break;
    }

    const { publishedYear, coverageInfo } = computeYear(rows, population, year);
    gaisumCoverage.push(coverageInfo);

    if (!publishedYear) {
      continuityWarning = true;
      break;
    }

    const roundedValue = round1(publishedYear.meanPercent);
    published.push({
      year: publishedYear.year,
      value: roundedValue,
    });
    rawPublished.push({ year: publishedYear.year, value: publishedYear.meanPercent });
    yearDiagnostics.set(year, {
      popShare: coverageInfo.pop_share,
      weightTotal: publishedYear.weightTotal,
      nIsoJoined: publishedYear.nIsoJoined,
      nIsoUniverse: publishedYear.nIsoUniverse,
    });
  }

  if (!published.length) {
    throw new Error('[dtp3] no published years');
  }

  const values = rawPublished.map((point) => point.value);
  const globalMin = Math.min(...values);
  const globalMax = Math.max(...values);
  const latestPoint = rawPublished[rawPublished.length - 1];
  const currentYear = new Date().getUTCFullYear();

  const rangeWarning = globalMin < RANGE_MIN || globalMax > RANGE_MAX;
  const stale = latestPoint.year < currentYear - 2;

  validateOutputSeries(published);
  assertWeights(yearDiagnostics);
  assertLatestYear(byYear, population, published[published.length - 1].year);

  const log: GaisumLog = {
    id: 'dtp3_coverage',
    rows: filtered.length,
    years: { min: published[0].year, max: published[published.length - 1].year },
    global: {
      min: Number(globalMin.toFixed(2)),
      max: Number(globalMax.toFixed(2)),
      latest: { year: latestPoint.year, value: Number(latestPoint.value.toFixed(2)) },
    },
    coverage: gaisumCoverage.map((item) => {
      const entry: {
        year: number;
        pop_share: number;
        coverage_ok: boolean;
        value_percent?: number;
        n_iso_joined?: number;
        n_iso_universe?: number;
      } = {
        year: item.year,
        pop_share: Number(item.pop_share.toFixed(3)),
        coverage_ok: item.coverage_ok,
      };
      if (typeof item.value_percent === 'number') {
        entry.value_percent = Number(item.value_percent.toFixed(2));
      }
      if (typeof item.n_iso_joined === 'number') {
        entry.n_iso_joined = item.n_iso_joined;
      }
      if (typeof item.n_iso_universe === 'number') {
        entry.n_iso_universe = item.n_iso_universe;
      }
      return entry;
    }),
    dropped_out_of_bounds: droppedOutOfBounds,
    range_warning: rangeWarning,
    continuity_warning: continuityWarning,
    stale,
    schema: 'year,value(%)',
    source,
    ts: new Date().toISOString(),
  };

  assertSchema(published);
  await writeFile(OUTPUT_DATA, JSON.stringify(published, null, 2));
  await writeJson(OUTPUT_LOG, log);

  console.log(`[dtp3] wrote ${published.length} years to ${OUTPUT_DATA}`);
  console.log(`[dtp3] GAISUM min=${log.global.min} max=${log.global.max} latest=${log.global.latest.value}@${log.global.latest.year}`);
  console.log(`[dtp3] pop coverage shares: ${log.coverage.map((c) => `${c.year}:${c.pop_share.toFixed(3)}`).join(', ')}`);
}

function isCountry(code: string | undefined): code is string {
  if (!code) return false;
  const trimmed = code.trim().toUpperCase();
  return ISO3.test(trimmed) && !DENY.has(trimmed);
}

async function fetchCoverage(): Promise<FetchResult> {
  try {
    const rows = await fetchFromApi();
    return { rows, source: 'wdi' };
  } catch (error) {
    console.warn(`[dtp3] API fetch failed: ${(error as Error).message}`);
    const cached = await loadFromCache();
    if (!cached.length) {
      throw new Error('[dtp3] no cache available after API failure');
    }
    return { rows: cached, source: 'cache' };
  }
}

async function fetchFromApi(): Promise<CoverageRow[]> {
  const rows: CoverageRow[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${API_URL}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const snippet = await res.text().catch(() => '');
      throw new Error(`failed ${res.status} ${res.statusText} ${snippet.slice(0, 120)}`);
    }
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
      throw new Error('unexpected API payload');
    }
    const meta = json[0] as { pages?: number };
    const data = json[1] as any[];
    totalPages = Number(meta?.pages ?? 1);
    console.log(`[dtp3] page ${page}/${totalPages} rows=${data.length}`);
    for (const item of data) {
      const iso3 = typeof item?.countryiso3code === 'string' ? item.countryiso3code.trim() : '';
      const year = Number(item?.date);
      const value = item?.value;
      const coverage = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(year) || !Number.isFinite(coverage)) continue;
      rows.push({ iso3, year, coverage });
    }
    page += 1;
  }

  return rows;
}

async function loadFromCache(): Promise<CoverageRow[]> {
  if (!existsSync(CACHE_PATH)) {
    return [];
  }
  const text = await readFile(CACHE_PATH, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows: CoverageRow[] = [];
  for (const line of lines) {
    const [iso3, yearStr, valueStr] = parseCsvLine(line);
    const iso = iso3?.trim().toUpperCase();
    const year = Number(yearStr);
    const coverage = Number(valueStr);
    if (!iso || !Number.isInteger(year) || !Number.isFinite(coverage)) continue;
    rows.push({ iso3: iso, year, coverage });
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

async function loadPopulation(): Promise<PopMaps> {
  const text = await readFile(POP_PATH, 'utf8');
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('[dtp3] population file must be an array');
  }
  const byYear = new Map<number, Map<string, number>>();
  const totals = new Map<number, number>();

  let isoEntries = 0;

  for (const entry of parsed as Array<Record<string, unknown>>) {
    const iso3 = typeof entry.iso3 === 'string' ? entry.iso3.trim().toUpperCase() : undefined;
    const year = Number(entry.year ?? entry?.Year);
    const population = Number(entry.population ?? entry.pop ?? entry?.Population);

    if (iso3 && ISO3.test(iso3)) {
      if (!Number.isInteger(year)) continue;
      if (!Number.isFinite(population) || population <= 0) continue;
      if (!byYear.has(year)) {
        byYear.set(year, new Map());
      }
      byYear.get(year)!.set(iso3, population);
      isoEntries += 1;
    } else if (Number.isInteger(year) && Number.isFinite(population) && population > 0) {
      totals.set(year, population);
    }
  }

  if (isoEntries === 0) {
    console.warn('[dtp3] population file missing iso3 entries; attempting CSV fallback');
    return loadPopulationFromCsv();
  }

  if (!totals.size) {
    for (const [year, isoMap] of byYear.entries()) {
      let sum = 0;
      for (const pop of isoMap.values()) {
        sum += pop;
      }
      totals.set(year, sum);
    }
  }

  return { byYear, totals };
}

async function loadPopulationFromCsv(): Promise<PopMaps> {
  if (!existsSync(POP_FALLBACK_CSV)) {
    throw new Error('[dtp3] population CSV fallback missing');
  }
  const text = await readFile(POP_FALLBACK_CSV, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error('[dtp3] population CSV has no data rows');
  }
  const headerCells = parseCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const isoIndex = headerCells.findIndex((cell) => cell === 'iso3' || cell === 'country_code' || cell === 'code');
  const yearIndex = headerCells.findIndex((cell) => cell === 'year');
  const popIndex = headerCells.findIndex((cell) => cell.includes('population'));
  if (isoIndex === -1 || yearIndex === -1 || popIndex === -1) {
    throw new Error('[dtp3] population CSV missing required columns');
  }

  const byYear = new Map<number, Map<string, number>>();
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const iso3 = cells[isoIndex]?.trim().toUpperCase();
    const year = Number(cells[yearIndex]);
    const population = Number(cells[popIndex]);
    if (!isCountry(iso3)) continue;
    if (!Number.isInteger(year)) continue;
    if (!Number.isFinite(population) || population <= 0) continue;
    if (!byYear.has(year)) {
      byYear.set(year, new Map());
    }
    byYear.get(year)!.set(iso3, population);
  }
  if (!byYear.size) {
    throw new Error('[dtp3] population CSV produced no rows');
  }

  const totals = new Map<number, number>();
  for (const [year, isoMap] of byYear.entries()) {
    let sum = 0;
    for (const pop of isoMap.values()) {
      sum += pop;
    }
    totals.set(year, sum);
  }

  return { byYear, totals };
}

function groupByYear(rows: CoverageRow[]): Map<number, CoverageRow[]> {
  const byYear = new Map<number, CoverageRow[]>();
  for (const row of rows) {
    if (!byYear.has(row.year)) {
      byYear.set(row.year, []);
    }
    byYear.get(row.year)!.push(row);
  }
  return byYear;
}

function computeYear(
  rows: CoverageRow[],
  population: PopMaps,
  year: number,
): {
  publishedYear?: {
    year: number;
    meanPercent: number;
    nIsoJoined: number;
    nIsoUniverse: number;
    weightTotal: number;
    totalPop: number;
  };
  coverageInfo: GaisumYear;
} {
  const popMap = population.byYear.get(year);
  if (!popMap) {
    return { coverageInfo: { year, pop_share: 0, coverage_ok: false } };
  }

  const totalPop = population.totals.get(year) ?? 0;
  let weightedSum = 0;
  let weightTotal = 0;
  let nIsoJoined = 0;

  for (const row of rows) {
    const pop = popMap.get(row.iso3);
    if (typeof pop !== 'number' || !Number.isFinite(pop) || pop <= 0) continue;
    weightedSum += round2(row.coverage) * pop;
    weightTotal += pop;
    nIsoJoined += 1;
  }

  if (weightTotal <= 0) {
    return { coverageInfo: { year, pop_share: 0, coverage_ok: false } };
  }

  const popShare = totalPop > 0 ? weightTotal / totalPop : 0;
  const mean = round2(weightedSum / weightTotal);

  return {
    publishedYear: {
      year,
      meanPercent: mean,
      nIsoJoined,
      nIsoUniverse: popMap.size,
      weightTotal,
      totalPop,
    },
    coverageInfo: {
      year,
      pop_share: popShare,
      coverage_ok: popShare >= 0.95,
      value_percent: mean,
      n_iso_joined: nIsoJoined,
      n_iso_universe: popMap.size,
    },
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function validateOutputSeries(series: PublishedPoint[]): void {
  if (!Array.isArray(series) || !series.length) {
    throw new Error('[dtp3] output series empty');
  }
  for (let i = 0; i < series.length; i++) {
    const point = series[i];
    if (!Number.isInteger(point.year)) {
      throw new Error(`[dtp3] invalid year at index ${i}`);
    }
    const keys = Object.keys(point).sort();
    if (JSON.stringify(keys) !== PUBLISHED_KEY_SIGNATURE) {
      throw new Error(`[dtp3] schema mismatch at year ${point.year}: ${keys.join(',')}`);
    }
    if (i > 0 && point.year !== series[i - 1].year + 1) {
      throw new Error('[dtp3] year sequence not contiguous');
    }
    if (Number.isNaN(point.value) || !Number.isFinite(point.value)) {
      throw new Error(`[dtp3] invalid value at year ${point.year}`);
    }
    if (point.value < 0 || point.value > 100) {
      throw new Error(`[dtp3] value out of range at year ${point.year}`);
    }
    const scaled = Math.round(point.value * 10);
    if (Math.abs(point.value * 10 - scaled) > 1e-6) {
      throw new Error(`[dtp3] value must have 1 decimal at year ${point.year}`);
    }
  }
}

function assertSchema(a: any[]): void {
  if (!Array.isArray(a) || a.length === 0) throw new Error('Series empty');
  for (const [i, x] of a.entries()) {
    const keys = Object.keys(x ?? {}).sort();
    if (JSON.stringify(keys) !== PUBLISHED_KEY_SIGNATURE) {
      throw new Error(`Schema fail at index ${i}: ${JSON.stringify(x)}`);
    }
  }
}

function assertWeights(
  weights: Map<number, { popShare: number; weightTotal: number; nIsoJoined: number; nIsoUniverse: number }>,
): void {
  for (const [year, info] of weights.entries()) {
    if (!(info.weightTotal > 0)) {
      throw new Error(`[dtp3] weight sum not positive for year ${year}`);
    }
    if (info.popShare < 0) {
      throw new Error(`[dtp3] negative population share at year ${year}`);
    }
    if (!Number.isInteger(info.nIsoJoined) || info.nIsoJoined <= 0) {
      throw new Error(`[dtp3] invalid joined ISO count for year ${year}`);
    }
    if (!Number.isInteger(info.nIsoUniverse) || info.nIsoUniverse < info.nIsoJoined) {
      throw new Error(`[dtp3] invalid universe ISO count for year ${year}`);
    }
  }
}

function assertLatestYear(
  byYear: Map<number, CoverageRow[]>,
  population: PopMaps,
  latestYear: number,
): void {
  let maxValidYear: number | undefined;
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  for (const year of years) {
    if (year < START_YEAR) continue;
    const rows = byYear.get(year);
    if (!rows?.length) break;
    const { publishedYear, coverageInfo } = computeYear(rows, population, year);
    if (!publishedYear) break;
    maxValidYear = year;
    if (!coverageInfo.coverage_ok) {
      break;
    }
  }
  if (maxValidYear === undefined) {
    throw new Error('[dtp3] no valid year reached population threshold');
  }
  if (latestYear !== maxValidYear) {
    throw new Error(
      `[dtp3] latest published year ${latestYear} does not match max valid year ${maxValidYear}`,
    );
  }
}

main().catch((error) => {
  console.error('[dtp3] ERROR', error);
  process.exitCode = 1;
});
