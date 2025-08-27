# Methods (v0.1)

- Alignment Index: z‑score per metric, average per year (placeholder).
- Domains: group metrics and average.
- Capability Index: TBD (GDP pc, energy pc, R&D % GDP, diffusion).
- Transparency: sources listed per metric; changes logged in CHANGELOG.

## Pipelines (overview)
- scripts/pipelines/<metric>.ts → fetches raw data; writes /public/data/<metric>.json
- Annualization: simple arithmetic mean of valid monthly values; excludes placeholders (e.g., -99.99)
- CO₂ source: NOAA Global monthly mean CO₂ (ppm), see pipeline
