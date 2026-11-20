/** The dooh subject's published files (platform/publish/dooh/export_dooh.py). */

export type Station = {
  station_key: string
  station_name: string
  latitude: number
  longitude: number
  lines: string[]
  terminal: boolean
  shopping: boolean
  /** Boardings per average winter weekday, one per year in `years`. */
  boardings: number[]
  share: number[]
  /** Natural log ratios. */
  change_2013_2019: number
  change_2019_2022: number
}

export type Stations = {
  years: number[]
  totals: number[]
  stations: Station[]
  unit: string
}

export type DaypartStation = {
  station_key: string
  shopping: boolean
  morning_share: number
  afternoon_share: number
  /** 24 values, clock hours 0–23; 100 = the mean service hour of all stations. */
  index: number[]
  boardings: number[]
}

export type DaypartGroup = {
  stations: number
  morning_share_median: number
  afternoon_share_median: number
  index_mean: number[]
  /** Mean over the group's stations of each hour's share of the station's day. */
  share_mean: number[]
}

export type Dayparts = {
  year: number
  service_date: string
  mean_hourly_boardings: number
  stations: DaypartStation[]
  groups: { shopping: DaypartGroup; other: DaypartGroup }
}

export type Check = {
  n: number
  loo_median_abs_log_error: number
  null_median_abs_log_error: number
  improvement: number
  coverage: number
  label: 'model' | 'not_better_than_median'
}

export type Planned = {
  station: string
  branch: string
  kind: 'new' | 'interchange'
  terminal: boolean
  source_url: string
  boardings?: number
  interval80?: [number, number]
}

type Audience = {
  /** Planning-area growth from 2025; 1 for today. */
  growth: number
  /** Residents within 1 km: the potential reach. */
  reach: number
  boardings: number
  interval80: [number, number]
}

export type AtOpening = {
  station: string
  branch: string
  planning_areas: string[]
  today: Audience
  /** Opening year: the median of the slip model, capped at the projection's last year. */
  median: Audience & { year: number; capped: boolean }
  /** Sensitivity: the latest official forecast as the opening year. */
  official: Audience & { year: number; capped: boolean }
}

export type NewStations = {
  target_year: number
  check: Check
  sensitivity_2019: Check
  stations: Planned[]
  existing: { station_key: string; observed: number; loo: number }[]
  at_opening: { base_year: number; last_year: number; stations: AtOpening[] }
}

type Range = {
  p10: number | null
  p50: number | null
  p90: number | null
  after_2060: number
  rho_median: number
  intervals: number
}

type Forecast = {
  branch: string
  statement_date: string
  opening_year: number
  opening_quarter: number | null
  opening_month: number | null
  source_title: string
  source_url: string
}

export type Branch = {
  branch: string
  latest_forecast: number
  revisions: number
  range: Range
  own_branch: Range | null
  forecasts: Forecast[]
}

export type Timing = { now: string; resamples: number; branches: Branch[] }
