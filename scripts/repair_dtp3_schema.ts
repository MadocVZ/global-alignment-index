import fs from 'node:fs/promises';

(async () => {
  const p = 'public/data/dtp3_coverage.json';
  const raw = await fs.readFile(p, 'utf8');
  let data: any = JSON.parse(raw);

  // Unwrap if wrapped like { series: [...] }
  if (!Array.isArray(data)) {
    const key = Object.keys(data).find((k) => Array.isArray((data as any)[k]));
    if (key) data = (data as any)[key];
  }
  if (!Array.isArray(data)) throw new Error('Not an array after unwrap');

  const fixed = data
    .filter(Boolean)
    .map((r: any) => ({
      year: Number(r.year ?? r.Year ?? r.date),
      value: Number(
        typeof r.value === 'number'
          ? r.value
          : r.Value ?? r.coverage ?? r.val ?? r.v,
      ),
    }))
    .filter((r) => Number.isInteger(r.year) && Number.isFinite(r.value))
    .map((r) => ({ year: r.year, value: Math.round(r.value * 10) / 10 }))
    .sort((a, b) => a.year - b.year)
    .filter((r, i, arr) => i === 0 || r.year !== arr[i - 1].year);

  await fs.writeFile(p, JSON.stringify(fixed, null, 2));
  console.log('✅ Repaired', fixed.length, 'items; first:', fixed[0]);
})();
