#!/usr/bin/env ts-node

/**
 * Pipeline: Bilateral humanitarian aid per capita (USD)
 *
 * Method summary:
 *   - Fetch OECD CRS bilateral disbursements (current USD) for humanitarian purpose codes 72010/72040/72050.
 *   - Fallback to public/samples/oecd_crs_humanitarian.sample.csv if explicitly requested.
 *   - Join with World Bank WDI SP.POP.TOTL world population via shared helper.
 *   - Enforce donor coverage ≥90% (reporting donors / eligible donors); drop years below threshold.
 *   - Emit [{ year, value }] rounded to 1 decimal and log GAISUM diagnostics.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

import { writeJson } from "./lib/io.ts";
import { parseCsv } from "./lib/csv.ts";
import { getWorldPopulationSeries } from "./wdi.ts";

const METRIC_ID = "humanitarian_aid_per_capita";
const PURPOSE_CODES = ["72010", "72040", "72050"] as const;
const OECD_BASE_URL = "https://stats.oecd.org/SDMX-JSON/data";
const OECD_DATASET = "CRS1";
const OECD_FREQ = "A"; // annual
const OECD_DONOR_TYPE = "BILATERAL";
const OECD_RECIPIENT = "_T"; // all recipients
const OECD_FLOW = "110"; // disbursements (current USD) — documented in CRS1 structure
const OECD_PRICES = "CU"; // current prices
const OECD_UNIT = "USD"; // US dollars (current)

const PROJECT_ROOT = process.cwd();
const OUTPUT_PATH = resolve(PROJECT_ROOT, "public/data/humanitarian_aid_per_capita.json");
const GAISUM_LOG_PATH = resolve(PROJECT_ROOT, "scripts/logs/humanitarian_aid_per_capita.gaisum.json");
const CSV_SAMPLE_PATH = resolve(PROJECT_ROOT, "public/samples/oecd_crs_humanitarian.sample.csv");

const USER_AGENT = "GAI-hum-aid-per-capita/1.0";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_FETCH_ATTEMPTS = 3;

const FORCE_CSV_FALLBACK = parseBoolean(process.env.USE_OECD_CSV_FALLBACK);
const ALLOW_FALLBACK = process.argv.includes("--allow-fallback");

interface YearAggregate {
  totalUSD: number;
  donors: Set<string>;
  eligibleDonors: Set<string>;
  approximateEligible: boolean;
}

interface YearSnapshot {
  year: number;
  numeratorUSD: number;
  population: number;
  value: number;
}

interface YearValue {
  year: number;
  value: number;
}

type SdmxResponse = {
  dataSets?: Array<{
    series?: Record<
      string,
      {
        observations?: Record<string, [number | null, ...(number | null)[]]>;
      }
    >;
  }>;
  structure?: {
    dimensions?: {
      series?: Array<{
        id: string;
        name?: string;
        values?: Array<{ id: string; name?: string }>;
      }>;
      observation?: Array<{
        id: string;
        name?: string;
        values?: Array<{ id: string; name?: string }>;
      }>;
    };
  };
};

type YearAggregateMap = Map<number, YearAggregate>;

type FetchLabel = "humanitarian" | "eligible";

type FetchMode = "api" | "csv_fallback";

type CoverageCounters = {
  year: number;
  reporting: number;
  eligible: number;
  ratio: number;
  approximateEligible: boolean;
};

type HumanitarianFetchResult = {
  aggregates: YearAggregateMap;
  mode: FetchMode;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function fetchJsonWithRetry(url: string, label: FetchLabel, attempt = 1): Promise<SdmxResponse> {
  console.log(`[${METRIC_ID}] GET ${label} attempt=${attempt} url=${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS).unref?.();

  try {
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "user-agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as SdmxResponse;
    return json;
  } catch (error) {
    console.warn(`[${METRIC_ID}] WARN fetch ${label} failed (attempt ${attempt}): ${String(error)}`);
    if (attempt >= MAX_FETCH_ATTEMPTS) {
      throw error;
    }
    const backoff = Math.min(2000 * attempt, 10_000);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, backoff));
    return fetchJsonWithRetry(url, label, attempt + 1);
  } finally {
    if (timeout) clearTimeout(timeout as any);
  }
}

function buildOecdKey(purposes: readonly string[]): string {
  const purposeKey = purposes.map((code) => `CRS_${code}`).join("+");
  return [
    OECD_FREQ,
    OECD_DONOR_TYPE,
    OECD_RECIPIENT,
    purposeKey,
    OECD_FLOW,
    OECD_PRICES,
    OECD_UNIT,
  ].join(".");
}

function buildOecdUrl(key: string): string {
  const url = new URL(`${OECD_BASE_URL}/${OECD_DATASET}/${key}`);
  url.searchParams.set("contentType", "JSON");
  url.searchParams.set("detail", "dataonly");
  url.searchParams.set("dimensionAtObservation", "TIME_PERIOD");
  return url.toString();
}

function findDonorDimensionIndex(dimensions: Array<{ id: string; name?: string }>): number {
  for (let i = 0; i < dimensions.length; i++) {
    const dim = dimensions[i];
    const label = `${dim.id ?? ""} ${dim.name ?? ""}`.toLowerCase();
    if (label.includes("donor")) {
      return i;
    }
  }
  return -1;
}

function parseSdmxSeries(json: SdmxResponse, label: FetchLabel): YearAggregateMap {
  const result: YearAggregateMap = new Map();
  const dataSet = json.dataSets?.[0];
  const seriesEntries = dataSet?.series;
  if (!seriesEntries) {
    console.warn(`[${METRIC_ID}] WARN SDMX ${label} payload missing series entries`);
    return result;
  }

  const seriesDimensions = json.structure?.dimensions?.series ?? [];
  const observationDimensions = json.structure?.dimensions?.observation ?? [];
  const donorIndex = findDonorDimensionIndex(seriesDimensions);
  const donorDimension = donorIndex >= 0 ? seriesDimensions[donorIndex] : undefined;
  const timeDimension = observationDimensions[0];
  const timeValues = timeDimension?.values ?? [];

  for (const [key, entry] of Object.entries(seriesEntries)) {
    const keyParts = key.split(":").map((part) => Number(part));
    const donorValue = donorDimension?.values?.[keyParts[donorIndex]];
    const donorCode = donorValue?.id ?? donorValue?.name ?? "unknown";

    const observations = entry.observations ?? {};
    for (const [obsKey, values] of Object.entries(observations)) {
      const obsIndex = Number(obsKey);
      const timeValue = timeValues[obsIndex];
      const yearRaw = timeValue?.id ?? timeValue?.name;
      const year = Number(yearRaw);
      const amount = values?.[0] ?? null;
      if (!Number.isInteger(year) || !Number.isFinite(amount as number) || (amount as number) <= 0) {
        continue;
      }
      const castAmount = Number(amount);
      const aggregate = result.get(year) ?? {
        totalUSD: 0,
        donors: new Set<string>(),
        eligibleDonors: new Set<string>(),
        approximateEligible: false,
      };
      aggregate.totalUSD += castAmount;
      if (donorCode && donorCode !== "_T") {
        aggregate.donors.add(donorCode);
      }
      result.set(year, aggregate);
    }
  }

  return result;
}

function mergeEligibleDonors(target: YearAggregateMap, eligible: YearAggregateMap): void {
  for (const [year, info] of eligible.entries()) {
    const current = target.get(year);
    if (!current) {
      continue;
    }
    current.eligibleDonors = new Set(info.donors);
    current.approximateEligible = false;
  }
}

async function getHumanitarianDisbursementsByYear(): Promise<HumanitarianFetchResult> {
  if (FORCE_CSV_FALLBACK) {
    console.warn(
      `[${METRIC_ID}] USE_OECD_CSV_FALLBACK=${process.env.USE_OECD_CSV_FALLBACK} ⇒ mode=csv_fallback`,
    );
    const aggregates = await loadFallbackCsv();
    return { aggregates, mode: "csv_fallback" };
  }

  const humanitarianKey = buildOecdKey(PURPOSE_CODES);
  const humanitarianUrl = buildOecdUrl(humanitarianKey);

  try {
    const humanitarianJson = await fetchJsonWithRetry(humanitarianUrl, "humanitarian");
    const humanitarian = parseSdmxSeries(humanitarianJson, "humanitarian");

    if (!humanitarian.size) {
      throw new Error("humanitarian SDMX response empty");
    }

    try {
      const eligibleKey = buildOecdKey(["TOTAL"]);
      const eligibleUrl = buildOecdUrl(eligibleKey);
      const eligibleJson = await fetchJsonWithRetry(eligibleUrl, "eligible");
      const eligible = parseSdmxSeries(eligibleJson, "eligible");
      mergeEligibleDonors(humanitarian, eligible);
    } catch (eligibleError) {
      console.warn(`[${METRIC_ID}] WARN unable to fetch eligible donors set: ${String(eligibleError)}`);
      for (const info of humanitarian.values()) {
        if (info.eligibleDonors.size === 0) {
          for (const donor of info.donors) {
            info.eligibleDonors.add(donor);
          }
        }
        info.approximateEligible = true;
      }
    }

    return { aggregates: humanitarian, mode: "api" };
  } catch (primaryError) {
    console.warn(`[${METRIC_ID}] WARN primary OECD fetch failed: ${String(primaryError)}`);
    if (!ALLOW_FALLBACK) {
      throw new Error(
        `[${METRIC_ID}] CSV fallback disallowed (pass --allow-fallback or set USE_OECD_CSV_FALLBACK=true)`,
      );
    }
    console.warn(
      `[${METRIC_ID}] WARN using csv_fallback because --allow-fallback was provided (path=${CSV_SAMPLE_PATH})`,
    );
    const aggregates = await loadFallbackCsv();
    return { aggregates, mode: "csv_fallback" };
  }
}

async function loadFallbackCsv(): Promise<YearAggregateMap> {
  const text = await readFile(CSV_SAMPLE_PATH, "utf8").catch((error) => {
    throw new Error(`CSV fallback missing at ${CSV_SAMPLE_PATH}: ${String(error)}`);
  });
  const rows = parseCsv(text);
  if (!rows.length) {
    throw new Error("CSV fallback file empty");
  }
  const header = rows[0];
  const idxYear = header.findIndex((value) => value.toLowerCase() === "year");
  const idxDonor = header.findIndex((value) => value.toLowerCase() === "donor");
  const idxDonorType = header.findIndex((value) => value.toLowerCase() === "donor_type");
  const idxPurpose = header.findIndex((value) => value.toLowerCase() === "purpose_code");
  const idxAmount = header.findIndex((value) => value.toLowerCase() === "disbursements_current_usd");
  if (idxYear === -1 || idxDonor === -1 || idxDonorType === -1 || idxPurpose === -1 || idxAmount === -1) {
    throw new Error("CSV fallback missing required columns");
  }

  const aggregates: YearAggregateMap = new Map();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.length) continue;
    const donorType = row[idxDonorType];
    if (donorType?.toUpperCase() !== "BILATERAL") continue;
    const purpose = row[idxPurpose]?.trim();
    if (!purpose || !PURPOSE_CODES.some((code) => purpose.startsWith(code))) continue;
    const year = Number(row[idxYear]);
    if (!Number.isInteger(year)) continue;
    const donor = row[idxDonor]?.trim();
    const amount = Number(row[idxAmount]?.replace(/[, ]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const aggregate = aggregates.get(year) ?? {
      totalUSD: 0,
      donors: new Set<string>(),
      eligibleDonors: new Set<string>(),
      approximateEligible: true,
    };
    aggregate.totalUSD += amount;
    if (donor) {
      aggregate.donors.add(donor);
      aggregate.eligibleDonors.add(donor);
    }
    aggregates.set(year, aggregate);
  }

  if (!aggregates.size) {
    throw new Error("CSV fallback produced no humanitarian rows");
  }

  return aggregates;
}

async function logGAISUM(payload: Record<string, unknown>): Promise<void> {
  const serialized = JSON.stringify(payload, null, 2);
  console.log(`[${METRIC_ID}] GAISUM ${serialized}`);
  await ensureDir(GAISUM_LOG_PATH);
  await writeFile(GAISUM_LOG_PATH, `${serialized}\n`, "utf8");
}

function computeDomain(series: YearValue[]): [number, number] {
  if (!series.length) {
    return [0, 20];
  }
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [Math.max(0, min - 1), min + 1];
  }
  const pad = Math.max(1, (max - min) * 0.05);
  return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
}

async function run(): Promise<void> {
  console.log(`[${METRIC_ID}] starting pipeline`);
  const { aggregates: humanitarian, mode } = await getHumanitarianDisbursementsByYear();
  const population = await getWorldPopulationSeries();
  console.log(`[${METRIC_ID}] mode=${mode}`);

  const years = Array.from(humanitarian.keys()).sort((a, b) => a - b);
  const rows: YearValue[] = [];
  const dropped: number[] = [];
  const coverageCounters: CoverageCounters[] = [];
  const sample: YearSnapshot[] = [];
  const unroundedValues: number[] = [];

  for (const year of years) {
    const entry = humanitarian.get(year);
    if (!entry) continue;
    const populationValue = population.get(year);
    if (!populationValue || populationValue <= 0) {
      console.warn(`[${METRIC_ID}] WARN missing population for year ${year}`);
      continue;
    }

    const reporting = entry.donors.size;
    const eligible = entry.eligibleDonors.size || reporting;
    const coverageRatio = eligible > 0 ? reporting / eligible : 0;

    coverageCounters.push({
      year,
      reporting,
      eligible,
      ratio: coverageRatio,
      approximateEligible: entry.approximateEligible,
    });

    if (coverageRatio < 0.9) {
      console.warn(
        `[${METRIC_ID}] WARN dropping year ${year} due to coverage ${round2(coverageRatio * 100)}% (${reporting}/${eligible})`,
      );
      dropped.push(year);
      continue;
    }

    const value = entry.totalUSD / populationValue;
    const rounded = round1(value);
    rows.push({ year, value: rounded });
    unroundedValues.push(value);

    if (sample.length < 5) {
      sample.push({ year, numeratorUSD: round2(entry.totalUSD), population: populationValue, value: round2(value) });
    }
  }

  if (!rows.length) {
    throw new Error(`[${METRIC_ID}] no rows survived coverage guard`);
  }

  await writeJson(OUTPUT_PATH, rows);

  const count = unroundedValues.length;
  const meanRaw = count ? sum(unroundedValues) / count : 0;
  const mean = count ? round2(meanRaw) : 0;
  const stdev = count ? round2(Math.sqrt(sum(unroundedValues.map((v) => (v - meanRaw) ** 2)) / count)) : 0;
  const coverageOkYears = rows.length;

  const gaisum = {
    id: METRIC_ID,
    path: "/data/humanitarian_aid_per_capita.json",
    mode,
    rows: rows.length,
    min_year: rows[0]?.year ?? null,
    max_year: rows.at(-1)?.year ?? null,
    mean,
    stdev,
    coverage_ok_years: coverageOkYears,
    dropped_years: dropped.length,
    coverage: coverageCounters,
    sample,
    domain: computeDomain(rows),
  };

  await logGAISUM(gaisum);

  console.log(`[${METRIC_ID}] wrote ${rows.length} rows to ${OUTPUT_PATH}`);
}

run().catch((error) => {
  console.error(`[${METRIC_ID}] ERROR ${String(error)}`);
  process.exitCode = 1;
});
