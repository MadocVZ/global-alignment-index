export type Direction = 'up_is_better' | 'down_is_better'

export type YearValue = { year: number; value: number }
export type AnyPoint = { year?: number; date?: number; value?: number; coverage?: number; [k: string]: any }

export type Metric = {
  id: string
  name: string
  domain: string
  unit: string
  direction: Direction
  source: string
  dataPath?: string
  subtitle?: string
  detailPath?: string
}

export declare const METRICS: Metric[]

export declare function toYearValuePercent(raw: AnyPoint[]): YearValue[]
