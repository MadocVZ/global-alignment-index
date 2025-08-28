import { writeJson } from '../lib/io.ts';
import { upsertSource } from '../lib/manifest.ts';

export async function run() {
  const url = 'https://api.worldbank.org/v2/country/WLD/indicator/SP.DYN.LE00.IN?format=json&per_page=20000';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json[1] : [];
  const data = (Array.isArray(rows) ? rows : [])
    .filter((d: any) => d && d.value != null && !isNaN(Number(d.value)))
    .map((d: any) => ({ year: Number(d.date), value: Math.round(Number(d.value) * 100) / 100 }))
    .sort((a: any, b: any) => a.year - b.year);
  await writeJson('public/data/life_expectancy.json', data);
  await upsertSource('life_expectancy', {
    name: 'Life expectancy',
    domain: 'Health & Wellbeing',
    unit: 'years',
    source_org: 'World Bank',
    source_url: 'https://data.worldbank.org/indicator/SP.DYN.LE00.IN',
    license: 'CC BY 4.0',
    cadence: 'annual',
    method: 'Use World Bank annual series as provided; include only numeric values; round to 2 decimals.',
    updated_at: new Date().toISOString().slice(0,10),
    data_start_year: Array.isArray(data) && data.length ? data[0].year : undefined
  });
  return data;
}

if ((import.meta as any).main) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
