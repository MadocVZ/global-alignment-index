import { parseCsv } from '../lib/csv.ts';
import { makeAnnualMean } from '../lib/annualize.ts';
import { writeJson } from '../lib/io.ts';
import { upsertSource } from '../lib/manifest.ts';

export async function run() {
  const res = await fetch('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_gl.csv');
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text, { commentPrefix: '#'});
  const data = makeAnnualMean(rows, { yearCol: 0, valueCol: 3, missingValue: -99.99 });
  await writeJson('public/data/co2_ppm.json', data);
  await upsertSource('co2_ppm', {
    name: 'CO₂ (Global)',
    domain: 'Climate & Environment',
    unit: 'ppm',
    source_org: 'NOAA Global Monitoring Laboratory',
    source_url: 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_gl.csv',
    license: 'Public domain / no known restrictions',
    method: 'Annual mean of monthly averages, exclude -99.99; round to 2 decimals.',
    updated_at: new Date().toISOString().slice(0,10),
    data_start_year: Array.isArray(data) && data.length ? data[0].year : undefined
  })
  return data;
}

if ((import.meta as any).main) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
