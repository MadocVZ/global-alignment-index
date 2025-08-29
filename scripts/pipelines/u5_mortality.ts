// Pipeline for Under-5 mortality (U5MR) from WDI
import { writeJson } from "../lib/io.ts";
import { upsertSource } from "../lib/manifest.ts";

const INDICATOR = "SH.DYN.MORT";
const POP = "SP.POP.TOTL";
const EXCLUDE = new Set([
  "WLD",
  "HIC",
  "INX",
  "LIC",
  "LMC",
  "MIC",
  "UMC",
  "OED",
  "ARB",
  "EAP",
  "ECA",
  "ECS",
  "EUU",
  "LCN",
  "LAC",
  "MEA",
  "NAC",
  "SAS",
  "SSA",
  "FCS",
]);

function isIso3(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && !EXCLUDE.has(code);
}

async function fetchWdiAll(ind: string) {
  const base =
    "https://api.worldbank.org/v2/country/all/indicator/" +
    ind +
    "?format=json&per_page=20000";
  const res1 = await fetch(base + "&page=1", {
    headers: { "User-Agent": "GAI-fetch-bot" },
  });
  if (!res1.ok) {
    const txt = await res1.text().catch(() => "");
    console.error(
      `[u5] WDI first page ${ind} HTTP ${res1.status} ${res1.statusText} :: ${txt.slice(
        0,
        200,
      )}`,
    );
    throw new Error(`u5: WDI ${ind} first page not OK`);
  }
  const first = await res1.json();
  if (!Array.isArray(first) || !Array.isArray(first[1])) {
    console.error(
      "[u5] Unexpected WDI payload (first page)",
      JSON.stringify(first).slice(0, 500),
    );
    return [];
  }
  const pages = (first[0] as any)?.pages || 1;
  const rows = [...first[1]];
  for (let p = 2; p <= pages; p++) {
    const rsp = await fetch(base + "&page=" + p, {
      headers: { "User-Agent": "GAI-fetch-bot" },
    });
    if (!rsp.ok) {
      const t = await rsp.text().catch(() => "");
      console.error(
        `[u5] WDI page ${p} ${ind} HTTP ${rsp.status} ${rsp.statusText} :: ${t.slice(0, 200)}`,
      );
      break;
    }
    const seg = await rsp.json();
    if (Array.isArray(seg) && Array.isArray(seg[1])) rows.push(...seg[1]);
  }
  return rows;
}

export async function run() {
  const [mortRows, popRows] = await Promise.all([
    fetchWdiAll(INDICATOR),
    fetchWdiAll(POP),
  ]);
  console.log('[u5] raw U5MR rows:', Array.isArray(mortRows) ? mortRows.length : 0);
  console.log('[u5] raw POP rows:',  Array.isArray(popRows)  ? popRows.length  : 0);

  const mort: Record<string, Record<number, number>> = {};
  for (const d of mortRows) {
    const iso = (d?.countryiso3code || d?.country?.id || "").toUpperCase();
    const year = Number(d?.date);
    const val = Number(d?.value);
    if (!iso || !isIso3(iso) || isNaN(val) || isNaN(year)) continue;
    mort[iso] ??= {};
    mort[iso][year] = val;
  }
  console.log("[u5] ISO3 with U5MR:", Object.keys(mort).length);

  const pop: Record<string, Record<number, number>> = {};
  for (const d of popRows) {
    const iso = (d?.countryiso3code || d?.country?.id || "").toUpperCase();
    const year = Number(d?.date);
    const val = Number(d?.value);
    if (!iso || !isIso3(iso) || isNaN(val) || isNaN(year)) continue;
    pop[iso] ??= {};
    pop[iso][year] = val;
  }
  console.log("[u5] ISO3 with POP:", Object.keys(pop).length);
  if (!Object.keys(pop).length) throw new Error("u5: population fetch empty");

  const years = new Set<number>();
  for (const iso in mort) {
    for (const y in mort[iso]) {
      const yy = Number(y);
      if (pop[iso]?.[yy] != null) years.add(yy);
    }
  }
  const ys = Array.from(years).sort((a, b) => a - b);
  console.log("[u5] years count:", years.size, ys.length ? `range ${ys[0]}–${ys[ys.length-1]}` : '');

  const data = Array.from(years)
    .map((year) => {
      let totalPop = 0;
      let weighted = 0;
      for (const iso in mort) {
        const u = mort[iso][year];
        const p = pop[iso]?.[year];
        if (u != null && p != null && !isNaN(u) && !isNaN(p)) {
          weighted += u * p;
          totalPop += p;
        }
      }
      if (totalPop > 0) {
        return { year, value: Math.round((weighted / totalPop) * 100) / 100 };
      }
      return undefined;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.year - b.year) as {
    year: number;
    value: number;
  }[];
  console.log('[u5] computed points:', data.length);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("u5_mortality: no data fetched — skipping write");
  }

  await writeJson("public/data/u5_mortality.json", data);
  await upsertSource("u5_mortality", {
    name: "Under-5 mortality",
    domain: "Health & Wellbeing",
    unit: "per 1,000 live births",
    source_org: "UN IGME via World Bank WDI",
    source_url: "https://data.worldbank.org/indicator/SH.DYN.MORT",
    license: "CC BY 4.0",
    cadence: "annual",
    method:
      "Population-weighted global mean of national SH.DYN.MORT using SP.POP.TOTL; exclude aggregates; round to 2 decimals.",
    updated_at: new Date().toISOString().slice(0, 10),
    data_start_year:
      Array.isArray(data) && data.length ? data[0].year : undefined,
  });
  return data;
}

// Node ESM-safe entrypoint check so smoke-run works
const isEntry = import.meta.url === new URL(process.argv[1], 'file://').href;
if (isEntry) {
  run().catch((err) => {
    console.error('[u5] fatal:', err?.message || err);
    process.exit(1);
  });
}
