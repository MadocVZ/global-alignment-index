export function makeAnnualMean(
  rows: string[][],
  cfg: { yearCol: number; valueCol: number; missingValue: number }
): { year: number; value: number }[] {
  const groups = new Map<number, number[]>();
  for (const row of rows) {
    const year = Number(row[cfg.yearCol]);
    const value = Number(row[cfg.valueCol]);
    if (!Number.isFinite(year)) continue;
    if (value === cfg.missingValue || !Number.isFinite(value)) continue;
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(value);
  }
  const result = [] as { year: number; value: number }[];
  for (const [year, values] of groups.entries()) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    result.push({ year, value: Math.round(mean * 100) / 100 });
  }
  return result.sort((a, b) => a.year - b.year);
}
