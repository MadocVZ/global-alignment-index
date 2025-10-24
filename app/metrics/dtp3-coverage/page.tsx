'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipProps } from 'recharts'

const DATA_PATH = '/data/dtp3_coverage.json'
const fetchVersion = process.env.NEXT_PUBLIC_COMMIT_SHA ?? Date.now().toString()

const TOOLTIP_COPY =
  "DTP3 isn’t about this vaccine — it’s a stress test of care continuity. Reaching ‘dose 3’ means the system reliably finds and serves families."

type RawPoint = { year: number; value: number }
type Point = { year: number; value: number }

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  series: Point[]
  error?: string
}

const INITIAL_STATE: State = { status: 'idle', series: [] }

function domainFor(series: Point[]): [number, number] {
  if (!series.length) return [60, 90]
  const values = series.map(p => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [60, 90]
  }
  return [Math.floor(min - 1), Math.ceil(max + 1)]
}

export default function Dtp3CoveragePage() {
  const [state, setState] = useState<State>(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setState(prev => ({ ...prev, status: 'loading', error: undefined }))
      try {
        const res = await fetch(`${DATA_PATH}?v=${fetchVersion}`, { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) {
            setState({ status: 'error', series: [], error: 'Data not yet baked for this branch.' })
          }
          return
        }
        const raw = (await res.json()) as RawPoint[]
        const cleaned = Array.isArray(raw)
          ? raw
              .map(p => ({
                year: Number(p.year),
                value: Number(p.value),
              }))
              .filter(
                p =>
                  Number.isInteger(p.year) &&
                  Number.isFinite(p.value) &&
                  p.value >= 0 &&
                  p.value <= 100 &&
                  Math.round(p.value * 10) === p.value * 10,
              )
              .sort((a, b) => a.year - b.year)
          : []
        if (!cleaned.length) {
          if (!cancelled) {
            setState({ status: 'error', series: [], error: 'Data not yet baked for this branch.' })
          }
          return
        }
        if (!cancelled) {
          setState({ status: 'ready', series: cleaned })
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', series: [], error: 'Data not yet baked for this branch.' })
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const { status, series, error } = state
  const latest = series.at(-1)
  const earliest = series[0]
  const domain = useMemo(() => domainFor(series), [series])

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

      {status === 'loading' ? (
        <p className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Loading DTP3 coverage…
        </p>
      ) : null}

      {status === 'error' && error ? (
        <p className="rounded border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-700">{error}</p>
      ) : null}

      {status === 'ready' && series.length ? (
        <section className="card space-y-4 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            {latest ? (
              <div>
                <p className="text-sm text-slate-500">Latest complete year ({latest.year})</p>
                <p className="text-4xl font-semibold text-slate-900">
                  {latest.value.toFixed(1)}%
                  <span aria-hidden className="ml-2 text-base text-emerald-600">↑</span>
                </p>
              </div>
            ) : null}
            <p className="max-w-xl text-sm text-slate-600">{TOOLTIP_COPY}</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" interval="preserveStartEnd" />
                <YAxis domain={domain} tickFormatter={value => `${value.toFixed(1)}%`} />
                <Tooltip content={renderTooltipContent} />
                <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
    </main>
  )
}

function renderTooltipContent({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  if (typeof value !== 'number') return null
  return (
    <div className="rounded bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow">
      {`${label} — ${value.toFixed(1)}%`}
    </div>
  )
}
