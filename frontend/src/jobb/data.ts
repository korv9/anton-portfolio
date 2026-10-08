/**
 * The job-market product's data: one file, jobs/market.json, with every ad in
 * Arbetsförmedlingen's historical archives since 2020 counted by month, occupation field,
 * occupation group (SSYK 4) and county. Helpers here sum it for any set of fields, so every
 * view answers for the fields chosen in the field bar (none chosen means the whole market).
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import { FIELD_EN, type Market } from '../jobs/JobMarketPage'

export type { Market }

let cached: Promise<Market> | null = null
export const loadMarket = () =>
  (cached ??= fetchJson<Market>('jobs/market.json'))

export function useMarket() {
  const [data, setData] = useState<Market | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadMarket()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])
  return { data, error }
}

export const fieldName = (name: string) => l(FIELD_EN[name] ?? name, name)

export const number = (value: number) =>
  Math.round(value).toLocaleString(l('en-GB', 'sv-SE'))
export const change = (now: number, before: number | undefined | null) =>
  before ? ((now - before) / before) * 100 : null
export const signedPct = (value: number | null, digits = 0) =>
  value == null
    ? '–'
    : `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(
        value,
      ).toLocaleString(l('en-GB', 'sv-SE'), {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })} %`
export const share = (value: number, digits = 0) =>
  `${value.toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`

const MONTHS_SV = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
]
const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const MONTHS_LONG_SV = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
]
const MONTHS_LONG_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const monthShort = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${l(MONTHS_EN[m - 1], MONTHS_SV[m - 1])} ${y}`
}
/** 'January–June' for the months the latest year covers. */
export const ytdLabel = (months: number) =>
  months >= 12
    ? l('the whole year', 'hela året')
    : l(
        `January–${MONTHS_LONG_EN[months - 1]}`,
        `januari–${MONTHS_LONG_SV[months - 1]}`,
      )

/** The fields to sum: the chosen ones, or 'all' (the market as a whole). */
export const keysOf = (fields: string[]) => (fields.length ? fields : ['all'])

/** Ads per month for a set of fields, summed. */
export function monthlyAds(data: Market, fields: string[]) {
  const totals = new Map<string, number>()
  for (const key of keysOf(fields))
    for (const [month, ads] of data.monthly[key] ?? [])
      totals.set(month, (totals.get(month) ?? 0) + ads)
  return [...totals].sort(([a], [b]) => a.localeCompare(b))
}

/** Ads in a year for a set of fields; `ytd` counts only the months the latest year covers. */
export function yearAds(
  data: Market,
  fields: string[],
  year: number,
  ytd = true,
) {
  return monthlyAds(data, fields)
    .filter(
      ([m]) =>
        Number(m.slice(0, 4)) === year &&
        (!ytd || Number(m.slice(5, 7)) <= data.ytd_months),
    )
    .reduce((sum, [, ads]) => sum + ads, 0)
}

/** Occupations in the chosen fields (all when none are chosen). */
export const occupationsIn = (data: Market, fields: string[]) =>
  data.occupations.filter((o) => !fields.length || fields.includes(o.field))

/** Ads per county for a set of fields, for one year. */
export function countyAds(
  data: Market,
  fields: string[],
  year: number,
  ytd = true,
) {
  return data.regions
    .filter((r) => r.region && r.region !== 'unknown')
    .map((r) => ({
      region: r.region,
      ads: keysOf(fields).reduce(
        (sum, key) => sum + ((ytd ? r.ytd : r.ads)[key]?.[String(year)] ?? 0),
        0,
      ),
    }))
}

/** Employment type, working hours and experience for a set of fields, one year, summed. */
export function conditionsOf(data: Market, fields: string[], year: number) {
  const byField = data.conditions[String(year)] ?? {}
  const keys = fields.length ? fields : Object.keys(byField)
  const sum = (part: 'employment' | 'hours' | 'experience') => {
    const out: Record<string, number> = {}
    for (const key of keys)
      for (const [name, value] of Object.entries(byField[key]?.[part] ?? {}))
        out[name] = (out[name] ?? 0) + value
    return out
  }
  return {
    employment: sum('employment'),
    hours: sum('hours'),
    experience: sum('experience'),
  }
}

export const pctOf = (part: number, whole: number) =>
  whole ? (part / whole) * 100 : 0
