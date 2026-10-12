import { test, expect } from './test'

test('an unrecognised market view waits for data before showing trends', async ({
  page,
}) => {
  let release: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/data/jobs/market.json', async (route) => {
    await ready
    await route.continue()
  })
  await page.goto('/#jobb-unknown')
  await expect(page.locator('.theme-loading')).toBeVisible()
  release()
  await expect(page.locator('.theme-loading')).toHaveCount(0)
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('.page-failed')).toHaveCount(0)
  expect(errors).toEqual([])
})
test('old market views resolve to the corresponding topic', async ({
  page,
}) => {
  for (const [old, next] of [
    ['job-market', 'jobb'],
    ['job-market-occupations', 'jobb-yrken'],
    ['job-market-regions', 'jobb-lan'],
    ['job-market-conditions', 'jobb-villkor'],
  ]) {
    await page.goto(`/#${old}`)
    await expect(page).toHaveURL(new RegExp(`#${next}$`))
    await expect(page.locator('main h1')).toBeVisible()
  }
})
