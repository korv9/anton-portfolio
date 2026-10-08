/**
 * Controls do what they say: a filter can be chosen from the keyboard, a chosen state is
 * announced (aria-pressed), and a view that lives in the address survives a reload.
 */
import { test, expect } from './test'

test('a navigator scenario survives a reload and can be cleared', async ({
  page,
}) => {
  await page.goto('/#ai-act-startups')
  const question = page
    .locator('.aa-question')
    .filter({ hasText: 'under your own name' })
  await question.getByText('Yes', { exact: true }).click()
  await expect(page).toHaveURL(/svar=[^&]*(:|%3A)yes/)
  await page.reload()
  await expect(
    page
      .locator('.aa-question')
      .filter({ hasText: 'under your own name' })
      .locator('input')
      .first(),
  ).toBeChecked()
  // Choosing the same answer again takes it back.
  await page
    .locator('.aa-question')
    .filter({ hasText: 'under your own name' })
    .getByText('Yes', { exact: true })
    .click()
  await expect(page).not.toHaveURL(/svar=[^&]*(:|%3A)yes/)
})

test('the job-market field slicer chooses, announces and resets', async ({
  page,
}) => {
  await page.goto('/#jobb')
  const slicer = page.getByRole('group', { name: 'Occupation fields' })
  const first = slicer.locator('ul button').first()
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  const state = slicer.locator('.politik-slicer-state')
  await expect(state).not.toContainText('Whole market')
  await state.getByRole('button', { name: 'Show all' }).click()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await expect(state).toContainText('Whole market')
})

test('the Symbolic Atlas view chips explain their colours', async ({
  page,
}) => {
  await page.goto('/#symbolic-atlas?view=cross-book')
  const key = page.locator('.atlas-key')
  await expect(key).toContainText('Cross-book candidate')
  await expect(key).toContainText('Reviewed and named')
  await page.getByRole('button', { name: 'Reviewed', exact: true }).click()
  await expect(page).toHaveURL(/view=reviewed/)
  await expect(key).not.toContainText('Cross-book candidate')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Reviewed', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})
