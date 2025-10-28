import Link from 'next/link'

import { loadSeriesNumber } from '@/lib/metrics'
import type { YearValue } from '@/lib/metrics-shared'
import HumanitarianAidChart from './HumanitarianAidChart'

export const revalidate = 0
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATA_PATH = '/data/humanitarian_aid_per_capita.json'
const TOOLTIP_COPY =
  'Humanitarian aid reflects how bilateral donors mobilize resources when crises hit. Tracking per-person support helps flag whether care keeps pace with need.'

function describeRange(series: YearValue[]): string {
  if (!series.length) return '1990 onward'
  const start = series[0].year
  const end = series.at(-1)?.year ?? start
  return `${start}–${end}`
}

export default async function HumanitarianAidPerCapitaPage() {
  const series = await loadSeriesNumber(DATA_PATH)
  const latest = series.at(-1)

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <span aria-hidden className="mr-1">←</span>
        Back to dashboard
      </Link>

      <header className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-emerald-600">International · Care · Tier-1</p>
          <h1 className="text-3xl font-semibold tracking-tight">Bilateral humanitarian aid per capita (USD)</h1>
          <p className="text-base text-slate-600">
            Bilateral humanitarian ODA disbursements (purpose codes 72010/72040/72050) divided by world population.
            {` Series spans ${describeRange(series)}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Up = better</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Unit: USD per person (1 decimal)</span>
          <Link
            href="https://stats.oecd.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-blue-100 px-3 py-1 text-blue-700 hover:bg-blue-200"
          >
            Source: OECD CRS / World Bank WDI
          </Link>
        </div>
      </header>

      {latest ? (
        <section className="card space-y-4 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Latest complete year ({latest.year})</p>
              <p className="text-4xl font-semibold text-slate-900">
                {`$${latest.value.toFixed(1)}`}
                <span aria-hidden className="ml-2 text-base text-emerald-600">↑</span>
              </p>
            </div>
            <p className="max-w-xl text-sm text-slate-600">{TOOLTIP_COPY}</p>
          </div>
          <div className="h-80 w-full">
            <HumanitarianAidChart dataPath={DATA_PATH} initialSeries={series} />
          </div>
        </section>
      ) : (
        <section className="rounded border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-700">
          No recent humanitarian aid data baked yet. Series length {series.length}.
          <div className="mt-2 text-xs text-amber-600">
            Run <code>npx ts-node scripts/fetch_humanitarian_aid_per_capita.ts</code> to generate the dataset.
          </div>
        </section>
      )}
    </main>
  )
}
