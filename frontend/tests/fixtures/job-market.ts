/**
 * Synthetic files for the #jobs market tab, in the shape of configs/delivery/schemas
 * (market-weekly, market, job-ads-periods, skill-trends, rising-terms, employer-top,
 * job-assistant-time-to-close). Invented counts and names; never published.
 */
const head = {
  schema_version: 1,
  generated_at: '2026-11-14T06:00:00+00:00',
  source: 'fixture',
  method: 'fixture',
}
const DATA_IT = 'apaJ_2ja_LuF'

const months = (from: number, to: number) =>
  Array.from(
    { length: (to - from + 1) * 12 },
    (_, i) =>
      `${from + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
  )

const weeks = Array.from({ length: 15 }, (_, i) =>
  new Date(Date.UTC(2026, 7, 3 + i * 7)).toISOString().slice(0, 10),
)

const period = (kind: 'week' | 'month' | 'year', starts: string[]) => ({
  ...head,
  model: 'gold.mart_job_ads_periods',
  period_kind: kind,
  latest_complete: starts.at(-1)!,
  rows: starts.flatMap((start, i) =>
    ['all', 'Data Engineer'].map((role_family) => ({
      period_start: start,
      role_family,
      ads:
        (role_family === 'all' ? 100 : 30) +
        (i % 5) * (kind === 'year' ? 100 : 3),
      days_covered: 7,
      days_in_period: 7,
      complete: true,
    })),
  ),
})

const term = (t: string, recent: number, before: number) => ({
  term: t,
  words: t.includes(' ') ? 2 : 1,
  recent_uses: recent,
  before_uses: before,
  employers: 12,
  z: 4.2,
})

export function jobMarketFixture() {
  const archive = months(2024, 2025)
  return {
    'market-weekly': {
      ...head,
      latest_complete_week: weeks.at(-2)!,
      // Week 35 is absent from the file, as a week the stream never read would be.
      rows: weeks.flatMap((w, i) => {
        const complete = i < weeks.length - 1
        if (i === 3) return []
        return [
          ['all', 4000 + i * 10],
          [DATA_IT, 300 + i],
        ].map(([field_id, ads]) => ({
          week_start: w,
          // 2026-08-03 is the Monday of ISO week 32.
          iso_week: `2026-W${32 + i}`,
          field_id,
          ads: complete ? ads : 900,
          vacancies: null,
          days_covered: complete ? 7 : 3,
          complete,
        }))
      }),
    },
    market: {
      generated_at: head.generated_at,
      last_month: '2026-09',
      fields: [{ id: DATA_IT, name: 'Data/IT', groups: 12 }],
      monthly: {
        all: months(2024, 2026)
          .filter((m) => m <= '2026-09')
          .map((m, i) => [m, 40000 + i * 100, null]),
        [DATA_IT]: months(2024, 2026)
          .filter((m) => m <= '2026-09')
          .map((m, i) => [m, 2000 + i * 10, null]),
      },
    },
    'ads-week': period('week', weeks.slice(0, 10)),
    'ads-month': period(
      'month',
      archive.map((m) => `${m}-01`),
    ),
    'ads-year': period('year', ['2024-01-01', '2025-01-01']),
    'skill-trends': {
      ...head,
      model: 'gold.mart_skill_trends_monthly',
      month: '2025-12',
      rows: [
        ['Data Engineer', 'dbt', 14, 52, 0.27, 0.13, 14.1],
        ['Data Engineer', 'SQL', 30, 52, 0.58, 0.62, -3.8],
        ['Software Developer', 'Kubernetes', 68, 386, 0.18, 0.12, 6.1],
      ].map(([role_family, skill, a, t, s, p, pp]) => ({
        role_family,
        skill,
        ads_with_skill: a,
        total_ads: t,
        unique_employers: 10,
        skill_share: s,
        previous_year_skill_ads: 5,
        previous_year_total_ads: t,
        previous_year_share: p,
        share_yoy_pp: pp,
      })),
    },
    'rising-terms': {
      ...head,
      model: 'fixture',
      recent: { from: '2025-01', to: '2025-12' },
      before: { from: '2024-01', to: '2024-12' },
      rules: {},
      rows: [
        { role: 'Analytics Engineer', rising: [], falling: [] },
        {
          role: 'Data Engineer',
          rising: [
            term('dataplattformar', 107, 8),
            term('moderna verktyg', 60, 20),
          ],
          falling: [term('experience', 40, 90)],
        },
      ].map(({ role, ...lists }) => ({
        role_family: role,
        recent_ads: 600,
        before_ads: 600,
        totals: {},
        candidates: 100,
        dropped: {},
        ...lists,
      })),
    },
    'employer-top': {
      ...head,
      model: 'gold.mart_job_employer_top',
      rows: [
        {
          period_kind: 'latest_12_months',
          from: '2025-01-01',
          until: '2026-01-01',
          complete: true,
          employers: [
            { rank: 1, employer: 'Testbemanning A AB', ads: 199 },
            { rank: 2, employer: 'Testkonsult B AB', ads: 181 },
            { rank: 3, employer: 'Testverket', ads: 81 },
          ],
        },
      ],
    },
    'time-to-close': {
      ...head,
      window_days: 30,
      min_ads: 20,
      rows: [
        { occupation: 'all', outcome: 'all', ads: 412, median_days_open: 21 },
        {
          occupation: 'all',
          outcome: 'before_deadline',
          ads: 150,
          median_days_open: 12,
        },
        {
          occupation: 'all',
          outcome: 'to_deadline',
          ads: 230,
          median_days_open: 28,
        },
        {
          occupation: 'Mjukvaru- och systemutvecklare m.fl.',
          outcome: 'before_deadline',
          ads: 90,
          median_days_open: 11,
        },
        {
          occupation: 'Mjukvaru- och systemutvecklare m.fl.',
          outcome: 'to_deadline',
          ads: 140,
          median_days_open: 27,
        },
        {
          occupation: 'Testare och testledare',
          outcome: 'before_deadline',
          ads: 9,
          median_days_open: null,
        },
      ],
    },
  }
}
