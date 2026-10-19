import { test, expect } from './test'

const projects = [
  ['#jobb', 'Labour Market Observatory', 4],
  ['#wellbeing', 'Wellbeing Observatory', 4],
  ['#ai-act', 'EU AI Act Observatory', 3],
  ['#lagboken', 'Swedish Statute Book', 3],
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
  'degree project presents the supplied narrative and navigable findings',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#thesis')
    await expect(page.locator('.thesis-page h1')).toHaveText(
      'Finding recurring problems in IT support data',
    )
    await expect(page.locator('.thesis-page .project-section h2')).toHaveText([
      'Why I chose this project',
      'What I did',
      'What I found',
      'Why it matters',
    ])
    await expect(page.locator('.thesis-page .project-section p')).toHaveCount(
      11,
    )
    await expect(page.locator('#thesis-workflow')).toContainText('21,000')
    await expect(page.locator('#thesis-workflow')).toContainText('ISO 25012')
    await expect(page.locator('#thesis-quality')).toContainText('121 clusters')
    await expect(page.locator('#thesis-quality')).toContainText(
      '72 had no link',
    )
    await expect(page.locator('#thesis-quality')).toContainText(
      'rather than confirmed root causes',
    )
    await expect(page.locator('#thesis-quality')).toContainText('around 96%')
    await expect(
      page.locator(
        'main a[href*="/private/"], main a[href*="Examensarbete.pdf"]',
      ),
    ).toHaveCount(0)
    await page
      .getByRole('navigation', { name: 'Project topics' })
      .getByRole('link', { name: 'What I found', exact: true })
      .click()
    await expect(page.locator('#thesis-quality')).toBeInViewport()
    await page.reload()
    await expect(page.locator('#thesis-quality')).toBeInViewport()
    await page
      .getByRole('navigation', { name: 'Project topics' })
      .getByRole('link', { name: 'Why it matters', exact: true })
      .click()
    await expect(page.locator('#thesis-evaluation')).toBeInViewport()
    await expect(page.locator('#thesis-evaluation')).toContainText(
      'would need to be evaluated through operational use',
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
