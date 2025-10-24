import fs from 'node:fs/promises';

(async () => {
  const raw = await fs.readFile('public/data/dtp3_coverage.json', 'utf8');
  const data = JSON.parse(raw);
  const first = Array.isArray(data) ? data[0] : undefined;
  const keys = first ? Object.keys(first) : [];
  const charCodes = keys.map((key) => key.split('').map((ch) => ch.charCodeAt(0)));
  console.log('first_item_keys:', keys, 'charCodes:', charCodes);
  console.log('first_item:', first);
})();
