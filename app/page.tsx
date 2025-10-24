import HomeClient from './HomeClient'

import { loadSeriesPercent } from '@/lib/metrics'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const dtp3Series = await loadSeriesPercent('/data/dtp3_coverage.json')
  const latest = dtp3Series.at(-1)
  console.log('[home] DTP3 latest:', latest)
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Global Alignment Index</h1>
        <p className="text-slate-600">
          Tracking public, factual metrics for institutional alignment and care.
        </p>
      </header>
      <HomeClient dtp3Series={dtp3Series} />
    </main>
  )
}
