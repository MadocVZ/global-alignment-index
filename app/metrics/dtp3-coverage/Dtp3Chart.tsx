'use client'

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

type Props = {
  series: YearValue[]
  domain: [number, number]
}

export default function Dtp3Chart({ series, domain }: Props) {
  if (!series?.length) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-amber-500">
        Awaiting recent data. (series length: {series?.length ?? 0})
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" interval="preserveStartEnd" />
        <YAxis domain={domain} tickFormatter={value => `${value.toFixed(1)}%`} />
        <Tooltip content={renderTooltipContent} />
        <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
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
