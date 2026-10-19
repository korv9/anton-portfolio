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
