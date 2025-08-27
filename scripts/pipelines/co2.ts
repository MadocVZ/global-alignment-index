import { parseCsv } from '../lib/csv.ts';
import { makeAnnualMean } from '../lib/annualize.ts';
import { writeJson } from '../lib/io.ts';

export async function run() {
  const res = await fetch('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_gl.csv');
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text, { commentPrefix: '#'});
  const data = makeAnnualMean(rows, { yearCol: 0, valueCol: 3, missingValue: -99.99 });
  await writeJson('public/data/co2_ppm.json', data);
  return data;
}

if ((import.meta as any).main) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
