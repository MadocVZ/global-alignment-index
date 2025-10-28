import { METRICS, toYearValueNumber, toYearValuePercent } from './metrics-shared.js'
import type { AnyPoint, Direction, Metric, YearValue } from './metrics-shared.js'

async function readPublicJson<T = unknown>(rel: string): Promise<T | null> {
  try {
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const clean = rel.replace(/^\/+/, '')
    const file = join(process.cwd(), 'public', clean)
    const txt = await readFile(file, 'utf8')
    return JSON.parse(txt) as T
  } catch (e) {
    return null
  }
}

export async function loadSeriesPercent(pathStr: string): Promise<YearValue[]> {
  const fsData = await readPublicJson<AnyPoint[]>(pathStr)
  let series: YearValue[] = []
  if (fsData) {
    series = toYearValuePercent(fsData)
    console.log(
      '[metrics/fs] loaded',
      pathStr,
      'len=',
      series.length,
      'sampleRawKeys=',
      Array.isArray(fsData) && fsData[0] ? Object.keys(fsData[0]) : [],
      'first=',
      series[0],
      'last=',
      series.at(-1)
    )
    return series
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${pathStr}`).catch(() => null as any)
  if (!res?.ok) {
    console.warn('[metrics/fetch] failed to load series', pathStr, res?.status, res?.statusText)
    return []
  }
  const raw = (await res.json()) as AnyPoint[]
  series = toYearValuePercent(raw)
  console.log(
    '[metrics/fetch] loaded',
    pathStr,
    'len=',
    series.length,
    'sampleRawKeys=',
    Array.isArray(raw) && raw[0] ? Object.keys(raw[0]) : [],
    'first=',
    series[0],
    'last=',
    series.at(-1)
  )
  return series
}

export async function loadSeriesNumber(pathStr: string): Promise<YearValue[]> {
  const fsData = await readPublicJson<AnyPoint[]>(pathStr)
  let series: YearValue[] = []
  if (fsData) {
    series = toYearValueNumber(fsData)
    console.log(
      '[metrics/fs] loaded-number',
      pathStr,
      'len=',
      series.length,
      'sampleRawKeys=',
      Array.isArray(fsData) && fsData[0] ? Object.keys(fsData[0]) : [],
      'first=',
      series[0],
      'last=',
      series.at(-1)
    )
    return series
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${pathStr}`).catch(() => null as any)
  if (!res?.ok) {
    console.warn('[metrics/fetch] failed to load number series', pathStr, res?.status, res?.statusText)
    return []
  }
  const raw = (await res.json()) as AnyPoint[]
  series = toYearValueNumber(raw)
  console.log(
    '[metrics/fetch] loaded-number',
    pathStr,
    'len=',
    series.length,
    'sampleRawKeys=',
    Array.isArray(raw) && raw[0] ? Object.keys(raw[0]) : [],
    'first=',
    series[0],
    'last=',
    series.at(-1)
  )
  return series
}

export { METRICS, toYearValuePercent, toYearValueNumber }
export type { Direction, Metric, YearValue }
