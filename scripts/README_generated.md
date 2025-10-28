# Scripts QA Reference

## Bilateral humanitarian aid per capita (USD)

```bash
# API (default)
npx ts-node scripts/fetch_humanitarian_aid_per_capita.ts
# CSV fallback (dev only)
USE_OECD_CSV_FALLBACK=true npx ts-node scripts/fetch_humanitarian_aid_per_capita.ts --allow-fallback
npm run build
```

Expected GAISUM envelope:

```
{
  id: 'humanitarian_aid_per_capita',
  path: '/data/humanitarian_aid_per_capita.json',
  mode: 'api',
  rows: ≳34,
  min_year: 1990,
  max_year: 2023,
  mean: ≈11,
  stdev: ≈5,
  coverage_ok_years: rows,
  dropped_years: 0,
  coverage: [{ year, reporting, eligible, ratio, approximateEligible: false }],
  sample: [{ year, numerator_usd, pop, value }],
}
```

Soft sanity waypoints (USD per person): 1990 ≈ 3, 2000 ≈ 6, 2010 ≈ 12, 2023 ≈ 18–20.
