/** The market tab's figures: periods, incomplete weeks, the three key figures and the funnel. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  closeRows,
  fieldSeries,
  funnel,
  gaps,
  isoWeek,
  latestWeek,
  medianClose,
  roleSeries,
  topRise,
  type MarketWeekly,
  type TimeToClose,
} from '../../src/job-assistant/market-figures.ts'
import type { Match } from '../../src/job-assistant/model.ts'

const week = (week_start: string, ads: number, complete = true) => ({
  week_start,
  iso_week: isoWeek(week_start),
  field_id: 'all',
  ads,
  vacancies: null,
  days_covered: complete ? 7 : 3,
  complete,
})

test('ISO weeks cross the year the way the calendar does', () => {
  assert.equal(isoWeek('2025-12-22'), '2025-W52')
  assert.equal(isoWeek('2025-12-29'), '2026-W01')
  assert.equal(isoWeek('2021-01-04'), '2021-W01')
})

test('the latest week is compared only with a complete week before', () => {
  const weekly: MarketWeekly = {
    latest_complete_week: '2026-11-02',
    rows: [
      week('2026-10-26', 900),
      week('2026-11-02', 1000),
      week('2026-11-09', 300, false),
    ],
  }
  const w = latestWeek(weekly)!
  assert.equal(w.week.ads, 1000)
  assert.equal(w.before?.ads, 900)
  weekly.rows[0] = week('2026-10-26', 400, false)
  assert.equal(latestWeek(weekly)!.before, null)
  assert.equal(
    latestWeek({ latest_complete_week: null, rows: weekly.rows }),
    null,
  )
})

test('years from months are complete only with twelve counted months', () => {
  const months = Array.from({ length: 21 }, (_, i) => {
    const m = `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
    return [m, 10, null] as [string, number, null]
  })
  const f = {
    market: { last_month: '2026-09', fields: [], monthly: { all: months } },
  }
  const years = fieldSeries(f, 'year', 'all')
  assert.deepEqual(
    years.map((y) => [y.label, y.ads, y.complete]),
    [
      ['2025', 120, true],
      ['2026', 90, false],
    ],
  )
  assert.equal(fieldSeries(f, 'month', 'all').at(-1)!.complete, true)
})

test('role series keep the archive flag and label weeks by ISO week', () => {
  const file = {
    period_kind: 'week' as const,
    latest_complete: '2025-12-22',
    rows: [
      {
        period_start: '2025-12-22',
        role_family: 'all',
        ads: 5,
        days_covered: 7,
        days_in_period: 7,
        complete: true,
      },
      {
        period_start: '2025-12-29',
        role_family: 'all',
        ads: 1,
        days_covered: 3,
        days_in_period: 7,
        complete: false,
      },
    ],
  }
  assert.deepEqual(
    roleSeries(file, 'all').map((p) => [p.label, p.complete]),
    [
      ['2025-W52', true],
      ['2026-W01', false],
    ],
  )
})

test('time to close shows only medians over the limit, the whole board first', () => {
  const t: TimeToClose = {
    window_days: 30,
    min_ads: 20,
    rows: [
      {
        occupation: 'Mjukvaruutvecklare',
        outcome: 'before_deadline',
        ads: 40,
        median_days_open: 12,
      },
      {
        occupation: 'Testare',
        outcome: 'before_deadline',
        ads: 8,
        median_days_open: null,
      },
      {
        occupation: 'all',
        outcome: 'before_deadline',
        ads: 60,
        median_days_open: 11,
      },
      { occupation: 'all', outcome: 'all', ads: 90, median_days_open: 14.5 },
    ],
  }
  assert.deepEqual(
    closeRows(t, 'before_deadline').map((r) => r.occupation),
    ['all', 'Mjukvaruutvecklare'],
  )
  assert.equal(medianClose(t)!.median_days_open, 14.5)
  assert.equal(medianClose({ ...t, rows: t.rows.slice(0, 3) }), null)
})

test('the top rise is the largest positive change among roles with 100 ads in both months', () => {
  const row = (
    skill: string,
    share_yoy_pp: number,
    total = 400,
    before = 400,
  ) => ({
    role_family: 'Software Developer',
    skill,
    ads_with_skill: 50,
    total_ads: total,
    skill_share: 0.1,
    previous_year_skill_ads: 40,
    previous_year_total_ads: before,
    previous_year_share: 0.1,
    share_yoy_pp,
  })
  const month = '2025-12'
  assert.equal(
    topRise({ month, rows: [row('SQL', -3), row('Docker', 5), row('Git', 4)] })!
      .skill,
    'Docker',
  )
  // A larger rise on fewer than 100 ads in either month is not the key figure.
  assert.equal(
    topRise({
      month,
      rows: [
        row('dbt', 14, 52, 400),
        row('Git', 10, 400, 39),
        row('Docker', 5),
      ],
    })!.skill,
    'Docker',
  )
  assert.equal(topRise({ month, rows: [row('dbt', 14, 52, 39)] }), null)
  assert.equal(topRise({ month, rows: [row('SQL', -3)] }), null)
})

test('periods absent from the file break the line and are named', () => {
  const p = (start: string) => ({ start, label: start, ads: 1, complete: true })
  const weeks = gaps(
    [p('2026-08-03'), p('2026-08-10'), p('2026-08-31')],
    'week',
  )
  assert.deepEqual([...weeks.after], [2])
  assert.deepEqual(weeks.missing, ['2026-W34', '2026-W35'])
  const months = gaps(
    [p('2025-11-01'), p('2025-12-01'), p('2026-02-01')],
    'month',
  )
  assert.deepEqual([...months.after], [2])
  assert.deepEqual(months.missing, ['2026-01'])
  assert.deepEqual(gaps([p('2024-01-01'), p('2025-01-01')], 'year').missing, [])
})

test('the funnel counts current ads per fit, outside first', () => {
  const m = (c: Match['class']) => ({ class: c }) as Match
  assert.deepEqual(
    funnel([m('strong'), m('outside'), m('outside'), m('possible')]).map(
      (r) => r.ads,
    ),
    [2, 0, 1, 1],
  )
})
