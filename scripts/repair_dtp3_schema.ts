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
    .map((r: any) => {
      const year = Number(r.year ?? r.Year ?? r.date);
      const valueRaw = Number(
        typeof r.value === 'number'
          ? r.value
          : r.Value ?? r.coverage ?? r.val ?? r.v ?? r.meanPercent ?? r.mean_percent,
      );
      const percent = Number.isFinite(valueRaw)
        ? valueRaw
        : Number(r.coverage ?? r.rate ?? r.fraction) * 100;
      return {
        year,
        value: Math.round(Math.max(0, Math.min(100, Number(percent))) * 10) / 10,
      };
    })
    .filter(
      (r) =>
        Number.isInteger(r.year) &&
        Number.isFinite(r.value) &&
        r.value >= 0 &&
        r.value <= 100 &&
        Math.round(r.value * 10) === r.value * 10,
    )
    .sort((a, b) => a.year - b.year)
    .filter((r, i, arr) => i === 0 || r.year !== arr[i - 1].year);

  await fs.writeFile(p, JSON.stringify(fixed, null, 2));
  console.log('✅ Repaired', fixed.length, 'items; first:', fixed[0]);
})();
