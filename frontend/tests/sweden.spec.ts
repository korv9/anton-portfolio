/**
 * SWEDEN: one page with a short section per research product; every product's address scrolls to
 * its section, the withdrawn Wellbeing Observatory's old #sweden addresses lead to the chart feed,
 * and the products draw their findings from the published files (counts are read from the file,
 * never expected as literals).
 */
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { test, expect } from './test'

/** A product's section, after its address has scrolled to it. */
async function section(page: Page, hash: string, id: string) {
  await page.goto('/' + hash)
  const s = page.locator(`#sw-${id}`)
  await expect(s.locator('h2').first()).toBeVisible()
  return s
}

/** Opens the section's fold: explore, method and readings. */
async function more(s: Locator) {
  await s.locator('.explore-section > h2 button').first().click()
}

async function noAxeViolations(page: Page, s: Locator) {
  const axe = await new AxeBuilder({ page })
    .include(`#${await s.getAttribute('id')}`)
    .exclude('canvas')
    .analyze()
  expect(
    axe.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
}

const ROUTES = [
  '#sweden-matning',
  '#sweden-arbete',
  '#sweden-likhet',
  '#sweden-tillhorighet',
  '#sweden-framtid',
  '#sweden-valfard',
  '#sweden-samband',
]

test('one page holds the six research products and Connections', async ({
  page,
}) => {
  await page.goto('/#sweden')
  await expect(page.locator('.sw-section[id^="sw-"]')).toHaveCount(7)
  await expect(page.locator('.sw-jump a')).toHaveCount(7)
  for (const href of ROUTES)
    await expect(page.locator(`.sw-jump a[href="${href}"]`)).toHaveCount(1)
  // The shared head: the name, one sentence and the KPIs read from the coverage files.
  await expect(page.locator('.sw-header')).toHaveCount(0)
  await expect(page.locator('.page-head-title')).toHaveText('SWEDEN')
  await expect(page.locator('.page-head-kpis > div')).toHaveCount(4)
})

test(
  'every research address scrolls to its question',
  { tag: '@mobile' },
  async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const href of ROUTES) {
      await page.goto('/' + href)
      const id =
        href === '#sweden-samband' ? 'X' : 'ABCDEF'[ROUTES.indexOf(href)]
      const title = page.locator(`#sw-title-${id}`)
      await expect(title).toBeInViewport()
      await expect(title).not.toBeEmpty()
      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      )
      expect(width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
    }
    expect(errors).toEqual([])
  },
)

test('old wellbeing addresses lead to the chart feed', async ({ page }) => {
  for (const from of ['#sweden-health', '#sweden-counties', '#sweden-work']) {
    await page.goto('/' + from)
    await expect(page).toHaveURL(/#what-does-it-even-mean$/)
  }
})

test('politics of measurement computes its findings from the catalogue', async ({
  page,
  request,
}) => {
  const summary = await (
    await request.get('/data/sweden/measurement/summary.json')
  ).json()
  const culture = summary.domains.find(
    (d: { id: string }) => d.id === 'culture',
  )
  const s = await section(page, '#sweden-matning?scen=2d', 'A')
  // The findings sit in the fold, under the chart.
  await more(s)
  const cards = s.locator('.sw-find')
  await expect(cards).not.toHaveCount(0)
  expect(await cards.count()).toBeLessThanOrEqual(2)
  await expect(s.locator('.sw-finds')).toContainText(
    culture.scb_tables.toLocaleString('en-GB'),
  )
  // A matrix cell opens its domain in the info panel and the address keeps it.
  await s.getByRole('button', { name: /^Culture, 2020s/ }).click()
  await expect(page).toHaveURL(/domain=culture/)
  await expect(s.locator('.sw-scene-info')).toContainText('Culture')
  await page.goBack()
  await expect(page).not.toHaveURL(/domain=culture/)
  // A count that could not have come out against Porter does not support him.
  await expect(s.locator('.sw-reading', { hasText: 'Porter' })).toHaveAttribute(
    'data-verdict',
    'undetermined',
  )
  await expect(s.locator('.sw-method')).toContainText(
    `${Math.round(summary.sensitivity.moved_share * 100)} %`,
  )
  // Nine method sections, limitations open.
  await expect(s.locator('.sw-method details')).toHaveCount(9)
  await noAxeViolations(page, s)
})

test('the invisible sweden moves municipalities into similarity space', async ({
  page,
  request,
}) => {
  const data = await (
    await request.get('/data/sweden/similarity/municipalities.json')
  ).json()
  const s = await section(page, '#sweden-likhet?scen=2d', 'C')
  await expect(s.locator('.sw-map-dots circle')).toHaveCount(data.summary.total)
  await more(s)
  await expect(s.locator('.sw-finds')).toContainText(
    `${data.summary.nearest_in_other_county} of ${data.summary.analysed}`,
  )
  // The groups are a summary, not a finding.
  await expect(s.locator('.sw-finds')).not.toContainText('of 21 counties')
  // Distance to the big cities is measured, and the verdict needs both variants' intervals.
  await expect(
    s.locator('.sw-reading', { hasText: 'Centre and periphery' }),
  ).toHaveAttribute('data-verdict', 'supports')
  // SKR's types hold less than half the variance of the indicators they are not built from.
  await expect(
    s.locator('.sw-reading', { hasText: 'Official typologies (SKR)' }),
  ).toHaveAttribute('data-verdict', 'challenges')
  await s.getByRole('button', { name: 'Similarity', exact: true }).click()
  await expect(page).toHaveURL(/vy=likhet/)
  await s.getByRole('combobox', { name: 'Municipality' }).selectOption('1284')
  await expect(page).toHaveURL(/kommun=1284/)
  await expect(s.locator('.sw-scene-info')).toContainText('Höganäs')
  await expect(s.locator('.sw-neighbours li')).toHaveCount(5)
  // A municipality outside the analysis says which value it lacks.
  await s.getByRole('combobox', { name: 'Municipality' }).selectOption('0481')
  await expect(s.locator('.sw-scene-info')).toContainText('Riksdag turnout')
  await noAxeViolations(page, s)
})

test('the ideal human counts language per word with the occupation mix fixed', async ({
  page,
  request,
}) => {
  const trends = await (
    await request.get('/data/sweden/language/trends.json')
  ).json()
  const years = trends.categories[0].rows.map((r: number[]) => r[0])
  const s = await section(page, '#sweden-arbete?scen=2d', 'B')
  await expect(s.locator('.sw-matrix thead th.sw-n')).toHaveCount(years.length)
  await more(s)
  await expect(s.locator('.sw-find')).not.toHaveCount(0)
  // The years with no occupations say so instead of showing a standardised value.
  await s
    .getByRole('button', {
      name: new RegExp(`^Passion and enthusiasm, ${years[0]}`),
    })
    .click()
  await expect(page).toHaveURL(/kategori=passion/)
  // Every category and sub-term is shown in three measures with its direction; stated
  // qualifications rise as a share of ads and fall per word, so their reading is undetermined.
  await expect(s.locator('.sw-agree')).toHaveCount(
    trends.categories.length + trends.subterms.length,
  )
  await expect(
    s.locator('.sw-reading', { hasText: 'Human capital' }),
  ).toHaveAttribute('data-verdict', 'undetermined')
  await expect(
    s.getByText(/split into a part within groups/).first(),
  ).toBeVisible()
  await noAxeViolations(page, s)
})

test('the infrastructure of belonging maps libraries by municipality and year', async ({
  page,
}) => {
  const s = await section(page, '#sweden-tillhorighet?scen=2d', 'D')
  await expect(s.locator('.sw-choropleth path')).toHaveCount(290)
  await expect(s.locator('.sw-libraries circle')).not.toHaveCount(0)

  await s.getByRole('combobox', { name: 'Measure' }).selectOption('visits_rate')
  await expect(page).toHaveURL(/matt=visits_rate/)
  // The keyboard reaches every municipality on the 2D map.
  await s.getByRole('button', { name: /^Höganäs:/ }).press('Enter')
  await expect(s.locator('.sw-scene-info')).toContainText('Höganäs')
  await more(s)
  await expect(
    s.getByText('Rural municipality with a visitor industry').first(),
  ).toBeAttached()
  // A count of service points cannot decide a theory of welfare-state contraction.
  await expect(
    s.locator('.sw-reading', { hasText: 'Habermas' }),
  ).toHaveAttribute('data-verdict', 'undetermined')
  // Judged with log population held constant.
  await expect(
    s.locator('.sw-reading', { hasText: 'Use follows supply' }),
  ).toHaveAttribute('data-verdict', 'undetermined')
  await noAxeViolations(page, s)
})

test('the lost futures reads every session and links its speeches', async ({
  page,
  request,
}) => {
  const coverage = await (
    await request.get('/data/sweden/futures/coverage.json')
  ).json()
  const sessions = coverage.sessions.map((s: { session: string }) => s.session)
  // 1999/2000 is the one session with an eight-digit code.
  expect(sessions).toContain('19992000')
  expect(sessions.length).toBeGreaterThanOrEqual(33)
  const s = await section(page, '#sweden-framtid?scen=2d', 'E')
  await expect(s.locator('.sw-matrix tbody tr')).toHaveCount(9)
  await more(s)
  await expect(s.locator('.sw-find')).not.toHaveCount(0)
  const theme = s.getByRole('combobox', { name: 'Theme' }).first()
  await theme.selectOption('alternatives')
  await expect(page).toHaveURL(/tema=alternatives/)
  await expect(
    s
      .locator('.sw-examples a[href^="https://data.riksdagen.se/anforande/"]')
      .first(),
  ).toBeVisible()
  await expect(
    s.getByRole('heading', {
      name: 'Speeches about the future at equal length (%)',
    }),
  ).toBeVisible()
  await theme.selectOption('security')
  await expect(
    s.getByRole('heading', { name: 'The theme split into its words (%)' }),
  ).toBeVisible()
  await noAxeViolations(page, s)
})

test('connections state their contracts and the rejected joins', async ({
  page,
  request,
}) => {
  const data = await (
    await request.get('/data/sweden/connections/connections.json')
  ).json()
  const s = await section(page, '#sweden-samband', 'X')
  await expect(s.locator('.sw-connection')).toHaveCount(
    data.relationships.length,
  )
  await expect(s.locator('.sw-connection').first()).toContainText('Denominator')
  await expect(s.locator('.sw-connection').first()).not.toContainText(
    'defined before it was computed',
  )
  await more(s)
  await expect(s.locator('.explore-section details')).toHaveCount(
    data.rejected.length,
  )
  // 3.1: choosing a municipality moves the one accent and names its values.
  const pick = s.getByRole('combobox', { name: 'Municipality' })
  const { visits, service_points } = data.relationships.find(
    (r: { kind: string }) => r.kind === 'neighbours',
  ).result.measures
  const both = new Set(service_points.points.map((p: string[]) => p[0]))
  const point = visits.points.find((p: string[]) => both.has(p[0]))
  await pick.selectOption(point[0])
  await expect(s.locator('.sw-dots circle.is-focal')).toHaveCount(2)
  await expect(s.locator('.sw-neighbours figcaption')).toContainText(
    point[2].toFixed(2),
  )
  // 3.2: two predictors in two periods.
  await expect(s.locator('.sw-connection .sw-table tbody tr')).toHaveCount(4)
  await noAxeViolations(page, s)
})

test('3D is the default, 2D is one click away, and the homepage never loads three.js', async ({
  page,
}) => {
  await page.goto('/#start')
  const homeScripts = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name),
  )
  expect(homeScripts.some((n) => /BarField|three|stage/.test(n))).toBe(false)
  const s = await section(page, '#sweden-matning', 'A')
  // A 3D canvas where WebGL works, the 2D matrix where it does not.
  await expect(s.locator('.sw-stage canvas, .sw-matrix')).toHaveCount(1)
  await s.getByRole('button', { name: '2D', exact: true }).click()
  await expect(page).toHaveURL(/scen=2d/)
  await expect(s.locator('.sw-matrix')).toHaveCount(1)
})

test('the welfare contract reads its numbers from the tax and survey files', async ({
  page,
  request,
}) => {
  const wedge = await (await request.get('/data/taxes/wedge.json')).json()
  const ess = await (
    await request.get('/data/welfare/ess-countries.json')
  ).json()
  const se = wedge.latest.find(
    (r: { country_code: string; household_type: string; wage_level: string }) =>
      r.country_code === 'SWE' &&
      r.household_type === 'S_C0' &&
      r.wage_level === 'AW100',
  )
  const dip = ess.find(
    (r: { unit_code: string; survey_mode: string }) =>
      r.unit_code === 'SE' && r.survey_mode === 'self_completion',
  )
  const s = await section(page, '#sweden-valfard', 'F')
  await more(s)
  await expect(s.locator('.sw-find')).toHaveCount(2)
  await expect(s.locator('.sw-finds')).toContainText(
    `${se.tax_wedge_pct.toFixed(1)} %`,
  )
  // The self-completed round is flagged against the expectation, never read as a trend.
  await expect(s.locator('.sw-find[data-contrary]')).toContainText(
    dip.ppltrst_mean.toFixed(2),
  )
  await expect(s.locator('.sw-method details')).toHaveCount(9)
  await noAxeViolations(page, s)
})
