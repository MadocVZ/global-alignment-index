import { readFileSync } from "node:fs";
import { join } from "node:path";

type YearValue = { year: number; value: number };

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  const dataPath = join(process.cwd(), "public", "data", "humanitarian_aid_per_capita.json");
  const raw = readFileSync(dataPath, "utf8");
  const series = JSON.parse(raw) as YearValue[];

  assertCondition(Array.isArray(series), "series must be an array");
  assertCondition(series.length >= 30, `series must contain ≥30 rows (found ${series.length})`);

  const years = series.map((row) => row.year);
  const sortedYears = [...years].sort((a, b) => a - b);
  assertCondition(
    years.every((year, idx) => year === sortedYears[idx]),
    "series must be sorted ascending by year",
  );

  for (const point of series) {
    assertCondition(Number.isInteger(point.year), `year must be integer (found ${point.year})`);
    assertCondition(typeof point.value === "number" && Number.isFinite(point.value), "value must be finite number");
    assertCondition(point.value >= 0, "value must be non-negative");
  }

  const firstYear = series[0]?.year ?? 0;
  const lastYear = series.at(-1)?.year ?? 0;
  assertCondition(firstYear <= 1992, `expected first year near 1990 (found ${firstYear})`);
  assertCondition(lastYear >= 2020, `expected coverage through 2020s (found ${lastYear})`);

  const lastValue = series.at(-1)?.value ?? 0;
  assertCondition(lastValue <= 30, `latest value should be ≤30 (found ${lastValue})`);

  console.log(
    `[hum-regression] ok len=${series.length} range=${firstYear}-${lastYear} latest=$${lastValue.toFixed(1)}`,
  );
}

main();
