export const METRICS = [
  { id: 'co2_ppm', name: 'CO₂ concentration', domain: 'Climate & Environment', unit: 'ppm', direction: 'down_is_better', source: 'NOAA/ESRL' },
  { id: 'life_expectancy', name: 'Life expectancy', domain: 'Health & Wellbeing', unit: 'years', direction: 'up_is_better', source: 'WHO/World Bank' },
  { id: 'internet_use', name: 'Individuals using the internet', domain: 'Education & Digital', unit: '%', direction: 'up_is_better', source: 'ITU' },
  { id: 'u5_mortality', name: 'Under-5 mortality', domain: 'Health & Wellbeing', unit: 'per 1,000 live births', direction: 'down_is_better', source: 'UCDP' },
  {
    id: 'death_registration_completeness',
    name: 'Death registration completeness (%) Test',
    domain: 'Truth & Clarity',
    unit: '%',
    direction: 'up_is_better',
    source: 'World Bank WDI',
  },
  {
    id: 'internet_shutdown_days',
    name: 'Internet shutdown days',
    domain: 'Truth & Clarity',
    unit: 'days',
    direction: 'down_is_better',
    source: 'Access Now #KeepItOn / World Bank',
    dataPath: '/data/internet_shutdown_days.json',
    subtitle: 'Population-weighted average shutdown days per year',
    detailPath: '/metrics/internet-shutdown-days',
  },
  {
    id: 'scientific_coauthorship_share',
    name: 'Scientific co-authorship share (%)',
    domain: 'Truth & Clarity',
    unit: '% of articles',
    direction: 'up_is_better',
    source: 'OpenAlex Works API',
    dataPath: '/data/scientific_coauthorship_share.json',
    subtitle: 'Share of articles with ≥2 affiliation countries',
    detailPath: '/metrics/scientific-coauthorship-share',
  },
  {
    id: 'press_freedom_suppression_index',
    name: 'Press Freedom Suppression Index (RSF)',
    domain: 'Truth & Clarity',
    unit: 'index (0–100)',
    direction: 'up_is_better',
    source: 'Reporters Without Borders',
    dataPath: '/data/press_freedom_suppression_index.json',
    subtitle: 'Suppression = 100 − RSF score; population-weighted global mean',
  },
  {
    id: 'dtp3_coverage',
    name: 'DTP3 immunization coverage (%)',
    domain: 'Care',
    unit: '%',
    direction: 'up_is_better',
    source: 'WHO/UNICEF Joint Reporting Form via World Bank',
    dataPath: '/data/dtp3_coverage.json',
    detailPath: '/metrics/dtp3-coverage',
  },
  { id: 'homicide_rate', name: 'Intentional homicide rate per 100 000', domain: 'Safety & Care', unit: 'per 100,000 people', direction: 'down_is_better', source: 'UNODC & WHO via WDI' },
  {
    id: 'military_expenditure_per_capita',
    name: 'Military expenditure per capita (constant 2020 USD)',
    domain: 'Safety & Care',
    unit: 'USD per person',
    direction: 'up_is_better',
    source: 'SIPRI via World Bank WDI',
    dataPath: '/data/military_expenditure_per_capita_constant_usd.json',
  },
  { id: 'firearm_stock_per_100', name: 'Firearm stock per 100 residents', domain: 'Safety & Care', unit: 'firearms per 100 residents', direction: 'up_is_better', source: 'Small Arms Survey; World Bank' },
]

// Adapter to align validator-friendly coverage feeds with UI expectations.
// Keep schema expectations in sync with scripts/validate-datasets.cjs.
const YEAR_MIN = 1800
const YEAR_MAX = 2100

function normaliseYearValue(raw, transform) {
  if (!Array.isArray(raw)) return []
  return raw
    .map(d => {
      const yRaw = d.year ?? d.date ?? d.Year ?? d.TIME ?? d.time
      const year = Number(yRaw)
      const value = transform(d)
      return { year, value }
    })
    .filter(point => Number.isInteger(point.year) && point.year >= YEAR_MIN && point.year <= YEAR_MAX && Number.isFinite(point.value))
    .sort((a, b) => a.year - b.year)
}

export function toYearValuePercent(raw) {
  return normaliseYearValue(raw, d => {
    const vRaw = d.value ?? d.Value ?? d.coverage ?? d.Coverage ?? d.v
    let num = Number(vRaw)
    if (Number.isFinite(num) && num <= 1 && num >= 0) num = num * 100
    if (Number.isFinite(num) && num >= 0 && num <= 100) {
      return Math.round(num * 10) / 10
    }
    return NaN
  })
}

export function toYearValueNumber(raw) {
  return normaliseYearValue(raw, d => Number(d.value ?? d.Value ?? d.v ?? d.amount ?? d.Amount))
}
