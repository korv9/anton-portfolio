/** Idea Lineage: a dated timeline of public events, the "why" trace and the derived views. */
import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the lineage shows why book-centring exists and what each project is doing now', async ({
  page,
}) => {
  await page.goto('/#idea-lineage')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'How do ideas become decisions',
  )
  await expect(page.locator('.il-day').first()).toBeVisible()
  const decision = page.locator('.il-event', {
    has: page.getByRole('heading', {
      name: 'Centre the embeddings by book before clustering',
    }),
  })
  await decision.getByRole('button', { name: 'Why does this exist?' }).click()
  await expect(page.locator('.il-tracing')).toContainText(
    'Centre the embeddings by book',
  )
  // Only the events it came from remain, back to the first idea.
  await expect(page.locator('.il-event')).toHaveCount(4)
  await expect(page.locator('.il-timeline')).toContainText(
    'The baseline clusters followed books, not symbols',
  )
  await page.getByRole('button', { name: 'Show everything' }).click()
  await page.getByLabel('Kind').selectOption('question')
  await expect(page.locator('.il-event .il-kind').first()).toContainText(
    'Open question',
  )
  await page.getByRole('button', { name: 'Projects now' }).click()
  await expect(page.locator('.il-project').first()).toContainText(
    'Current direction',
  )
  await page.getByRole('button', { name: 'Set aside' }).click()
  await expect(page.locator('.il-aside h2')).toHaveText(
    'Ideas I chose not to build',
  )
  const axe = await new AxeBuilder({ page })
    .include('.idea-lineage')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual(
    [],
  )
})
