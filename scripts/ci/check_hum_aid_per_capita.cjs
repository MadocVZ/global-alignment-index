#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const GAISUM_PATH = join(process.cwd(), 'scripts', 'logs', 'humanitarian_aid_per_capita.gaisum.json');

function fail(message) {
  console.error(`[check:hum] FAIL ${message}`);
  process.exit(1);
}

function main() {
  let payload;
  try {
    const text = readFileSync(GAISUM_PATH, 'utf8');
    payload = JSON.parse(text);
  } catch (error) {
    fail(`unable to read GAISUM log at ${GAISUM_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!payload || typeof payload !== 'object') {
    fail('GAISUM payload missing or invalid');
  }

  const { mode, rows, mean, coverage } = payload;
  if (mode !== 'api') {
    fail(`mode must equal "api" (received ${JSON.stringify(mode)})`);
  }

  if (typeof rows !== 'number' || rows < 30) {
    fail(`rows must be ≥ 30 (received ${rows})`);
  }

  if (typeof mean !== 'number' || mean < 6 || mean > 25) {
    fail(`mean must lie within [6, 25] (received ${mean})`);
  }

  if (!Array.isArray(coverage)) {
    fail('coverage array missing from GAISUM payload');
  }

  const violations = coverage
    .filter((entry) => entry && typeof entry === 'object')
    .filter((entry) => {
      const ratio = Number(entry.ratio);
      return Number.isFinite(ratio) && ratio < 0.9;
    });

  if (violations.length > 0) {
    const years = violations.map((entry) => entry.year).filter((year) => typeof year === 'number');
    fail(`coverage ratios below 0.90 detected for years: ${years.join(', ') || 'unknown'}`);
  }

  console.log(`check:hum ok — mode=${mode}, rows=${rows}, mean=${mean.toFixed(2)}`);
}

main();
