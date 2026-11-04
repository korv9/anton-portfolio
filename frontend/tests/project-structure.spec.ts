import { test, expect } from './test'

test(
  'degree project shows its KPIs and figures, the method folded',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#thesis')
    await expect(page.locator('.thesis-page h1')).toHaveText('ITSM Clustering')
    await expect(page.locator('.page-head-kpis dd')).toHaveText([
      '21,633',
      '121',
      '72',
      '4.2%',
    ])
    await expect(page.locator('.thesis-page .project-section h2')).toHaveText([
      'Summary',
      'The problem',
      'Purpose and questions',
      'Case and data',
      'Method',
      'Data quality, ISO/IEC 25012',
      'Fields filled per year',
      'Clusters with and without a problem record',
      'Three findings',
      'Priority and fragmentation',
      'Conclusions',
      'Limitations',
      'Future work',
    ])
    await expect(page.locator('.thesis-page')).toContainText('Fora AB')
    await expect(page.locator('.thesis-page')).not.toContainText('Avtalat')
    await expect(page.locator('.thesis-dot')).toHaveCount(121)
    await expect(page.locator('.thesis-dot.is-open')).toHaveCount(72)
    await expect(page.locator('.thesis-split-legend')).toContainText('27.7%')
    await expect(page.locator('#thesis-findings')).toContainText(
      'Anonymisation created false patterns.',
    )
    await expect(page.locator('#thesis-conclusions')).toContainText(
      'organisational, not algorithmic',
    )
    // The technical notes sit in the closed method.
    const method = page.locator('.page-method')
    await expect(method.locator('#thesis-workflow')).toBeHidden()
    await method.locator('summary').click()
    await expect(method).toContainText('paraphrase-multilingual-mpnet-base-v2')
    await expect(
      page.locator(
        'main a[href*="/private/"], main a[href*="Examensarbete.pdf"]',
      ),
    ).toHaveCount(0)
  },
)

test.describe('degree project in Swedish', () => {
  test.use({ language: 'sv' })
  test('renders the Swedish copy', async ({ page }) => {
    await page.goto('/#thesis')
    await expect(page.locator('.page-head-sentence')).toContainText(
      'Mitt examensarbete',
    )
    await expect(page.locator('#thesis-quality')).toContainText(
      'inte bevisade rotorsaker',
    )
    await expect(page.locator('.thesis-funnel')).toContainText('16 811')
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
    await expect(page.locator('.hub-overview')).toBeVisible()
    await expect(page.locator(`a[href="#${path}"]`)).toHaveCount(0)
  }
})

test('withdrawn observatories lead to the chart feed and are absent from navigation', async ({
  page,
}) => {
  for (const path of ['politik', 'jobb', 'wellbeing']) {
    await page.goto(`/#${path}`)
    await expect(page).toHaveURL(/#what-does-it-even-mean$/)
    await expect(page.locator(`a[href="#${path}"]`)).toHaveCount(0)
  }
  // The statute book and the AI Act now live on Allegora's page.
  for (const path of ['ai-act', 'lagboken']) {
    await page.goto(`/#${path}`)
    await expect(page).toHaveURL(/#fraga-lagen$/)
  }
})
