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
      const percentValue = Number(
        typeof r.value === 'number'
          ? r.value
          : r.Value ?? r.coverage ?? r.val ?? r.v,
      );
      const fraction = Number.isFinite(percentValue)
        ? percentValue / 100
        : Number(r.coverage ?? r.rate ?? r.fraction);
      const nIsoRaw = Number(r.n_iso ?? r.iso_count ?? r.iso ?? r.count ?? r.countries ?? 0);
      const nPopRaw = Number(r.n_pop ?? r.population ?? r.pop_count ?? 0);
      const nIso = Number.isFinite(nIsoRaw) && nIsoRaw > 0 ? Math.round(nIsoRaw) : 1;
      const nPop = Number.isFinite(nPopRaw) && nPopRaw >= nIso ? Math.round(nPopRaw) : nIso;
      return {
        year,
        coverage: Math.round(Math.max(0, Math.min(1, Number(fraction))) * 1000) / 1000,
        n_iso: nIso,
        n_pop: nPop,
      };
    })
    .filter(
      (r) =>
        Number.isInteger(r.year) &&
        Number.isFinite(r.coverage) &&
        r.coverage >= 0 &&
        r.coverage <= 1 &&
        Number.isInteger(r.n_iso) &&
        Number.isInteger(r.n_pop) &&
        r.n_iso > 0 &&
        r.n_pop >= r.n_iso,
    )
    .sort((a, b) => a.year - b.year)
    .filter((r, i, arr) => i === 0 || r.year !== arr[i - 1].year);

  await fs.writeFile(p, JSON.stringify(fixed, null, 2));
  console.log('✅ Repaired', fixed.length, 'items; first:', fixed[0]);
})();
