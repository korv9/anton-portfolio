import { test, expect } from './test'

const projects = [
  ['#jobb', 'Labour Market Observatory', 4],
  ['#sweden', 'Wellbeing Observatory', 4],
  ['#ai-act', 'EU AI Act Observatory', 3],
] as const
for (const [path, name, tabs] of projects)
  test(`${name} opens as a report in ${tabs} tabs`, async ({ page }) => {
    await page.goto(`/${path}`)
    await expect(page.locator('.politik-intro-name')).toHaveText(name)
    await expect(
      page.getByRole('navigation', { name: 'Report' }).getByRole('link'),
    ).toHaveCount(tabs)
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty()
    await expect(page.locator('.report-tab .feature').first()).toBeVisible()
    await expect(
      page.locator('.project-hero-finding,.dk-kpis,.site-sidebar'),
    ).toHaveCount(0)
  })

test(
  'degree project presents the workflow once and separates its evaluation',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#thesis')
    await expect(
      page.locator('#thesis-workflow .engineering-flow li'),
    ).toHaveCount(3)
    await expect(page.locator('.project-hero-summary')).toContainText('Fora AB')
    await expect(page.locator('#thesis-workflow')).toContainText('16 811')
    await expect(page.locator('#thesis-workflow')).toContainText('121')
    await expect(page.locator('#thesis-workflow')).toContainText('72')
    await expect(page.locator('#thesis-workflow')).toContainText('5,605')
    await expect(page.locator('#thesis-workflow')).toContainText(
      'operational review',
    )
    await expect(page.locator('#project-thesis-depth')).toContainText('21,633')
    await expect(page.locator('#project-thesis-depth')).toContainText('19,847')
    await expect(page.locator('#thesis-quality')).toContainText('4.2%')
    await expect(page.locator('#thesis-quality')).toContainText('82.2%')
    await expect(page.locator('#thesis-quality')).toContainText('3.8%')
    await expect(page.locator('#thesis-quality')).toContainText('5.1%')
    await expect(
      page.locator(
        'main a[href*="/private/"], main a[href*="Examensarbete.pdf"]',
      ),
    ).toHaveCount(0)
    await page
      .getByRole('navigation', { name: 'Project topics' })
      .getByRole('link', { name: 'Data quality', exact: true })
      .click()
    await expect(page.locator('#thesis-quality')).toBeInViewport()
    await page.reload()
    await expect(page.locator('#thesis-quality')).toBeInViewport()
    await page
      .getByRole('navigation', { name: 'Project topics' })
      .getByRole('link', { name: 'Evaluation', exact: true })
      .click()
    await expect(page.locator('#thesis-evaluation')).toBeInViewport()
    await expect(page.locator('#thesis-evaluation')).toContainText('0.7060')
    await expect(page.locator('#thesis-evaluation')).toContainText('0.5342')
    await expect(page.locator('#thesis-evaluation')).toContainText('72.3%')
    await expect(page.locator('#thesis-evaluation')).toContainText(
      'uneven comparison',
    )
    await page.reload()
    await expect(page.locator('#thesis-evaluation')).toBeInViewport()
  },
)

test('lab deep dives open at their addresses after data loads', async ({
  page,
}) => {
  test.setTimeout(120000)
  for (const path of [
    'symbolic-corpus',
    'philosophy-works',
    'concepts-method',
    'drugcomb-quality',
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
    await expect(page.locator('.projects-page')).toBeVisible()
    await expect(page.locator(`a[href="#${path}"]`)).toHaveCount(0)
  }
})
