/**
 * SWEDEN: the hub and every research route open, the withdrawn Wellbeing Observatory's old
 * #sweden addresses lead to the chart feed, and Politics of Measurement draws its findings from the
 * published catalogue (counts are read from the file, never expected as literals).
 */
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './test'

const ROUTES = [
  '#sweden-matning',
  '#sweden-arbete',
  '#sweden-likhet',
  '#sweden-tillhorighet',
  '#sweden-framtid',
  '#sweden-samband',
]

test('the hub lists the five research products and Connections', async ({
  page,
}) => {
  await page.goto('/#sweden')
  await expect(page.locator('.sw-doors > li')).toHaveCount(6)
  for (const href of ROUTES)
    await expect(page.locator(`.sw-doors a[href="${href}"]`)).toHaveCount(1)
})

test('SWEDEN has one header of its own, with a menu that closes on Escape', async ({
  page,
}) => {
  await page.goto('/#sweden-likhet')
  await expect(page.locator('.site-header')).toHaveCount(0)
  await expect(page.locator('.sw-header')).toHaveCount(1)
  await expect(
    page.locator('.sw-nav a[aria-current="page"][href="#sweden-likhet"]'),
  ).toHaveCount(1)
  const menu = page.getByRole('button', { name: 'MENU' })
  await menu.click()
  await expect(page.locator('.sw-menu a[href="#projekt"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.sw-menu')).not.toBeVisible()
  await expect(menu).toBeFocused()
})

test(
  'every research route opens with its question',
  { tag: '@mobile' },
  async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const href of ROUTES) {
      await page.goto('/' + href)
      await expect(page.locator('#sw-title')).toBeVisible()
      await expect(page.locator('#sw-title')).not.toBeEmpty()
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
  await page.goto('/#sweden-matning?scen=2d')
  const cards = page.locator('.sw-find')
  await expect(cards).not.toHaveCount(0)
  expect(await cards.count()).toBeLessThanOrEqual(3)
  await expect(page.locator('.sw-finds')).toContainText(
    culture.scb_tables.toLocaleString('en-GB'),
  )
  // A matrix cell opens its domain in the info panel and the address keeps it.
  await page.getByRole('button', { name: /^Culture, 2020s/ }).click()
  await expect(page).toHaveURL(/domain=culture/)
  await expect(page.locator('.sw-scene-info')).toContainText('Culture')
  await page.goBack()
  await expect(page).not.toHaveURL(/domain=culture/)
  // A count that could not have come out against Porter does not support him.
  await expect(
    page.locator('.sw-reading', { hasText: 'Porter' }),
  ).toHaveAttribute('data-verdict', 'undetermined')
  await expect(page.locator('.sw-method')).toContainText(
    `${Math.round(summary.sensitivity.moved_share * 100)} %`,
  )
  // Nine method sections, limitations open.
  await expect(page.locator('.sw-method details')).toHaveCount(9)
  const axe = await new AxeBuilder({ page }).include('main').analyze()
  expect(
    axe.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
})

test('the invisible sweden moves municipalities into similarity space', async ({
  page,
  request,
}) => {
  const data = await (
    await request.get('/data/sweden/similarity/municipalities.json')
  ).json()
  await page.goto('/#sweden-likhet?scen=2d')
  await expect(page.locator('.sw-map-dots circle')).toHaveCount(
    data.summary.total,
  )
  await expect(page.locator('.sw-finds')).toContainText(
    `${data.summary.analysed - data.summary.nearest_in_other_county} of ${data.summary.analysed}`,
  )
  // Distance to the big cities is measured, and the verdict needs both variants' intervals.
  await expect(
    page.locator('.sw-reading', { hasText: 'Centre and periphery' }),
  ).toHaveAttribute('data-verdict', 'supports')
  // SKR's types hold less than half the variance of the indicators they are not built from.
  await expect(
    page.locator('.sw-reading', { hasText: 'Official typologies (SKR)' }),
  ).toHaveAttribute('data-verdict', 'challenges')
  await page.getByRole('button', { name: 'Similarity', exact: true }).click()
  await expect(page).toHaveURL(/vy=likhet/)
  await page
    .getByRole('combobox', { name: 'Municipality' })
    .selectOption('1284')
  await expect(page).toHaveURL(/kommun=1284/)
  await expect(page.locator('.sw-scene-info')).toContainText('Höganäs')
  await expect(page.locator('.sw-neighbours li')).toHaveCount(5)
  // A municipality outside the analysis says which value it lacks.
  await page
    .getByRole('combobox', { name: 'Municipality' })
    .selectOption('0481')
  await expect(page.locator('.sw-scene-info')).toContainText('Riksdag turnout')
  const axe = await new AxeBuilder({ page })
    .include('main')
    .exclude('canvas')
    .analyze()
  expect(
    axe.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
})

test('the ideal human counts language per word with the occupation mix fixed', async ({
  page,
  request,
}) => {
  const trends = await (
    await request.get('/data/sweden/language/trends.json')
  ).json()
  const years = trends.categories[0].rows.map((r: number[]) => r[0])
  await page.goto('/#sweden-arbete?scen=2d')
  await expect(page.locator('.sw-matrix thead th.sw-n')).toHaveCount(
    years.length,
  )
  await expect(page.locator('.sw-find')).not.toHaveCount(0)
  // The years with no occupations say so instead of showing a standardised value.
  await page
    .getByRole('button', {
      name: new RegExp(`^Passion and enthusiasm, ${years[0]}`),
    })
    .click()
  await expect(page).toHaveURL(/kategori=passion/)
  const axe = await new AxeBuilder({ page })
    .include('main')
    .exclude('canvas')
    .analyze()
  expect(
    axe.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
})

test('the infrastructure of belonging maps libraries by municipality and year', async ({
  page,
}) => {
  await page.goto('/#sweden-tillhorighet?scen=2d')
  await expect(page.locator('.sw-choropleth path')).toHaveCount(290)
  await expect(page.locator('.sw-libraries circle')).not.toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Measure' })
    .selectOption('visits_rate')
  await expect(page).toHaveURL(/matt=visits_rate/)
  // The map sits under the scene panels in 2D; the keyboard reaches every municipality.
  await page.getByRole('button', { name: /^Höganäs:/ }).press('Enter')
  await expect(page.locator('.sw-scene-info')).toContainText('Höganäs')
  // A count of service points cannot decide a theory of welfare-state contraction.
  await expect(
    page.locator('.sw-reading', { hasText: 'Habermas' }),
  ).toHaveAttribute('data-verdict', 'undetermined')
  // Visits are reported before and after 2019, with the change by SKR group.
  await expect(
    page
      .getByRole('button', { name: /visits changed .* from 2014 to 2019/ })
      .first(),
  ).toBeVisible()
  await page
    .getByRole('button', { name: /By SKR group the/ })
    .first()
    .click()
  await expect(
    page.getByRole('figure', { name: /^Median change in visits per/ }),
  ).toHaveCount(2)
  // Judged with log population held constant.
  await expect(
    page.locator('.sw-reading', { hasText: 'Use follows supply' }),
  ).toHaveAttribute('data-verdict', 'undetermined')
  const axe = await new AxeBuilder({ page })
    .include('main')
    .exclude('canvas')
    .analyze()
  expect(
    axe.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
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
  await page.goto('/#sweden-framtid?scen=2d')
  await expect(page.locator('.sw-matrix tbody tr')).toHaveCount(9)
  await expect(page.locator('.sw-find')).not.toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Theme' })
    .selectOption('alternatives')
  await expect(page).toHaveURL(/tema=alternatives/)
  await expect(
    page
      .locator('.sw-examples a[href^="https://data.riksdagen.se/anforande/"]')
      .first(),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Speeches about the future at equal length (%)',
    }),
  ).toBeVisible()
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('security')
  await expect(
    page.getByRole('heading', { name: 'The theme split into its words (%)' }),
  ).toBeVisible()
  const axe = await new AxeBuilder({ page })
    .include('main')
    .exclude('canvas')
    .analyze()
  expect(
    axe.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
})

test('connections state their contracts and the rejected joins', async ({
  page,
  request,
}) => {
  const data = await (
    await request.get('/data/sweden/connections/connections.json')
  ).json()
  await page.goto('/#sweden-samband')
  await expect(page.locator('.sw-connection')).toHaveCount(
    data.relationships.length,
  )
  await expect(page.locator('#sw-rejected ~ details')).toHaveCount(
    data.rejected.length,
  )
  await expect(page.locator('.sw-connection').first()).toContainText(
    'Denominator',
  )
  await expect(page.locator('.sw-connection').first()).not.toContainText(
    'defined before it was computed',
  )
  // 3.1: choosing a municipality moves the one accent and names its values.
  const pick = page.getByRole('combobox', { name: 'Municipality' })
  const { visits, service_points } = data.relationships.find(
    (r: { kind: string }) => r.kind === 'neighbours',
  ).result.measures
  const both = new Set(service_points.points.map((p: string[]) => p[0]))
  const point = visits.points.find((p: string[]) => both.has(p[0]))
  await pick.selectOption(point[0])
  await expect(page.locator('.sw-dots circle.is-focal')).toHaveCount(2)
  await expect(page.locator('.sw-neighbours figcaption')).toContainText(
    point[2].toFixed(2),
  )
  // 3.2: two predictors in two periods.
  await expect(page.locator('.sw-connection .sw-table tbody tr')).toHaveCount(4)
  const axe = await new AxeBuilder({ page }).include('main').analyze()
  expect(
    axe.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([])
})

test('3D is the default, 2D is one click away, and the homepage never loads three.js', async ({
  page,
}) => {
  await page.goto('/#start')
  const homeScripts = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name),
  )
  expect(homeScripts.some((n) => /BarField|three|stage/.test(n))).toBe(false)
  await page.goto('/#sweden-matning')
  // A 3D canvas where WebGL works, the 2D matrix where it does not.
  await expect(page.locator('.sw-stage canvas, .sw-matrix')).toHaveCount(1)
  await page.getByRole('button', { name: '2D', exact: true }).click()
  await expect(page).toHaveURL(/scen=2d/)
  await expect(page.locator('.sw-matrix')).toHaveCount(1)
})
