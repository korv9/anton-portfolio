import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the job market tells a demand story: a question, an answer, one chart, then deeper', async ({
  page,
}) => {
  await page.goto('/#jobb')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The job market in job ads',
  )
  await expect(page.locator('.project-hero-question')).toHaveText(
    'How is demand for labour changing?',
  )
  // The answer is one number against the same months a year earlier; one main chart follows.
  await expect(page.locator('.project-hero-finding b')).toHaveText(/^[+−±]\d/)
  await expect(page.locator('.jobb-columns rect.recent').first()).toBeVisible()
  await expect(page.locator('.interpretation-not')).toContainText(
    'proxy for demand',
  )
  // Growing roles, then where the clustering fits; the treemap and counties wait under Explore.
  await expect(
    page.getByRole('heading', { name: 'Which roles are growing?' }),
  ).toBeVisible()
  await expect(
    page.locator('.jobb-story a[href="#jobb-kluster"]'),
  ).toBeVisible()
  await expect(page.locator('#treemap')).toHaveCount(0)
  const answer = await page.locator('.project-hero-finding').textContent()

  // The field bar: choose Data/IT and the story answers for it.
  const bar = page.getByRole('group', { name: 'Occupation fields' })
  await bar.getByRole('button', { name: 'Data/IT', exact: true }).click()
  await expect(page).toHaveURL(/omraden=/)
  await expect(page.locator('.project-hero-summary')).toContainText('Data/IT')
  await expect(page.locator('.project-hero-finding')).not.toHaveText(answer!)

  // The choice follows the reader into the themes and on to every other theme.
  await page
    .locator('.project-subnav')
    .getByRole('link', { name: 'Trends' })
    .click()
  await expect(page).toHaveURL(/jobb-trender\?omraden=/)
  const nav = page.getByRole('navigation', { name: 'Job market' })
  for (const [name, question] of [
    ['How are ads developing?', 'How are job ads developing?'],
    ['Which occupations grow?', 'Which occupations are growing?'],
    ['Where are the jobs?', 'Where are the jobs?'],
    ['On what terms?', 'On what terms are people hired?'],
  ]) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(question)
    await expect(page).toHaveURL(/omraden=/)
    await expect(page.locator('.theme-chart-title')).toContainText('Data/IT')
    await page.getByRole('tab', { name: 'Table' }).click()
    await expect(page.locator('.theme-table table')).toBeVisible()
  }
  await bar.getByRole('button', { name: 'Show all' }).click()
  await expect(page.locator('.theme-chart-title')).toContainText(
    'the whole market',
  )

  // One chart per field, instead of overlapping lines.
  await page.goto('/#jobb-trender?diagram=omraden')
  await expect(page.locator('.jobb-multiple')).toHaveCount(6)

  // The earlier views live on under "Explore for yourself".
  await page.goto('/#jobb-utforska')
  await expect(page.locator('.explore-row')).toHaveCount(6)
  await page.locator('.explore-row[href="#job-market-occupations"]').click()
  await expect(page.getByTestId('market-occupations')).toBeVisible()
  await expect(
    nav.getByRole('link', { name: 'Explore for yourself' }),
  ).toHaveAttribute('aria-current', 'true')
})

test('the job-market dashboard is accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#jobb')
  await expect(page.locator('.jobb-columns')).toBeVisible()
  await page.getByRole('button', { name: 'Explore the data' }).click()
  await expect(page.locator('#treemap')).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
