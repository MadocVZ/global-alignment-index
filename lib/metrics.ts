export type Direction = 'up_is_better' | 'down_is_better'

export type Metric = {
  id: string
  name: string
  domain: string
  unit: string
  direction: Direction
  source: string
}

export const METRICS: Metric[] = [
  { id: 'co2_ppm', name: 'CO₂ concentration', domain: 'Climate & Environment', unit: 'ppm', direction: 'down_is_better', source: 'NOAA/ESRL' },
  { id: 'life_expectancy', name: 'Life expectancy', domain: 'Health & Wellbeing', unit: 'years', direction: 'up_is_better', source: 'WHO/World Bank' },
  { id: 'internet_use', name: 'Individuals using the internet', domain: 'Education & Digital', unit: '%', direction: 'up_is_better', source: 'ITU' },
  { id: 'extreme_poverty', name: 'Extreme poverty ($2.15)', domain: 'Economics & Poverty', unit: '%', direction: 'down_is_better', source: 'World Bank' },
]
