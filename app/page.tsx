'use client'
import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { METRICS } from '../lib/metrics'

type Pt = { year: number; value: number }
async function load(id: string): Promise<Pt[]> {
  const res = await fetch(`/data/${id}.json`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export default function Home() {
  const [data, setData] = useState<Record<string, Pt[]>>({})
  useEffect(() => {
    METRICS.forEach(async m => {
      const series = await load(m.id)
      setData(prev => ({ ...prev, [m.id]: series }))
    })
  }, [])

  const aggregate = useMemo(() => {
    const keys = Object.keys(data)
    if (!keys.length) return []
    const years = Array.from(new Set(keys.flatMap(k => data[k].map(p => p.year)))).sort()
    const z = (arr:number[]) => {
      const mean = arr.reduce((a,b)=>a+b,0)/arr.length
      const sd = Math.sqrt(arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length) || 1
      return arr.map(v => (v-mean)/sd)
    }
    const seriesZ: Record<string, Map<number, number>> = {}
    keys.forEach(k => {
      const vals = data[k].map(p => p.value)
      const y = data[k].map(p => p.year)
      const zs = z(vals)
      seriesZ[k] = new Map(y.map((yy, i) => [yy, zs[i]]))
    })
    return years.map(yy => {
      const zs = keys.map(k => seriesZ[k].get(yy)).filter(v => v!==undefined) as number[]
      if (!zs.length) return null
      return { year: yy, value: Number((zs.reduce((a,b)=>a+b,0)/zs.length).toFixed(2)) }
    }).filter(Boolean) as Pt[]
  }, [data])

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Global Alignment Index <span className="text-sm opacity-70">v0.1</span></h1>
          <p className="opacity-70">Factual signals; no opinions. A simple aggregate line + domain charts (mock data for now).</p>
        </div>
      </header>

      <section className="card p-4">
        <h2 className="text-xl mb-2">Whole Alignment Trend (aggregate, mock)</h2>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={aggregate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm opacity-70 mt-2">Method: per-year z‑score average of available series (placeholder).</p>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        {Object.keys(data).map((k, i) => (
          <div key={k} className="card p-4">
            <h3 className="text-lg font-medium">{METRICS.find(m=>m.id===k)?.name}</h3>
            <div className="w-full h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data[k]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm opacity-70 mt-2">{METRICS.find(m=>m.id===k)?.domain}</p>
          </div>
        ))}
      </section>

      <footer className="text-sm opacity-70 py-10">
        <p>Sources: NOAA, WHO, World Bank, ITU (real datasets to be wired). This is a v0.1 prototype.</p>
      </footer>
    </main>
  )
}
