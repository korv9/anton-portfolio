/**
 * SWEDEN: the hub and every research route open, the Wellbeing Observatory's old #sweden
 * addresses lead to #wellbeing, and Politics of Measurement draws its findings from the
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
  await expect(page.locator('.sw-hub-list > li')).toHaveCount(6)
  for (const href of ROUTES)
    await expect(page.locator(`.sw-hub-list a[href="${href}"]`)).toHaveCount(1)
  await expect(page.locator('.sw-hub-out a[href="#projekt"]')).toHaveCount(1)
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
      await expect(page.locator('.sw-question').first()).not.toBeEmpty()
      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      )
      expect(width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
    }
    expect(errors).toEqual([])
  },
)

test('old wellbeing addresses lead to #wellbeing', async ({ page }) => {
  for (const [from, to] of [
    ['#sweden-health', '#wellbeing-health'],
    ['#sweden-counties', '#wellbeing-counties'],
    ['#sweden-mental-health', '#wellbeing-mental-health'],
  ]) {
    await page.goto('/' + from)
    await expect(page).toHaveURL(new RegExp(to + '$'))
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
  await page.goto('/#sweden-matning')
  const cards = page.locator('.sw-finding')
  await expect(cards).not.toHaveCount(0)
  expect(await cards.count()).toBeLessThanOrEqual(3)
  await expect(page.locator('.sw-findings')).toContainText(
    culture.scb_tables.toLocaleString('en-GB'),
  )
  // A matrix cell opens its domain in the info panel and the address keeps it.
  await page.getByRole('button', { name: /^Culture, 2020s/ }).click()
  await expect(page).toHaveURL(/domain=culture/)
  await expect(page.locator('.sw-scene-info')).toContainText('Culture')
  await page.goBack()
  await expect(page).not.toHaveURL(/domain=culture/)
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
  await page.goto('/#sweden-likhet')
  await expect(page.locator('.sw-map-dots circle')).toHaveCount(
    data.summary.total,
  )
  await expect(page.locator('.sw-findings')).toContainText(
    String(data.summary.nearest_in_other_county),
  )
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
  await page.goto('/#sweden-arbete')
  await expect(page.locator('.sw-matrix thead th.sw-n')).toHaveCount(
    years.length,
  )
  await expect(page.locator('.sw-finding')).not.toHaveCount(0)
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
  await page.goto('/#sweden-tillhorighet')
  await expect(page.locator('.sw-choropleth path')).toHaveCount(290)
  await expect(page.locator('.sw-libraries circle')).not.toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Measure' })
    .selectOption('visits_rate')
  await expect(page).toHaveURL(/matt=visits_rate/)
  await page.getByRole('button', { name: /^Höganäs:/ }).click()
  await expect(page.locator('.sw-scene-info')).toContainText('Höganäs')
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
