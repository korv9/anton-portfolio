import { fetchData, resolveDataUrl } from '../dataSource'

export type Indicator = {
  indicator_key: string
  source_key: string
  source_code: string
  indicator_name: string
  unit: string | null
  domain: string
  welfare_dimension: string | null
  higher_is_better: boolean | null
  description: string | null
  source_name: string
  publisher: string
  homepage_url: string
  citation: string
  first_year: number | null
  last_year: number | null
  last_period: string | null
  regions: number | null
  observations: number | null
}
export type Region = {
  region_code: string
  region_name: string
  region_level: 'country' | 'county' | 'municipality' | 'aggregate' | 'nuts2'
  county_code: string | null
  nuts2_code: string | null
}
export type Headline = {
  indicator_key: string
  age_group_key: string
  period_key: string
  period_label: string
  value: number
  ci_low: number | null
  ci_high: number | null
  previous_period_label: string | null
  previous_value: number | null
}
export type CountyYear = {
  region_code: string
  region_name: string
  year: number
  unemployment_rate_pct: number | null
  unemployment_rate_moe: number | null
  sick_pay_rate_days: number | null
  stress_cases_per_1000: number | null
  serious_mental_strain_pct: number | null
  population: number | null
}
/** One row of the denormalised welfare Parquet (fct_indicator with its dimensions). */
export type IndicatorRow = {
  indicator_key: string
  region_code: string
  region_name: string
  region_level: string
  period_key: string
  period_type: string
  reference_year: number
  start_date: string
  end_date: string
  sex_key: string
  age_group_key: string
  value: number
  ci_low: number | null
  ci_high: number | null
  sample_size: number | null
}

export const DOMAINS: Record<string, [string, string]> = {
  jobb: ['Jobs', 'Jobb'],
  arbetsliv: ['Working life', 'Arbetsliv'],
  ekonomi: ['Economy', 'Ekonomi'],
  mental_halsa: ['Mental health', 'Mental hälsa'],
  halsa: ['Health', 'Hälsa'],
  tillit_varderingar: ['Trust & values', 'Tillit och värderingar'],
  trygghet: ['Safety', 'Trygghet'],
  politik: ['Politics', 'Politik'],
  utbildning: ['Education', 'Utbildning'],
  befolkning: ['Population', 'Befolkning'],
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetchData(path)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

/**
 * Bytes of a delivered Parquet part. Object storage first, as the delivery manifest says;
 * the site's own copy when that fails, which is the case in development and between an
 * export and its first upload.
 */
async function parquetBytes(path: string): Promise<ArrayBuffer> {
  const remote = await resolveDataUrl(path)
  try {
    const response = await fetch(remote)
    if (response.ok) return response.arrayBuffer()
  } catch {
    /* fall through to the local copy */
  }
  const local = await fetch('data/' + path)
  if (!local.ok) throw new Error(`${path}: HTTP ${local.status}`)
  return local.arrayBuffer()
}

/** Parquet DATE columns arrive as Date objects; the charts want 'YYYY-MM-DD'. */
function isoDate(value: unknown) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10)
}

const cache = new Map<string, Promise<IndicatorRow[]>>()

/** Every indicator row of one source, parsed once per page load. */
export function loadSourceRows(source: string): Promise<IndicatorRow[]> {
  if (!cache.has(source)) {
    const path = `parquet/welfare_indicator/source=${source}/part-0.parquet`
    cache.set(
      source,
      Promise.all([parquetBytes(path), import('hyparquet')]).then(
        async ([buffer, { parquetReadObjects }]) => {
          const rows = await parquetReadObjects({ file: buffer })
          return rows.map((row) => ({
            ...row,
            start_date: isoDate(row.start_date),
            end_date: isoDate(row.end_date),
            reference_year: Number(row.reference_year),
            value: Number(row.value),
          })) as IndicatorRow[]
        },
      ),
    )
    cache.get(source)!.catch(() => cache.delete(source))
  }
  return cache.get(source)!
}

export function formatValue(value: number, unit: string | null) {
  const digits = Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 100 ? 1 : 2
  const text = value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  })
  return unit && unit.startsWith('procent') ? `${text} %` : text
}
