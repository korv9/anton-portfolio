/**
 * The portfolio's user journeys, end to end: the chart feed by its
 * address, a visitor following an idea through the Concept Journey, and a technical reviewer tracing a result to its source
 * and opening the data catalogue.
 */
import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('a visitor opens the chart feed by its address', async ({ page }) => {
  // The published start page no longer links here; the address still opens it in local dev.
  await page.goto('/#what-does-it-even-mean')
  await expect(page).toHaveTitle('What does it even mean? | Anton Ernstsson')
})

test('a visitor follows an idea across stories, philosophy, politics and law', async ({
  page,
}) => {
  await page.goto('/#concept-journey')
  await page.getByRole('button', { name: 'Control', exact: true }).click()
  await expect(page).toHaveURL(/concept-journey\?begrepp=control/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Where does one idea appear, from stories to law?',
  )
  await expect(page.locator('.politik-intro')).toContainText(
    'never that one text influenced another',
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
  // No "not done" notes: an empty link is left out, not announced.
  await expect(page.locator('.concepts')).not.toContainText('No reviewed')
  await expect(page.locator('.interpretation')).toContainText('not influence')
  // Picking another idea keeps the choice in the address.
  await page.getByRole('button', { name: 'Autonomy', exact: true }).click()
  await expect(page).toHaveURL(/begrepp=autonomy/)
  await expect(page.locator('#resan-title')).toContainText('Autonomy')
  await expect(page.locator('.concepts')).not.toContainText(
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
