import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

// The reader's date is pinned through ?idag so the tests do not move with the calendar.
test('the AI Act report answers one question per tab', async ({ page }) => {
  await page.goto('/#ai-act?idag=2026-10-06')
  const question = page.getByRole('heading', { level: 1 })
  await expect(question).toHaveText('What applies now, and what comes next?')
  const tabs = page.getByRole('navigation', { name: 'Report' })
  await expect(tabs.getByRole('link')).toHaveCount(3)
  await expect(page.locator('#tillampning .rank-bars-list li')).toHaveCount(5)
  await tabs.getByRole('link', { name: 'Roles and obligations' }).click()
  await expect(question).toHaveText('Who must do what?')
  await page
    .getByRole('group', { name: 'Roles' })
    .getByRole('button', { name: 'Deployer', exact: true })
    .click()
  await expect(page).toHaveURL(/roller=deployer/)
  await expect(page.locator('.report-tab .feature')).toHaveCount(3)
  await page
    .getByRole('navigation', { name: 'Go deeper' })
    .getByRole('link', { name: /Article by article/ })
    .click()
  await expect(page.locator('.aa-body')).toBeVisible()
  await expect(page.locator('.dk-kpis')).toHaveCount(0)
  await page.getByRole('link', { name: /EU AI Act Observatory/ }).click()
  await expect(question).toHaveText('What applies now, and what comes next?')
})

test('the timeline marks what has passed against the reader’s date', async ({
  page,
}) => {
  await page.goto('/#ai-act-timeline?idag=2027-01-01')
  const row = page.locator('#aa-m-new-prohibitions-and-marking')
  await expect(row).toContainText('Applies')
  await expect(page.locator('#aa-m-high-risk-annex-iii')).toContainText(
    'Upcoming',
  )
  await expect(row.locator('blockquote')).toContainText('2 December 2026')
})

test('obligations filter by role and quote the Act', async ({ page }) => {
  await page.goto('/#ai-act-obligations?actor=deployer')
  const items = page.locator('.aa-obligation')
  await expect(items.first()).toBeVisible()
  for (const pill of await items
    .locator('.aa-pill:not(.aa-pill-quiet)')
    .allTextContents())
    expect(pill).toBe('Deployer')
  await expect(items.first().locator('blockquote')).toContainText(/deployers/i)
})

test('the navigator points to roles and articles without classifying', async ({
  page,
}) => {
  await page.goto('/#ai-act-startups')
  await expect(page.locator('.aa-disclaimer')).toContainText('not legal advice')
  const question = page
    .locator('.aa-question')
    .filter({ hasText: 'under your own name' })
  await question.getByText('Yes', { exact: true }).click()
  await page
    .locator('.aa-question')
    .filter({ hasText: 'Annex III' })
    .getByText('Yes', { exact: true })
    .click()
  await expect(page).toHaveURL(/svar=/)
  const result = page.locator('.aa-result')
  await expect(result).toContainText('Provider')
  await expect(result).toContainText('High-risk AI systems')
  await expect(result).toContainText('may involve')
  await expect(page.locator('.aa-obligation').first()).toBeVisible()
  const axe = await new AxeBuilder({ page }).include('.aiact').analyze()
  expect(axe.violations).toEqual([])
})

test('an article opens with its official text and application date', async ({
  page,
}) => {
  await page.goto('/#ai-act-article?a=50')
  await expect(page.locator('.aa-article h2')).toContainText('Article 50')
  await expect(page.locator('.aa-legal-text')).toContainText(
    'interacting with an AI system',
  )
  await expect(page.locator('.aa-article-facts')).toContainText('2 August 2026')
  await expect(page.locator('.aa-legal-text a.aa-source')).toHaveAttribute(
    'href',
    /eur-lex\.europa\.eu.*#art_50$/,
  )
})

test('changes list the amending act and what it changed', async ({ page }) => {
  await page.goto('/#ai-act-changes')
  const amendment = page.locator('.aa-change-amendment')
  await expect(amendment).toContainText('Regulation (EU) 2026/1744')
  await amendment.locator('summary').click()
  await expect(amendment.locator('.aa-provisions li').first()).toBeVisible()
})

test('the observatory works on a phone without sideways scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of [
    '#ai-act',
    '#ai-act-obligations',
    '#ai-act-startups',
    '#ai-act-timeline',
  ]) {
    await page.goto(`/${path}`)
    await expect(
      page.locator(path === '#ai-act' ? '.report' : '.aa-body'),
    ).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow, path).toBeLessThanOrEqual(1)
  }
})

test('the Riksdag view shows AI over time with the Act’s milestones and its method', async ({
  page,
}) => {
  await page.goto('/#ai-act-politics')
  await expect(
    page.getByRole('heading', { level: 1, name: 'The Riksdag and AI' }),
  ).toBeVisible()
  await expect(page.locator('.aa-line-plot svg')).toBeVisible()
  await expect(page.locator('.aa-milestone-key li').first()).toContainText(
    'Commission proposes',
  )
  await expect(page.locator('.aa-caveat')).toContainText(
    'does not prove causation',
  )
  await expect(page.locator('.aa-dictionary code').first()).toBeVisible()
  await expect(
    page.locator('.aa-excerpt').first().locator('.aa-kind'),
  ).toHaveText('Speech, verbatim')
  await page.getByRole('button', { name: 'Open the comparison' }).click()
  await expect(page.locator('.aa-sim li').first()).toContainText('similarity')
  const axe = await new AxeBuilder({ page }).include('.aiact').analyze()
  expect(axe.violations).toEqual([])
})

test('job ads and the AI governance timeline sit on the Act’s milestones', async ({
  page,
}) => {
  await page.goto('/#ai-act-jobs')
  await expect(
    page.getByRole('heading', { level: 1, name: 'In the job ads' }),
  ).toBeVisible()
  await expect(page.locator('.aa-line').first()).toBeAttached()
  await expect(page.locator('.aa-caveat').first()).toContainText(
    'does not prove causation',
  )
  await page.getByRole('button', { name: 'The AI Act by name' }).click()
  await expect(page).toHaveURL(/term=ai_act/)
  const axe = await new AxeBuilder({ page }).include('.aiact').analyze()
  expect(axe.violations).toEqual([])

  await page.goto('/#ai-act-signals')
  await expect(page.locator('.aa-panel')).toHaveCount(5)
  await expect(page.locator('.aa-milestone-tag').first()).toBeVisible()
  const axe2 = await new AxeBuilder({ page }).include('.aiact').analyze()
  expect(axe2.violations).toEqual([])
})
