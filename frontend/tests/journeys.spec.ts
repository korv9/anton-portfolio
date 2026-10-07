/**
 * The portfolio's user journeys, end to end: a startup reading the AI Act, a visitor following
 * an idea through the Concept Journey, and a technical reviewer tracing a result to its source
 * and opening the data catalogue.
 */
import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('a startup finds what applies, uses the navigator and reaches the law', async ({
  page,
}) => {
  await page.goto('/#start')
  await page.locator('#projekt a[href="#ai-act"]').first().click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'What applies now?' }),
  ).toBeVisible()
  await expect(page.locator('.aa-now-more')).toContainText('Last verified')
  await page.locator('.aa-who a[href="#ai-act-startups"]').click()
  await page
    .locator('.aa-question')
    .filter({ hasText: 'under your own name' })
    .getByText('Yes', { exact: true })
    .click()
  const result = page.locator('.aa-result')
  await expect(result).toContainText('Navigation aid, not legal advice.')
  await expect(result).toContainText('Role considerations')
  await expect(result.locator('a.aa-source')).toHaveAttribute(
    'href',
    /eur-lex\.europa\.eu/,
  )
  // An obligation shows its three layers: plain language, the law, the data model.
  const obligation = page.locator('.aa-obligation').first()
  await expect(obligation.locator('.aa-summary')).toBeVisible()
  await expect(obligation.locator('blockquote')).toBeVisible()
  await obligation.locator('.aa-model summary').click()
  await expect(obligation.locator('.aa-model')).toContainText(
    'mart_ai_act_obligations',
  )
  await expect(obligation.locator('a.aa-source')).toHaveAttribute(
    'href',
    /eur-lex\.europa\.eu/,
  )
})

test('a visitor follows an idea across stories, philosophy, politics and law', async ({
  page,
}) => {
  await page.goto('/#concept-constellation')
  await page.locator('.cj-start a', { hasText: 'Control' }).click()
  await expect(page).toHaveURL(/concept-journey\?begrepp=control/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'How do the same ideas appear',
  )
  await expect(page.locator('.cj-hero')).toContainText(
    'semantic similarity, not historical influence',
  )
  // Four domains, each with passages that open their source.
  await expect(page.locator('.cj-domain')).toHaveCount(4)
  const law = page.locator('.cj-domain-law')
  await expect(law.locator('.cj-passages li').first()).toBeVisible()
  await expect(law.locator('.cj-source a').first()).toHaveAttribute(
    'href',
    /^https:\/\//,
  )
  // Every link says what kind of relation it is, and the law links to the AI Act.
  await expect(law.locator('.cj-relation').first()).toContainText(
    'Semantic similarity',
  )
  await expect(law.locator('a[href="#ai-act-obligations"]')).toBeVisible()
  // The stories say plainly that no reviewed symbolic cluster is linked yet.
  await expect(page.locator('.cj-domain-myth .cj-note').first()).toContainText(
    'No reviewed Symbolic Atlas cluster',
  )
  await expect(page.locator('.interpretation')).toContainText('not influence')
  // Picking another idea keeps the choice in the address.
  await page.getByRole('button', { name: 'Autonomy', exact: true }).click()
  await expect(page).toHaveURL(/begrepp=autonomy/)
  await expect(page.locator('.cj-concept-title')).toHaveText('Autonomy')
  await expect(page.locator('.cj-domain-law .cj-note').last()).toContainText(
    'nothing is filled in',
  )
  const axe = await new AxeBuilder({ page })
    .include('.concepts')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual(
    [],
  )
})

test('a technical reviewer traces a result and reads the catalogue', async ({
  page,
}) => {
  await page.goto('/#ai-act')
  await page.locator('.trace summary').first().click()
  const trace = page.locator('.trace').first()
  await expect(trace.locator('.trace-path')).toContainText(
    'mart_ai_act_timeline',
  )
  await expect(trace.locator('.trace-path')).toContainText(
    'EU Publications Office',
  )
  await trace.locator('a.trace-full').click()
  await expect(page).toHaveURL(/data-constellation\?view=lineage&node=/)

  await page.goto('/#data-catalogue')
  await expect(page.locator('.catalogue-status-grid')).toContainText(
    'EU AI Act',
  )
  await page.getByRole('searchbox').fill('obligations')
  const row = page
    .locator('.catalogue-item')
    .filter({ hasText: 'ai-act/obligations.json' })
  await row.locator('summary').click()
  await expect(row.locator('.catalogue-facts')).toContainText(
    'mart_ai_act_obligations',
  )
  await expect(row.locator('.catalogue-facts')).toContainText('source_quote')
  await expect(row.locator('.catalogue-check').first()).toBeVisible()
  await page.getByRole('searchbox').fill('nothing-matches-this')
  await expect(page.locator('.catalogue-list')).toContainText(
    'No dataset matches these filters.',
  )
})
