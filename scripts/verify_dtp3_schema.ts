import fs from 'node:fs/promises';

// Keep EXPECTED_KEYS in sync with scripts/validate-datasets.cjs coverage branch (coverage files expect ["year","coverage","n_iso","n_pop"]).
const EXPECTED_KEYS = ['year', 'coverage', 'n_iso', 'n_pop'];

(async () => {
  const p = 'public/data/dtp3_coverage.json';
  const raw = await fs.readFile(p, 'utf8');
  const a = JSON.parse(raw);
  const fail = (m: string) => {
    console.error(m);
    process.exit(1);
  };

  if (!Array.isArray(a) || a.length === 0) fail('Not an array or empty');
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const keys = Object.keys(x ?? {}).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...EXPECTED_KEYS].sort())) fail(`Bad keys at ${i}: ${keys}`);
    if (!Number.isInteger(x.year)) fail(`year not int at ${i}`);
    if (typeof x.coverage !== 'number' || Number.isNaN(x.coverage)) fail(`coverage not number at ${i}`);
    if (x.coverage < 0 || x.coverage > 1) fail(`coverage out of [0,1] at ${i}`);
    if (!Number.isInteger(x.n_iso) || x.n_iso < 0) fail(`n_iso invalid at ${i}`);
    if (!Number.isInteger(x.n_pop) || x.n_pop < x.n_iso) fail(`n_pop invalid at ${i}`);
  }
  for (let i = 1; i < a.length; i++) {
    if (a[i].year !== a[i - 1].year + 1) fail(`years not contiguous at ${i}`);
  }
  console.log('✅ verify_dtp3_schema OK:', a[0], '…', a[a.length - 1]);
})();
