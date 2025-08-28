import { writeJson } from '../lib/io.ts';
import { upsertSource } from '../lib/manifest.ts';

const WB_API = 'https://api.worldbank.org/v2';
const INDICATOR = 'SH.DYN.MORT';
const POP = 'SP.POP.TOTL';
const EXCLUDE = new Set([
  'WLD','HIC','INX','LIC','LMC','MIC','UMC','OED','ARB','EAP','ECA','ECS','EUU','LCN','LAC','MEA','NAC','SAS','SSA','FCS'
]);

function isIso3(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && !EXCLUDE.has(code);
}

async function fetchIndicator(indicator: string) {
  const url = `${WB_API}/country/all/indicator/${indicator}?format=json&per_page=20000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json[1] : [];
  return Array.isArray(rows) ? rows : [];
}

export async function run() {
  const [mortRows, popRows] = await Promise.all([
    fetchIndicator(INDICATOR),
    fetchIndicator(POP),
  ]);

  const mort: Record<string, Record<number, number>> = {};
  for (const d of mortRows) {
    const iso = d?.countryiso3code;
    const year = Number(d?.date);
    const val = Number(d?.value);
    if (!iso || !isIso3(iso) || isNaN(val) || isNaN(year)) continue;
    mort[iso] ??= {};
    mort[iso][year] = val;
  }

  const pop: Record<string, Record<number, number>> = {};
  for (const d of popRows) {
    const iso = d?.countryiso3code;
    const year = Number(d?.date);
    const val = Number(d?.value);
    if (!iso || !isIso3(iso) || isNaN(val) || isNaN(year)) continue;
    pop[iso] ??= {};
    pop[iso][year] = val;
  }

  const years = new Set<number>();
  for (const iso in mort) for (const y in mort[iso]) years.add(Number(y));

  const data = Array.from(years).map((year) => {
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
  }).filter(Boolean).sort((a: any, b: any) => a.year - b.year) as {year:number, value:number}[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('u5_mortality: no data fetched — skipping write');
  }

  await writeJson('public/data/u5_mortality.json', data);
  await upsertSource('u5_mortality', {
    name: 'Under-5 mortality',
    domain: 'Health & Wellbeing',
    unit: 'per 1,000 live births',
    source_org: 'UN IGME via World Bank WDI',
    source_url: 'https://data.worldbank.org/indicator/SH.DYN.MORT',
    license: 'CC BY 4.0',
    cadence: 'annual',
    method: 'Population-weighted global mean of national SH.DYN.MORT using SP.POP.TOTL; exclude aggregates; round 2 decimals.',
    updated_at: new Date().toISOString().slice(0,10),
    data_start_year: Array.isArray(data) && data.length ? data[0].year : undefined,
  });
  return data;
}

if ((import.meta as any).main) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
