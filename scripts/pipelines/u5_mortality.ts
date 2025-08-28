import { writeJson } from '../lib/io.ts';
import { upsertSource } from '../lib/manifest.ts';

const INDICATOR = 'SH.DYN.MORT';
const POP = 'SP.POP.TOTL';
const EXCLUDE = new Set([
  'WLD','HIC','INX','LIC','LMC','MIC','UMC','OED','ARB','EAP','ECA','ECS','EUU','LCN','LAC','MEA','NAC','SAS','SSA','FCS'
]);

function isIso3(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && !EXCLUDE.has(code);
}

async function fetchWdiAll(ind: string) {
  const base =
    'https://api.worldbank.org/v2/country/all/indicator/' +
    ind +
    '?format=json&per_page=20000';
  const first = await (await fetch(base + '&page=1')).json();
  const pages = (Array.isArray(first) && (first[0] as any)?.pages) || 1;
  const rows = Array.isArray(first) && Array.isArray(first[1]) ? [...first[1]] : [];
  for (let p = 2; p <= pages; p++) {
    const part = await (await fetch(base + '&page=' + p)).json();
    if (Array.isArray(part) && Array.isArray(part[1])) rows.push(...part[1]);
  }
  return rows;
}

export async function run() {
  const [mortRows, popRows] = await Promise.all([
    fetchWdiAll(INDICATOR),
    fetchWdiAll(POP),
  ]);
  console.log('[u5] raw U5MR rows:', mortRows.length);
  console.log('[u5] raw POP rows:', popRows.length);

  const mort: Record<string, Record<number, number>> = {};
  for (const d of mortRows) {
    const iso = d?.countryiso3code;
    const year = Number(d?.date);
    const val = Number(d?.value);
    if (!iso || !isIso3(iso) || isNaN(val) || isNaN(year)) continue;
    mort[iso] ??= {};
    mort[iso][year] = val;
  }
  console.log('[u5] ISO3 with U5MR:', Object.keys(mort).length);

  const pop: Record<string, Record<number, number>> = {};
  for (const d of popRows) {
    const iso = d?.countryiso3code;
    const year = Number(d?.date);
    const val = Number(d?.value);
    if (!iso || !isIso3(iso) || isNaN(val) || isNaN(year)) continue;
    pop[iso] ??= {};
    pop[iso][year] = val;
  }
  console.log('[u5] ISO3 with POP:', Object.keys(pop).length);

  const years = new Set<number>();
  for (const iso in mort) for (const y in mort[iso]) years.add(Number(y));
  console.log('[u5] years count:', years.size);

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
    .sort((a: any, b: any) => a.year - b.year) as { year: number; value: number }[];
  console.log('[u5] computed points:', data.length);
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
    method:
      'Population-weighted global mean of national SH.DYN.MORT using SP.POP.TOTL; exclude aggregates; round 2 decimals.',
    updated_at: new Date().toISOString().slice(0, 10),
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
