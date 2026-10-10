import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

const projects = [
  ['#ai-act', 'ai-act'],
  ['#jobb', 'jobs'],
  ['#sweden', 'welfare'],
  ['#symbolic-atlas', 'symbolic-atlas'],
  ['#thesis', 'thesis'],
  ['#philosophy-atlas', 'philosophy-atlas'],
  ['#concept-journey', 'concept-constellation'],
  ['#drugcomb', 'drugcomb'],
  ['#rfc-drift', 'allegoria'],
  ['#diva', 'diva'],
  ['#homie', 'homie'],
  ['#rag', 'rag'],
  ['#mimii', 'mimii'],
]

for (const [hash, id] of projects) {
  test(`${id} opens with a dashboard and links to its deep dive`, async ({
    page,
  }) => {
    await page.goto(`/${hash}`)
    const nav = page.getByRole('navigation', { name: 'Project views' })
    await expect(
      nav.getByRole('link', { name: 'Dashboard', exact: true }),
    ).toHaveAttribute('aria-current', 'location')
    const depth = page.locator(`#project-${id}-depth`)
    await expect(depth).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.dk-tech').first()).toBeVisible()
    await expect(
      depth.getByRole('heading', { name: 'Deep dive', exact: true }),
    ).toHaveCount(1)
    await nav.getByRole('link', { name: 'Deep dive', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`section=depth`))
    await expect(
      depth.getByRole('heading', { name: 'Deep dive', exact: true }),
    ).toBeInViewport()
    await page.reload()
    await expect(
      depth.getByRole('heading', { name: 'Deep dive', exact: true }),
    ).toBeInViewport({ timeout: 30000 })
    await nav.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(nav).toBeInViewport()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    expect(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    ).toBe('rgb(244, 240, 230)')
  })
}

test('the project views keep filters and the study dashboard is accessible', async ({
  page,
}) => {
  await page.goto('/#mimii?filter=kept')
  const nav = page.getByRole('navigation', { name: 'Project views' })
  await expect(
    nav.getByRole('link', { name: 'Deep dive', exact: true }),
  ).toHaveAttribute('href', '#mimii?filter=kept&section=depth')
  const audit = await new AxeBuilder({ page }).include('main').analyze()
  expect(audit.violations).toEqual([])
})

test('the shared dashboard pairs real KPIs and a chart with technical detail', async ({
  page,
}) => {
  for (const hash of [
    '#politik-sakdebatter',
    '#ai-act',
    '#jobb',
    '#jobb-trender',
  ]) {
    await page.goto(`/${hash}`)
    await expect(page.locator('.dk-kpis').first()).toBeVisible()
    const technical = page.locator('.dk-tech').first()
    await expect(technical).toBeVisible()
    await expect(
      technical.getByRole('tab', { name: 'Pipeline', exact: true }),
    ).toBeVisible()
    await technical.getByRole('tab', { name: 'Pipeline', exact: true }).click()
    await expect(technical.getByRole('tabpanel')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
  }
  await page.goto('/#jobb')
  const schema = page
    .locator('.dk-tech')
    .getByRole('tab', { name: 'Schema', exact: true })
  await expect(schema).toBeEnabled()
  await schema.focus()
  await page.keyboard.press('ArrowRight')
  await expect(
    page.locator('.dk-tech').getByRole('tab', { name: 'Rows', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
})
