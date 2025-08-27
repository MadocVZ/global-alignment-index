# Global Alignment Index — Codebase Overview

This repo powers the **Global Alignment Index (GAI)**, a factual, opinion-free dashboard that tracks whether humanity is becoming more aligned — or less — over time.

## Folder Structure

- **app/** — Next.js App Router
  - `layout.tsx`: metadata + global layout.
  - `page.tsx`: homepage, loads JSON from `/public/data`, computes z-scores, renders charts (Recharts).
- **lib/** — helpers
  - `metrics.ts`: registry of metrics (id, name, domain, unit, ↑/↓ better, source).
- **public/data/** — JSON time series per metric (e.g., `co2_ppm.json`, `life_expectancy.json`).
- **docs/** — trust & context
  - `METHODS.md`: aggregation rules and sources.
  - `CHANGELOG.md`: every change logged.
  - `GAI_CONTEXT.md`: mission and scope of the project.
  - `ARCHITECTURE.md`: (this file) overview for newcomers.

## Key Concepts

- **Factual metrics only**: each metric is direction-clear (↑ better or ↓ better).
- **Aggregation (v0.1)**: per-metric z-scores → per-year average for the index (see `docs/METHODS.md`).
- **Tech stack**: Next.js + React, TypeScript, TailwindCSS, Recharts.
- **CI/CD**: GitHub Actions + Vercel → every PR gets a Preview URL; `main` → Production.

## Imports & Paths

- Use the root alias **`@/…`** for imports instead of relative paths.  
  Example:
  ```ts
  import { METRICS } from '@/lib/metrics'
