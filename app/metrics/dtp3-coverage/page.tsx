import Link from 'next/link'

import { loadSeriesPercent } from '@/lib/metrics'
import type { YearValue } from '@/lib/metrics-shared'
import Dtp3Chart from './Dtp3Chart'

export const revalidate = 0
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATA_PATH = '/data/dtp3_coverage.json'
const TOOLTIP_COPY =
  "DTP3 isn’t about this vaccine — it’s a stress test of care continuity. Reaching ‘dose 3’ means the system reliably finds and serves families."

function computeDomain(series: YearValue[]): [number, number] {
  if (!series.length) return [60, 90]
  const values = series.map(p => p.value)
  const minObs = Math.min(...values)
  const maxObs = Math.max(...values)
  if (minObs === maxObs) {
    return [60, 90]
  }
  return [Math.floor(minObs - 1), Math.ceil(maxObs + 1)]
}

export default async function Dtp3CoveragePage() {
  const series = await loadSeriesPercent(DATA_PATH)
  const earliest = series[0]
  const latest = series.at(-1)
  const domain = computeDomain(series)

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <span aria-hidden className="mr-1">←</span>
        Back to dashboard
      </Link>

      <header className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-emerald-600">Care</p>
          <h1 className="text-3xl font-semibold tracking-tight">DTP3 immunization coverage (%)</h1>
          <p className="text-base text-slate-600">
            Population-weighted global mean of national DTP3 coverage rates.
            {earliest && latest ? ` Series spans ${earliest.year}–${latest.year}.` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Up = better</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Unit: percent (1 decimal)</span>
          <Link
            href="https://data.worldbank.org/indicator/SH.IMM.IDPT"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-blue-100 px-3 py-1 text-blue-700 hover:bg-blue-200"
          >
            Source: WHO/UNICEF / WDI
          </Link>
        </div>
      </header>

      {latest ? (
        <section className="card space-y-4 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Latest complete year ({latest.year})</p>
              <p className="text-4xl font-semibold text-slate-900">
                {latest.value.toFixed(1)}%
                <span aria-hidden className="ml-2 text-base text-emerald-600">↑</span>
              </p>
            </div>
            <p className="max-w-xl text-sm text-slate-600">{TOOLTIP_COPY}</p>
          </div>
          <div className="h-80 w-full">
            <Dtp3Chart series={series} domain={domain} />
          </div>
        </section>
      ) : (
        <section className="rounded border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-700">
          No recent data. Series length {series.length}.
        </section>
      )}
    </main>
  )
}
