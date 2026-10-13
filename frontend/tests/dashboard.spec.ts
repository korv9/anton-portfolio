import { test, expect } from './test'

test('politics is a report in three tabs, each with its question', async ({
  page,
}) => {
  await page.goto('/#politik')
  await expect(page.locator('.politik-intro')).toContainText(
    'Open data on Swedish politics',
  )
  const tabs = page.getByRole('navigation', { name: 'Report' })
  await expect(tabs.getByRole('link')).toHaveText([
    /Power and opinion/,
    /Budget and taxes/,
    /Debates and decisions/,
  ])
  const question = page.getByRole('heading', { level: 1 })
  await expect(question).toHaveText('Who holds power, and who is gaining?')
  // The main chart, then the two that complete it: at most three charts in a tab.
  await expect(page.locator('#mandat .seat-lines')).toBeVisible()
  await expect(page.locator('.report-tab .feature')).toHaveCount(3)
  await page.getByRole('button', { name: 'Opinion', exact: true }).click()
  await expect(page.locator('#opinionen .trend')).toBeVisible()

  await tabs.getByRole('link', { name: /Budget and taxes/ }).click()
  await expect(page).toHaveURL(/#politik-budget$/)
  await expect(question).toHaveText(
    'What do the parties want to do with the money?',
  )
  await expect(page.locator('#budgetflode')).toBeVisible()

  await tabs.getByRole('link', { name: /Debates and decisions/ }).click()
  await expect(question).toHaveText(
    'What does the Riksdag talk about, and what becomes law?',
  )
  await expect(
    page.locator('#sakomraden .rank-bars-list li').first(),
  ).toBeVisible()
  await expect(page.locator('.report-tab .feature')).toHaveCount(3)
})

test('the parties chosen in one tab follow the reader to the next, and to a deep dive', async ({
  page,
}) => {
  await page.goto('/#politik')
  const logos = page.locator('.report-slicers').getByRole('group', {
    name: 'Parties',
  })
  for (const name of ['Social Democrats', 'Moderates'])
    await logos.getByRole('button', { name }).click()
  await expect(page).toHaveURL(/partier=S%2CM|partier=S,M/)
  await page
    .getByRole('navigation', { name: 'Report' })
    .getByRole('link', { name: /Debates and decisions/ })
    .click()
  await expect(page).toHaveURL(/#politik-tal\?partier=/)
  await expect(logos.getByRole('button', { pressed: true })).toHaveCount(2)
  // The ways further in open pages of their own, with the way back.
  await page
    .getByRole('navigation', { name: 'Go deeper' })
    .getByRole('link', { name: /Party-leader debates/ })
    .click()
  await expect(page).toHaveURL(/#politik-partiledardebatter\?partier=/)
  await page.getByRole('link', { name: /Political Observatory/ }).click()
  await expect(page).toHaveURL(/#politik\?partier=/)
})
