import { test, expect } from './test'

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
      12,
    )
    await expect(page.locator('.thesis-stats dd')).toHaveText([
      '21,633',
      '121',
      '72',
    ])
    await expect(page.locator('.thesis-stats')).toContainText('16,811')
    await expect(page.locator('.thesis-dot')).toHaveCount(121)
    await expect(page.locator('.thesis-dot.is-open')).toHaveCount(72)
    await expect(page.locator('.thesis-split-legend')).toContainText('27.7%')
    await expect(page.locator('#thesis-workflow')).toContainText('21,633')
    await expect(page.locator('#thesis-workflow')).toContainText(
      'ISO/IEC 25012',
    )
    await expect(page.locator('#thesis-quality')).toContainText('121 clusters')
    await expect(page.locator('#thesis-quality')).toContainText(
      '72 had no link',
    )
    await expect(page.locator('#thesis-quality')).toContainText(
      'rather than confirmed root causes',
    )
    await expect(page.locator('#thesis-quality')).toContainText(
      '3.8% written by hand',
    )
    await expect(page.locator('#thesis-quality')).not.toContainText(
      'helped the analysis distinguish',
    )
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

test.describe('degree project in Swedish', () => {
  test.use({ language: 'sv' })
  test('renders the Swedish copy', async ({ page }) => {
    await page.goto('/#thesis')
    await expect(page.locator('.thesis-page h1')).toHaveText(
      'Att hitta återkommande problem i IT-supportdata',
    )
    await expect(page.locator('#thesis-quality')).toContainText(
      'inte bekräftade rotorsaker',
    )
  })
})

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
    await expect(page).toHaveURL(/#projects/)
    await expect(page.locator('.hub')).toBeVisible()
    await expect(page.locator(`a[href="#${path}"]`)).toHaveCount(0)
  }
})

test('withdrawn observatories lead to the chart feed and are absent from navigation', async ({
  page,
}) => {
  for (const path of ['politik', 'jobb', 'wellbeing', 'ai-act', 'lagboken']) {
    await page.goto(`/#${path}`)
    await expect(page).toHaveURL(/#what-does-it-even-mean$/)
    await expect(page.locator(`a[href="#${path}"]`)).toHaveCount(0)
  }
})
