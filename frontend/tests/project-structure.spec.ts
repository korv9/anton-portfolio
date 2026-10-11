import { test, expect } from './test'

const projects = [
  ['#politik', 'Political Observatory', 5],
  ['#jobb', 'Labour Market Observatory', 5],
  ['#sweden', 'Wellbeing Observatory', 4],
  ['#ai-act', 'EU AI Act Observatory', 5],
] as const
for (const [path, name, count] of projects)
  test(`${name} has a topic overview`, async ({ page }) => {
    await page.goto(`/${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(page.locator('.overview-topics > a')).toHaveCount(count)
    await expect(
      page.locator('.project-hero-finding,.dk-kpis,.site-sidebar'),
    ).toHaveCount(0)
  })

test('degree project presents the workflow once and separates its evaluation', async ({
  page,
}) => {
  await page.goto('/#thesis')
  await expect(
    page.locator('#thesis-workflow .engineering-flow li'),
  ).toHaveCount(3)
  await expect(page.locator('#thesis-workflow')).toContainText('21 000+')
  await expect(page.locator('#thesis-workflow')).toContainText('72')
  await page
    .getByRole('navigation', { name: 'Project topics' })
    .getByRole('link', { name: 'Evaluation', exact: true })
    .click()
  await expect(page.locator('#thesis-evaluation')).toBeInViewport()
  await expect(page.locator('#thesis-evaluation')).toContainText('0.706')
  await page.reload()
  await expect(page.locator('#thesis-evaluation')).toBeInViewport()
})

test('lab sections open at their addresses after data loads', async ({
  page,
}) => {
  test.setTimeout(120000)
  for (const path of [
    'symbolic-corpus',
    'philosophy-works',
    'concepts-profiles',
  ]) {
    await page.goto(`/#${path}`)
    await expect(page.locator(`#${path}`)).toBeInViewport({ timeout: 45000 })
  }
})

test('removed pages lead back to the projects and are absent from navigation', async ({
  page,
}) => {
  for (const path of [
    'quality',
    'data-model',
    'data-constellation',
    'data-catalogue',
    'idea-lineage',
    'rag',
    'mimii',
    'diva',
    'rfc-drift',
  ]) {
    await page.goto(`/#${path}`)
    await expect(page).toHaveURL(/#projekt/)
    await expect(page.locator('.home-project-groups')).toBeVisible()
    await expect(page.locator(`a[href="#${path}"]`)).toHaveCount(0)
  }
})
