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
      const coverageCandidate = (() => {
        const explicit = Number(r.coverage ?? r.rate ?? r.fraction ?? r.mean_fraction);
        if (Number.isFinite(explicit)) {
          if (explicit > 1) {
            return explicit / 100;
          }
          return explicit;
        }
        const percentCandidate = Number(
          typeof r.value === 'number'
            ? r.value
            : r.Value ?? r.val ?? r.v ?? r.meanPercent ?? r.mean_percent,
        );
        if (Number.isFinite(percentCandidate)) {
          return percentCandidate / 100;
        }
        return NaN;
      })();
      const nIsoCandidate = Number(
        typeof r.n_iso === 'number'
          ? r.n_iso
          : r.iso_count ?? r.n_countries ?? r.countries ?? r.joined ?? 0,
      );
      const nPopCandidate = Number(
        typeof r.n_pop === 'number'
          ? r.n_pop
          : r.n_iso_universe ?? r.iso_universe ?? r.population_count ?? r.n_universe ?? 0,
      );
      const nIso = Number.isFinite(nIsoCandidate) ? Math.max(0, Math.round(nIsoCandidate)) : 0;
      const nPopBase = Number.isFinite(nPopCandidate) ? Math.max(nIso, Math.round(nPopCandidate)) : nIso;
      const coverage = Number.isFinite(coverageCandidate)
        ? Math.min(1, Math.max(0, coverageCandidate))
        : NaN;
      return { year, coverage, n_iso: nIso, n_pop: nPopBase };
    })
    .filter((r) => Number.isInteger(r.year) && Number.isFinite(r.coverage))
    .sort((a, b) => a.year - b.year)
    .filter((r, i, arr) => i === 0 || r.year !== arr[i - 1].year);

  await fs.writeFile(p, JSON.stringify(fixed, null, 2));
  console.log('✅ Repaired', fixed.length, 'items; first:', fixed[0]);
})();
