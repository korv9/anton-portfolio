import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('political evidence remains traceable across votes, speeches and laws', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#politics')
  const lab = page.locator('#politics')
  await expect(lab.locator('.vote-stack-row')).toHaveCount(8)
  await expect(
    lab.getByText('787 roll calls in this view · all eight parties'),
  ).toBeVisible()
  await lab.getByLabel('Voting session').selectOption('2024/25')
  await expect(
    lab.getByText('649 roll calls in this view · all eight parties'),
  ).toBeVisible()
  await lab
    .getByRole('combobox', { name: 'Committee', exact: true })
    .selectOption('MJU')
  await expect(lab.locator('.vote-stack-row')).toHaveCount(8)
  await lab.locator('.decision-list button').first().click()
  await expect(lab.locator('.decision-party-grid > div')).toHaveCount(8)
  await lab.getByText(/Named member votes/).click()
  expect(await lab.locator('.member-votes p').count()).toBeGreaterThan(300)
  await expect(
    lab.getByText('No tightening/loosening party score is assigned.', {
      exact: false,
    }),
  ).toBeVisible()
  await lab.getByRole('button', { name: 'Speech archive', exact: true }).click()
  await lab.locator('.decision-list button').first().click()
  await expect(lab.locator('.speech-record')).toHaveCount(15)
  await lab.locator('.speech-record summary').first().click()
  expect(
    (await lab.locator('.speech-record .source-text').first().innerText())
      .length,
  ).toBeGreaterThan(100)
  await lab
    .getByRole('combobox', { name: 'Archive', exact: true })
    .selectOption('issues')
  await lab.locator('.decision-list button').first().click()
  await expect(lab.locator('.speech-record').first()).toBeVisible()
  await lab.getByRole('button', { name: 'Law & sources', exact: true }).click()
  await expect(lab.locator('.engine-result')).toHaveCount(0)
  await lab.getByLabel('Law snapshot').selectOption({ index: 1 })
  await expect(lab.locator('.law-text details').first()).toBeVisible()
  await lab.locator('.law-text summary').first().click()
  await expect(lab.locator('.source-hash').first()).toContainText('SHA-256')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const results = await new AxeBuilder({ page })
    .include('#politics')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
  expect(errors).toEqual([])
})
