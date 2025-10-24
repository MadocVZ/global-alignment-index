import fs from 'node:fs/promises'

import { toYearValuePercent } from '../lib/metrics'

;(async () => {
  const raw = JSON.parse(await fs.readFile('public/data/dtp3_coverage.json', 'utf8'))
  const series = toYearValuePercent(raw)
  console.log('len=', series.length, 'first=', series[0], 'last=', series.at(-1))
})()
