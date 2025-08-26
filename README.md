# 🌍 Global Alignment Index (GAI)

The **Global Alignment Index** is a public, factual, and opinion-free dashboard that tracks whether humanity is becoming more aligned — or less aligned — over time.

## Purpose
- Provide a **neutral measurement** across peace, climate, economy, education, health, safety, water, disasters.
- Anchor in **direction‑clear metrics** (↑ better / ↓ better).
- Compare **Alignment vs Capability** growth to reveal whether resonance keeps pace with power.

## Tech
- Next.js + Tailwind + Recharts
- Public JSON datasets under `/public/data`
- GitHub Actions for CI and (later) weekly data refresh

## Quick start
```bash
npm i
npm run dev
# open http://localhost:3000
```

## Deploy (Vercel)
1. Push this repo to GitHub.
2. Vercel → **New Project** → Import repo → Deploy (auto-detects Next.js).
3. (Optional) Add your domain `global-alignment-index.com` in Vercel → Domains.

## Transparency
- Methods: `docs/METHODS.md`
- Changelog: `docs/CHANGELOG.md`
- Data lives in `/public/data/*.json` and originates from open sources (World Bank, WHO, UN, NOAA, etc.).
