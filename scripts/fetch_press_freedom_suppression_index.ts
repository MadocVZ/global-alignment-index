import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import * as cheerio from "cheerio";

const METRIC_ID = "press_freedom_suppression_index";
const START_YEAR = 2002;
const END_YEAR = new Date().getUTCFullYear();
const REQUEST_INTERVAL_MS = 1000;
const MAX_FETCH_ATTEMPTS = 5;
const USER_AGENT = "GAI-PressFreedomFetcher/1.0 (+https://global-alignment-index.com/contact)";

const PROJECT_ROOT = process.cwd();
const OUTPUT_PATH = path.resolve(PROJECT_ROOT, "public/data/press_freedom_suppression_index.json");
const LOG_PATH = path.resolve(PROJECT_ROOT, "scripts/logs/press_freedom_suppression_index.json");
const CACHE_DIR = path.resolve(PROJECT_ROOT, "scripts/cache");
const POPULATION_PATH = path.resolve(PROJECT_ROOT, "data/raw/pop_by_country.csv");

const CSV_BASE_URL = "https://rsf.org/sites/default/files/import_classement";
const PAGE_BASE_URL = "https://rsf.org/en/index";

let lastRequestTime = 0;
const execFileAsync = promisify(execFile);

const AGGREGATE_ISO3 = new Set([
  "AFE",
  "AFW",
  "ARB",
  "CEB",
  "CSS",
  "EAP",
  "EAR",
  "EAS",
  "ECA",
  "ECS",
  "EMU",
  "EUU",
  "FCS",
  "HIC",
  "HPC",
  "IBD",
  "IBT",
  "IDA",
  "IDB",
  "IDX",
  "LAC",
  "LCN",
  "LDC",
  "LIC",
  "LMC",
  "LMY",
  "LTE",
  "MEA",
  "MIC",
  "MNA",
  "NAC",
  "OED",
  "OSS",
  "PRE",
  "PSS",
  "PST",
  "SAS",
  "SSA",
  "SSF",
  "SST",
  "TEA",
  "TEC",
  "TLA",
  "TMN",
  "TSA",
  "TSS",
  "UMC",
]);

class HttpError extends Error {
  status?: number;
}

type RawRow = {
  iso?: string | null;
  name: string;
  score: number;
};

type YearStat = {
  year: number;
  numerator: number;
  denominator: number;
  worldPopulation: number;
  coverage: number;
  valid: boolean;
  rowCount: number;
  keptRows: number;
};

type PopMap = Map<string, Map<number, number>>;
type YearWorldPop = Map<number, number>;

type SeriesPoint = { year: number; value: number };

const NAME_TO_ISO3_ENTRIES: Array<[string, string]> = [
  ["cote divoire", "CIV"],
  ["cote d ivoire", "CIV"],
  ["cote d'ivoire", "CIV"],
  ["cote d’ivoire", "CIV"],
  ["cote-d-ivoire", "CIV"],
  ["democratic republic of the congo", "COD"],
  ["democratic republic of congo", "COD"],
  ["congo kinshasa", "COD"],
  ["congo (kinshasa)", "COD"],
  ["dr congo", "COD"],
  ["republic of the congo", "COG"],
  ["congo brazzaville", "COG"],
  ["congo (brazzaville)", "COG"],
  ["south korea", "KOR"],
  ["north korea", "PRK"],
  ["czech republic", "CZE"],
  ["czechia", "CZE"],
  ["myanmar (burma)", "MMR"],
  ["myanmar", "MMR"],
  ["burma", "MMR"],
  ["eswatini", "SWZ"],
  ["swaziland", "SWZ"],
  ["timor leste", "TLS"],
  ["timor-leste", "TLS"],
  ["east timor", "TLS"],
  ["lao people's democratic republic", "LAO"],
  ["laos", "LAO"],
  ["viet nam", "VNM"],
  ["vietnam", "VNM"],
  ["brunei darussalam", "BRN"],
  ["united states", "USA"],
  ["united kingdom", "GBR"],
  ["uk", "GBR"],
  ["great britain", "GBR"],
  ["russia", "RUS"],
  ["russian federation", "RUS"],
  ["sao tome and principe", "STP"],
  ["são tomé and príncipe", "STP"],
  ["sao tome & principe", "STP"],
  ["sao tome", "STP"],
  ["guinea bissau", "GNB"],
  ["guinea-bissau", "GNB"],
  ["solomon islands", "SLB"],
  ["hong kong", "HKG"],
  ["palestine", "PSE"],
  ["state of palestine", "PSE"],
  ["palestinian territories", "PSE"],
  ["palestinian territory", "PSE"],
  ["occupied palestinian territory", "PSE"],
  ["taiwan", "TWN"],
  ["micronesia (federated states of)", "FSM"],
  ["micronesia", "FSM"],
  ["gambia", "GMB"],
  ["the gambia", "GMB"],
  ["ivory coast", "CIV"],
  ["cape verde", "CPV"],
  ["cabo verde", "CPV"],
  ["slovakia", "SVK"],
  ["north macedonia", "MKD"],
  ["macedonia", "MKD"],
  ["bosnia-herzegovina", "BIH"],
  ["bosnia and herzegovina", "BIH"],
  ["moldova", "MDA"],
  ["moldova (rep.)", "MDA"],
  ["moldova (republic of)", "MDA"],
  ["tanzania", "TZA"],
  ["united republic of tanzania", "TZA"],
  ["democratic people's republic of korea", "PRK"],
  ["kyrgyzstan", "KGZ"],
  ["kyrgyz republic", "KGZ"],
  ["iran", "IRN"],
  ["iran (islamic republic of)", "IRN"],
  ["syria", "SYR"],
  ["syrian arab republic", "SYR"],
  ["venezuela", "VEN"],
  ["venezuela (bolivarian republic of)", "VEN"],
  ["bolivia", "BOL"],
  ["bolivia (plurinational state of)", "BOL"],
  ["macao", "MAC"],
  ["macao, china", "MAC"],
  ["macau", "MAC"],
  ["curaçao", "CUW"],
  ["curaçao (netherlands)", "CUW"],
  ["cook islands", "COK"],
  ["bahamas", "BHS"],
  ["the bahamas", "BHS"],
  ["marshall islands", "MHL"],
  ["st. kitts and nevis", "KNA"],
  ["saint kitts and nevis", "KNA"],
  ["st. vincent and the grenadines", "VCT"],
  ["saint vincent and the grenadines", "VCT"],
  ["st. lucia", "LCA"],
  ["saint lucia", "LCA"],
  ["st. maarten", "SXM"],
  ["saint maarten", "SXM"],
  ["sint maarten", "SXM"],
  ["puerto rico", "PRI"],
  ["new caledonia", "NCL"],
  ["guadeloupe", "GLP"],
  ["martinique", "MTQ"],
  ["réunion", "REU"],
  ["reunion", "REU"],
  ["western sahara", "ESH"],
  ["kosovo", "XKX"],
  ["somaliland", "SML"],
  ["uae", "ARE"],
  ["united arab emirates", "ARE"],
  ["ukraine", "UKR"],
  ["holy see", "VAT"],
  ["vatican", "VAT"],
  ["vatican city", "VAT"],
  ["brunei", "BRN"],
];

const NAME_TO_ISO3 = new Map(NAME_TO_ISO3_ENTRIES.map(([name, iso]) => [normalizeName(name), iso] as const));

function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function roundToOne(value: number): number {
  return Number.parseFloat(value.toFixed(1));
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_INTERVAL_MS) {
    const jitter = Math.floor(Math.random() * 150);
    await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS - elapsed + jitter));
  }
  lastRequestTime = Date.now();
}

async function curlRequest(url: string): Promise<{ status: number; body: string; contentType: string | null }> {
  await waitForRateLimit();
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--compressed",
    "--max-time",
    "60",
    "--user-agent",
    USER_AGENT,
    "--header",
    "Accept: text/csv, text/html;q=0.9, */*;q=0.8",
    "--write-out",
    "\n%{http_code}\n%{content_type}\n",
    url,
  ];

  try {
    const { stdout } = await execFileAsync("curl", args);
    return parseCurlOutput(stdout, url);
  } catch (error) {
    const stdout = typeof (error as { stdout?: string }).stdout === "string" ? (error as { stdout?: string }).stdout : null;
    if (stdout) {
      return parseCurlOutput(stdout, url);
    }
    throw error;
  }
}

function parseCurlOutput(stdout: string, url: string): { status: number; body: string; contentType: string | null } {
  const trimmed = stdout.trimEnd();
  const lastNewline = trimmed.lastIndexOf("\n");
  const secondLast = trimmed.lastIndexOf("\n", lastNewline - 1);
  if (lastNewline === -1 || secondLast === -1) {
    throw new Error(`[${METRIC_ID}] unexpected curl output for ${url}`);
  }
  const contentType = trimmed.slice(lastNewline + 1) || null;
  const statusText = trimmed.slice(secondLast + 1, lastNewline);
  const body = trimmed.slice(0, secondLast);
  const status = Number.parseInt(statusText, 10);
  if (!Number.isFinite(status)) {
    throw new Error(`[${METRIC_ID}] invalid HTTP status from curl for ${url}`);
  }
  return { status, body, contentType };
}

async function requestWithRetry(
  url: string,
  attempt = 1,
): Promise<{ body: string; contentType: string | null }> {
  try {
    const { status, body, contentType } = await curlRequest(url);
    if (status === 404) {
      const err = new HttpError(`[${METRIC_ID}] HTTP 404 for ${url}`);
      err.status = 404;
      throw err;
    }
    if (status < 200 || status >= 300) {
      const err = new HttpError(`[${METRIC_ID}] HTTP ${status} for ${url}`);
      err.status = status;
      throw err;
    }
    return { body, contentType };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw error;
    }
    if (attempt >= MAX_FETCH_ATTEMPTS) {
      throw error;
    }
    const delay = Math.min(4000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 200);
    console.warn(
      `[${METRIC_ID}] WARN fetch failed for ${url} (attempt ${attempt}): ${String(error)}; retrying in ${delay}ms`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return requestWithRetry(url, attempt + 1);
  }
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === "\"") {
        if (line[i + 1] === "\"") {
          current += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === "\"") {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseDelimited(text: string, delimiter: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (!lines.length) {
    return { headers: [], rows: [] };
  }
  if (lines[0][0] === "\ufeff") {
    lines[0] = lines[0].slice(1);
  }
  const headers = parseCsvLine(lines[0], delimiter).map((cell) => cell.trim());
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));
  return { headers, rows };
}

function parseRsfCsv(text: string): RawRow[] {
  const { headers, rows } = parseDelimited(text, ";");
  if (!headers.length) {
    return [];
  }
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  const isoIdx = normalizedHeaders.findIndex((h) => h === "iso" || h === "iso3" || h === "code iso" || h === "iso code");
  const nameIdxCandidates = [
    normalizedHeaders.findIndex((h) => h === "country_en" || h === "country english"),
    normalizedHeaders.findIndex((h) => h === "country"),
    normalizedHeaders.findIndex((h) => h.includes("country_en")),
    normalizedHeaders.findIndex((h) => h.includes("country")),
  ];
  const nameIdx = nameIdxCandidates.find((idx) => idx !== -1) ?? -1;
  const scoreIdxPriority = [
    normalizedHeaders.findIndex((h) => h === "score"),
    normalizedHeaders.findIndex((h) => h === "score n"),
    normalizedHeaders.findIndex((h) => h === "global score"),
    normalizedHeaders.findIndex((h) => h.startsWith("score") && !h.includes("evolution")),
  ];
  const scoreIdx = scoreIdxPriority.find((idx) => idx !== -1) ?? -1;
  const results: RawRow[] = [];
  for (const row of rows) {
    const isoRaw = isoIdx !== -1 ? row[isoIdx] ?? "" : "";
    const nameRaw = nameIdx !== -1 ? row[nameIdx] ?? "" : "";
    const scoreRaw = scoreIdx !== -1 ? row[scoreIdx] ?? "" : "";
    const isoCandidate = isoRaw.trim();
    const nameCandidate = nameRaw.trim();
    const scoreCandidate = scoreRaw.replace(/,/g, ".").trim();
    const score = Number.parseFloat(scoreCandidate);
    if (!nameCandidate || !Number.isFinite(score)) {
      continue;
    }
    const iso3 = extractIso3(isoCandidate);
    results.push({ iso: iso3, name: nameCandidate, score });
  }
  return results;
}

function parseRsfHtml(html: string): RawRow[] {
  const $ = cheerio.load(html);
  const rows: RawRow[] = [];

  $("table tr").each((_, element) => {
    const cells = $(element).find("td");
    if (cells.length < 3) {
      return;
    }
    const name = $(cells[1]).text().trim();
    const scoreText = $(cells[2]).text().trim();
    const score = Number.parseFloat(scoreText.replace(/,/g, "."));
    if (!name || !Number.isFinite(score)) {
      return;
    }
    rows.push({ name, score });
  });

  $(".country-list-item").each((_, element) => {
    const name = $(element).find(".country-list-item__name").text().trim();
    const scoreText = $(element).find(".country-list-item__score").text().trim();
    const score = Number.parseFloat(scoreText.replace(/,/g, "."));
    if (!name || !Number.isFinite(score)) {
      return;
    }
    rows.push({ name, score });
  });

  $(".listing__row").each((_, element) => {
    const name = $(element).find(".listing__country").text().trim();
    const scoreText = $(element).find(".listing__score").text().trim();
    const score = Number.parseFloat(scoreText.replace(/,/g, "."));
    if (!name || !Number.isFinite(score)) {
      return;
    }
    rows.push({ name, score });
  });

  return rows;
}

function extractIso3(value: string): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : null;
}

async function readJsonIfExists(filePath: string): Promise<RawRow[] | null> {
  try {
    const text = await readFile(filePath, "utf8");
    const parsed = JSON.parse(text) as RawRow[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function fetchYearData(year: number): Promise<RawRow[]> {
  const cachePath = path.join(CACHE_DIR, `rsf_${year}.json`);
  const fixtureDir = process.env.RSF_FIXTURE_DIR;

  if (fixtureDir) {
    const fixturePath = path.resolve(PROJECT_ROOT, fixtureDir, `${year}.json`);
    const fixture = await readJsonIfExists(fixturePath);
    if (fixture) {
      console.log(`[${METRIC_ID}] using fixture for ${year}`);
      return fixture;
    }
  }

  const cached = await readJsonIfExists(cachePath);
  if (cached) {
    return cached;
  }

  const csvUrl = `${CSV_BASE_URL}/${year}.csv`;
  let rows: RawRow[] = [];
  try {
    const { body, contentType } = await requestWithRetry(csvUrl);
    const effectiveType = contentType ?? "";
    if (effectiveType.includes("text/csv") || body.includes(";")) {
      rows = parseRsfCsv(body);
    }
  } catch (error) {
    const status = (error as HttpError)?.status;
    if (status === 404) {
      console.warn(`[${METRIC_ID}] WARN ${year}: remote CSV not found (404); skipping`);
      rows = [];
    } else {
      throw error;
    }
  }

  if (!rows.length) {
    try {
      const pageUrl = `${PAGE_BASE_URL}?year=${year}`;
      const { body } = await requestWithRetry(pageUrl);
      rows = parseRsfHtml(body);
      if (!rows.length) {
        console.warn(`[${METRIC_ID}] WARN ${year}: HTML parsing yielded no rows`);
      }
    } catch (error) {
      if ((error as HttpError)?.status === 404) {
        console.warn(`[${METRIC_ID}] WARN ${year}: HTML page not found (404); skipping`);
      } else {
        throw error;
      }
    }
  }

  if (!process.env.RSF_FIXTURE_DIR && rows.length) {
    await ensureDir(cachePath);
    await writeFile(cachePath, JSON.stringify(rows, null, 2));
  }

  return rows;
}

function parsePopulationCsv(text: string): PopMap {
  const { headers, rows } = parseDelimited(text, ",");
  if (!headers.length) {
    throw new Error(`[${METRIC_ID}] population CSV missing headers`);
  }
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  const isoIdx = normalizedHeaders.indexOf("iso3");
  const yearIdx = normalizedHeaders.indexOf("year");
  const popIdx = normalizedHeaders.indexOf("population");
  if (isoIdx === -1 || yearIdx === -1 || popIdx === -1) {
    throw new Error(`[${METRIC_ID}] population CSV missing required columns`);
  }
  const map: PopMap = new Map();
  for (const row of rows) {
    const iso = (row[isoIdx] ?? "").trim().toUpperCase();
    const year = Number.parseInt(row[yearIdx] ?? "", 10);
    const pop = Number.parseFloat((row[popIdx] ?? "").replace(/,/g, ""));
    if (!iso || iso === "WLD" || AGGREGATE_ISO3.has(iso) || !Number.isInteger(year) || !Number.isFinite(pop) || pop <= 0) {
      continue;
    }
    if (!/^[A-Z]{3}$/.test(iso)) {
      continue;
    }
    if (!map.has(iso)) {
      map.set(iso, new Map());
    }
    map.get(iso)!.set(year, pop);
  }
  return map;
}

function computeWorldPopulation(popMap: PopMap): YearWorldPop {
  const world: YearWorldPop = new Map();
  for (const perIso of popMap.values()) {
    for (const [year, pop] of perIso) {
      world.set(year, (world.get(year) ?? 0) + pop);
    }
  }
  return world;
}

function resolveIso(row: RawRow, warnUnmapped: Set<string>): string | null {
  if (row.iso && /^[A-Z]{3}$/.test(row.iso)) {
    return row.iso;
  }
  if (row.iso) {
    const isoCandidate = extractIso3(row.iso);
    if (isoCandidate && /^[A-Z]{3}$/.test(isoCandidate)) {
      return isoCandidate;
    }
  }
  const normalized = normalizeName(row.name);
  const mapped = NAME_TO_ISO3.get(normalized);
  if (mapped) {
    return mapped;
  }
  warnUnmapped.add(row.name);
  return null;
}

function validateSeries(series: SeriesPoint[]): void {
  if (!series.length) {
    throw new Error(`[${METRIC_ID}] produced empty series`);
  }
  for (let i = 1; i < series.length; i++) {
    if (series[i].year !== series[i - 1].year + 1) {
      throw new Error(`[${METRIC_ID}] non-contiguous years detected (${series[i - 1].year} → ${series[i].year})`);
    }
  }
  for (const point of series) {
    if (!(point.value >= 0 && point.value <= 100)) {
      throw new Error(`[${METRIC_ID}] value out of bounds for ${point.year}: ${point.value}`);
    }
    const fixed = point.value.toFixed(1);
    if (!/^-?\d+\.\d$/.test(fixed)) {
      throw new Error(`[${METRIC_ID}] precision check failed for ${point.year}: ${point.value}`);
    }
  }
  const lastValue = series.at(-1)!.value;
  if (lastValue < 45 || lastValue > 60) {
    console.warn(`[${METRIC_ID}] WARN plausibility check: latest value ${lastValue} outside [45, 60]`);
  }
}

async function main(): Promise<void> {
  const populationText = await readFile(POPULATION_PATH, "utf8");
  const popByIso = parsePopulationCsv(populationText);
  const worldPopByYear = computeWorldPopulation(popByIso);

  const warnUnmapped = new Set<string>();
  const missingPopulation = new Set<string>();
  const yearStats = new Map<number, YearStat>();

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const rows = await fetchYearData(year);
    const worldPopulation = worldPopByYear.get(year) ?? 0;
    if (!rows.length || worldPopulation <= 0) {
      yearStats.set(year, {
        year,
        numerator: 0,
        denominator: 0,
        worldPopulation,
        coverage: 0,
        valid: false,
        rowCount: rows.length,
        keptRows: 0,
      });
      console.log(`[${METRIC_ID}] ${year}: rows=${rows.length} coverage=0% (invalid)`);
      continue;
    }

    let numerator = 0;
    let denominator = 0;
    let keptRows = 0;
    const usedIso = new Set<string>();
    const duplicateIso = new Set<string>();

    for (const row of rows) {
      const iso = resolveIso(row, warnUnmapped);
      if (!iso) {
        continue;
      }
      if (usedIso.has(iso)) {
        duplicateIso.add(iso);
        continue;
      }
      usedIso.add(iso);
      const pop = popByIso.get(iso)?.get(year);
      if (!pop || !Number.isFinite(pop) || pop <= 0) {
        missingPopulation.add(`${iso}:${year}`);
        continue;
      }
      if (!Number.isFinite(row.score)) {
        continue;
      }
      const suppression = 100 - row.score;
      numerator += suppression * pop;
      denominator += pop;
      keptRows += 1;
    }

    const coverage = denominator > 0 && worldPopulation > 0 ? denominator / worldPopulation : 0;
    const valid = denominator > 0 && coverage >= 0.95;
    yearStats.set(year, {
      year,
      numerator,
      denominator,
      worldPopulation,
      coverage,
      valid,
      rowCount: rows.length,
      keptRows,
    });
    const pct = (coverage * 100).toFixed(2);
    console.log(
      `[${METRIC_ID}] ${year}: rows=${rows.length} kept=${keptRows} coverage=${pct}% ${valid ? "(valid)" : "(invalid)"}`,
    );
    if (duplicateIso.size) {
      console.warn(
        `[${METRIC_ID}] WARN ${year}: duplicate ISO rows skipped ${Array.from(duplicateIso).sort().join(", ")}`,
      );
    }
  }

  const allYears = Array.from(yearStats.keys()).sort((a, b) => a - b);
  const validYears = allYears.filter((year) => yearStats.get(year)?.valid);

  let bestStart = -1;
  let bestLen = 0;
  let bestEnd = -1;
  let index = 0;
  while (index < validYears.length) {
    const start = validYears[index];
    let end = start;
    let j = index + 1;
    while (j < validYears.length && validYears[j] === validYears[j - 1] + 1) {
      end = validYears[j];
      j++;
    }
    const length = end - start + 1;
    if (length > bestLen || (length === bestLen && end > bestEnd)) {
      bestLen = length;
      bestStart = start;
      bestEnd = end;
    }
    index = j;
  }

  if (bestLen === 0 || bestStart === -1) {
    throw new Error(`[${METRIC_ID}] no valid years after coverage checks`);
  }

  const keptYears: number[] = [];
  for (let year = bestStart; year <= bestEnd; year++) {
    keptYears.push(year);
  }

  const droppedLeading = allYears.filter((year) => year < bestStart);
  const droppedTrailing = allYears.filter((year) => year > bestEnd);

  const series: SeriesPoint[] = keptYears.map((year) => {
    const stat = yearStats.get(year);
    if (!stat || !stat.valid || stat.denominator <= 0) {
      throw new Error(`[${METRIC_ID}] internal error: missing stats for kept year ${year}`);
    }
    const value = stat.numerator / stat.denominator;
    const rounded = roundToOne(value);
    return { year, value: rounded };
  });

  validateSeries(series);

  await ensureDir(OUTPUT_PATH);
  await writeFile(OUTPUT_PATH, JSON.stringify(series, null, 2));

  const mean = roundToOne(series.reduce((sum, point) => sum + point.value, 0) / series.length);

  const notes: string[] = [];
  if (process.env.RSF_FIXTURE_DIR) {
    notes.push("fixture_mode");
  }
  if (missingPopulation.size) {
    notes.push(`missing_population_entries=${missingPopulation.size}`);
  }

  const logPayload = {
    metric_id: METRIC_ID,
    rows: series.length,
    min_year: series[0]?.year ?? null,
    max_year: series.at(-1)?.year ?? null,
    mean,
    coverage_rule: "≥95% world population per year; keep the longest contiguous valid block",
    transform: "100 - RSF_score",
    population_weighted: true,
    warn_unmapped: Array.from(warnUnmapped).sort(),
    notes,
    dropped_leading_years: droppedLeading,
    dropped_trailing_years: droppedTrailing,
    kept_span: { start: bestStart, end: bestEnd },
  };

  await ensureDir(LOG_PATH);
  await writeFile(LOG_PATH, JSON.stringify(logPayload, null, 2));

  console.log(`[${METRIC_ID}] wrote ${series.length} rows (${series[0].year}–${series.at(-1)?.year})`);
  console.log(`[${METRIC_ID}] mean=${mean}`);
  if (missingPopulation.size) {
    console.warn(`[${METRIC_ID}] WARN missing population entries: ${missingPopulation.size}`);
  }
}

main().catch((error) => {
  console.error(`[${METRIC_ID}] ERROR ${String(error)}`);
  process.exit(1);
});
