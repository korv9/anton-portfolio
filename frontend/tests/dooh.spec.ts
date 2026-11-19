/**
 * When does the audience arrive? (#publiken): a KPI head and one chart with five views, each read
 * from the committed dooh files. Checks the page against the JSON, not typed-in numbers.
 */
import { test, expect } from './test'

const SHOWS = ['stations', 'hours', 'profiles', 'new', 'opening']

test('the dooh page shows five views with figures from the data @mobile', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const stations = await (await request.get('/data/dooh/stations.json')).json()
  const planned = await (
    await request.get('/data/dooh/new-stations.json')
  ).json()

  await page.goto('/#publiken')
  await expect(page.locator('h1')).toHaveText('When does the audience arrive?')
  const kpis = page.locator('.page-head-kpis')
  await expect(kpis).toContainText(stations.totals.at(-1).toLocaleString('en'))
  await expect(kpis).toContainText(String(planned.stations.length))
  const show = page.getByRole('group', { name: 'Show' }).getByRole('button')
  await expect(show).toHaveCount(SHOWS.length)

  // Each view has a title; the new-station view says whether the model beat the median.
  for (const key of SHOWS) {
    await page.goto(`/#publiken?show=${key}`)
    await expect(page.locator('#dooh-chart h2')).toBeVisible()
  }
  await page.goto('/#publiken?show=new')
  if (planned.check.label !== 'model')
    await expect(page.locator('#dooh-chart h2')).toContainText(
      'did not beat the median',
    )
  await expect(page.locator('.od-rows li')).toHaveCount(
    planned.stations.filter((s: { kind: string }) => s.kind === 'new').length,
  )

  // Swedish copy through l().
  await page.goto('/?lang=sv#publiken')
  await expect(page.locator('h1')).toHaveText('När kommer publiken fram?')
  expect(errors).toEqual([])
})

test('the English address leads to the page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'routing is the same on a phone')
  await page.goto('/#dooh')
  await expect(page).toHaveURL(/#publiken$/)
})
