import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseCsv } from "./lib/csv.ts";

const JSON_PATH = resolve(process.cwd(), "data/raw/wld_population.json");
const CSV_PATH = resolve(process.cwd(), "data/raw/wb_population_total.csv");

export async function getWorldPopulationSeries(): Promise<Map<number, number>> {
  const map = new Map<number, number>();

  try {
    const text = await readFile(JSON_PATH, "utf8");
    const rows = JSON.parse(text) as Array<{ year?: number; pop?: number; population?: number }>;
    for (const entry of rows) {
      const year = Number(entry.year);
      const pop = Number(entry.pop ?? entry.population);
      if (Number.isInteger(year) && Number.isFinite(pop) && pop > 0) {
        map.set(year, pop);
      }
    }
  } catch (jsonError) {
    console.warn(`[wdi] WARN unable to read ${JSON_PATH}: ${String(jsonError)}`);
  }

  if (map.size) {
    return map;
  }

  try {
    const text = await readFile(CSV_PATH, "utf8");
    const rows = parseCsv(text);
    if (!rows.length) {
      throw new Error("wb_population_total.csv empty");
    }
    const header = rows[0];
    const yearIndex = header.findIndex((value) => value.toLowerCase() === "year");
    const popIndex = header.findIndex((value) => value.toLowerCase().startsWith("pop"));
    if (yearIndex === -1 || popIndex === -1) {
      throw new Error("wb_population_total.csv missing year/population columns");
    }
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const year = Number(row[yearIndex]);
      const pop = Number(row[popIndex]);
      if (Number.isInteger(year) && Number.isFinite(pop) && pop > 0) {
        map.set(year, pop);
      }
    }
  } catch (csvError) {
    throw new Error(`[wdi] unable to load world population series: ${String(csvError)}`);
  }

  if (!map.size) {
    throw new Error("[wdi] world population series empty");
  }

  return map;
}
