'use client'

import { useEffect, useState } from 'react'

type SourceMeta = {
  name?: string
  domain?: string
  unit?: string
  source_org?: string
  source_url?: string
  updated_at?: string
}

export default function SourcesFooter() {
  const [sources, setSources] = useState<Record<string, SourceMeta>>({})

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/data/sources.json', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        setSources(json)
      } catch (err) {
        console.error(err)
      }
    }
    load()
  }, [])

  const entries = Object.entries(sources)
  if (!entries.length) return null

  return (
    <section className="text-sm opacity-70 py-10">
      <h2 className="text-base font-medium mb-2">Data Sources / Thanks</h2>
      <ul className="space-y-1">
        {entries.map(([id, s]) => (
          <li key={id}>
            <span className="font-medium">{s.name}</span>{' '}
            {s.source_org && s.source_url ? (
              <a className="underline" href={s.source_url} target="_blank" rel="noreferrer">
                {s.source_org}
              </a>
            ) : (
              s.source_org
            )}
            {s.unit && ` · ${s.unit}`}
            {s.domain && ` · ${s.domain}`}
            {s.updated_at && ` · updated ${s.updated_at}`}
          </li>
        ))}
      </ul>
    </section>
  )
}
