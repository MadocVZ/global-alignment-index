'use client'

import { useEffect, useMemo, useState } from 'react'
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

import type { YearValue } from '@/lib/metrics-shared'

const fetchVersion = process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev'

type Props = {
  dataPath: string
  initialSeries: YearValue[]
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

type State = {
  status: Status
  series: YearValue[]
}

function computeDomain(series: YearValue[]): [number, number] {
  if (!series.length) return [0, 20]
  const values = series.map(point => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    const pad = Math.max(1, min * 0.05)
    return [Math.max(0, min - pad), min + pad]
  }
  const pad = Math.max(1, (max - min) * 0.05)
  return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
}

function normalise(raw: unknown): YearValue[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(item => {
      const year = Number((item as Record<string, unknown>)?.year)
      const value = Number((item as Record<string, unknown>)?.value)
      return { year, value }
    })
    .filter(point => Number.isInteger(point.year) && Number.isFinite(point.value))
    .sort((a, b) => a.year - b.year)
}

export default function HumanitarianAidChart({ dataPath, initialSeries }: Props) {
  const [state, setState] = useState<State>(() => ({
    status: initialSeries.length ? 'ready' : 'idle',
    series: initialSeries,
  }))

  useEffect(() => {
    if (initialSeries.length) return
    let cancelled = false
    const load = async () => {
      setState(prev => ({ ...prev, status: 'loading' }))
      try {
        const res = await fetch(`${dataPath}?v=${fetchVersion}`, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const raw = await res.json()
        const cleaned = normalise(raw)
        if (!cleaned.length) {
          throw new Error('empty')
        }
        if (!cancelled) {
          setState({ status: 'ready', series: cleaned })
        }
      } catch (error) {
        console.warn('[humanitarian-aid] WARN client fetch failed', error)
        if (!cancelled) {
          setState(prev => ({ ...prev, status: 'error' }))
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [dataPath, initialSeries.length])

  const { status, series } = state
  const domain = useMemo(() => computeDomain(series), [series])

  if (!series.length) {
    const message =
      status === 'loading'
        ? 'Loading humanitarian aid per capita…'
        : status === 'error'
          ? 'Data not yet baked for this branch.'
          : 'Awaiting humanitarian aid data.'
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-amber-500">
        {message} (series length: {series.length})
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" interval="preserveStartEnd" />
        <YAxis domain={domain} tickFormatter={value => `$${Number(value).toFixed(1)}`} />
        <Tooltip content={renderTooltip} />
        <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function renderTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  if (typeof value !== 'number') return null
  return (
    <div className="rounded bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow">
      {`${label} — $${value.toFixed(1)} per person`}
    </div>
  )
}
