/**
 * Replik (#replik): six sections, each finding read from its file at load
 * time. Checks the page against the committed JSON, not against numbers typed into the test.
 */
import { test, expect } from './test'

const SECTIONS = [
  'replik-eras',
  'replik-parties',
  'replik-agenda',
  'replik-votes',
  'replik-model',
  'replik-now',
]

test('Replik shows its six sections with findings from the data @mobile', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#replik')
  await expect(page.locator('h1')).toHaveText('Replik')
  for (const id of SECTIONS)
    await expect(page.locator(`#${id} h2`)).toBeVisible()
  await expect(page.locator('#replik-now .rank-bars').first()).toBeVisible()

  // Every party gets its own card, chart and scale.
  await expect(page.locator('#replik-parties .rk-party')).toHaveCount(8)
  await expect(page.locator('#replik-votes .rk-spark')).toHaveCount(8)

  // R5 from parliament/sessions.json: the latest session's figure is on the page.
  const sessions = await (
    await request.get('/data/parliament/sessions.json')
  ).json()
  const last = sessions.sessions.at(-1).session
  const outside = sessions.party_record
    .filter(
      (r: { session: string; role: string }) =>
        r.session === last && r.role !== 'government',
    )
    .sort(
      (
        a: { with_government_pct: number },
        b: { with_government_pct: number },
      ) => b.with_government_pct - a.with_government_pct,
    )[0]
  await expect(page.locator('#replik-votes .rk-finding').first()).toContainText(
    `${outside.with_government_pct.toFixed(1)}%`,
  )

  // R4 reads the same-debate AUC, never the all-party one.
  await expect(page.locator('#replik-model .rk-finding')).toContainText(
    'same debate',
  )

  // Unnamed topic groups get a description, field codes never show.
  const text = await page.locator('article.replik').innerText()
  expect(text).not.toMatch(/\b(Group|Cluster) \d/)
  expect(text).not.toMatch(/kantrubrik|mergeformat|styleref/i)

  // No sideways scrolling on a phone.
  const [scroll, width] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ])
  expect(scroll).toBeLessThanOrEqual(width)
  expect(errors).toEqual([])
})

test('Replik picks a decade for the party profiles', async ({ page }) => {
  await page.goto('/#replik')
  const decades = page.locator('#replik-parties .rk-pick button')
  await expect(decades.last()).toHaveAttribute('aria-pressed', 'true')
  await decades.first().click()
  await expect(decades.first()).toHaveAttribute('aria-pressed', 'true')
  // SD entered the Riksdag in 2010: the 1990s card says so instead of showing bars.
  await expect(
    page.locator('#replik-parties .rk-party', { hasText: 'Sweden Democrats' }),
  ).toContainText('Not in the Riksdag')
})
