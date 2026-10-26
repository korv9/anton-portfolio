/**
 * When does a law arrive? (#lag-ankomst): five sections, each figure read from the committed
 * ai-act files at load time. Checks the page against the JSON, not against typed-in numbers.
 */
import { test, expect } from './test'

const SECTIONS = [
  'aiclock-question',
  'aiclock-jobs',
  'aiclock-riksdag',
  'aiclock-lags',
  'aiclock-law',
]

test('the AI Act clock shows its sections with figures from the data @mobile', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#lag-ankomst')
  await expect(page.locator('h1')).toHaveText('When does a law arrive?')
  for (const id of SECTIONS)
    await expect(page.locator(`#${id} h2`)).toBeVisible()

  const get = async (path: string) =>
    (await request.get(`/data/ai-act/${path}`)).json()
  const diffusion = await get('diffusion.json')
  const speeches = await get('politics/summary.json')
  const act = await get('summary.json')

  // The lag test states the significant count from diffusion.json and that most are not.
  const sig = diffusion.lags.filter(
    (x: { placebo_p: number | null }) =>
      x.placebo_p !== null && x.placebo_p <= 0.05,
  ).length
  expect(sig).toBe(
    diffusion.diagnostics.primary.p_at_most_0_05 +
      diffusion.diagnostics.amended.p_at_most_0_05,
  )
  const lags = page.locator('#aiclock-lags .ac-finding').first()
  await expect(lags).toContainText(`${sig} reach p ≤ 0.05`)
  await expect(lags).toContainText(`Of ${diffusion.lags.length} lags`)
  await expect(page.locator('#aiclock-lags')).toContainText('no shorter than')

  await expect(page.locator('#aiclock-riksdag .ac-finding')).toContainText(
    `${speeches.counts.ai_act_speeches} name the AI Act`,
  )
  await expect(page.locator('#aiclock-law .ac-finding')).toContainText(
    `${act.counts.articles_changed} of its ${act.counts.articles} articles`,
  )
  await expect(page.locator('#aiclock-question li')).toHaveCount(
    diffusion.milestones.length,
  )

  // Swedish copy through l().
  await page.goto('/?lang=sv#lag-ankomst')
  await expect(page.locator('h1')).toHaveText('När kommer en lag fram?')
  expect(errors).toEqual([])
})

test('the English address leads to the clock', async ({ page, isMobile }) => {
  test.skip(isMobile, 'routing is the same on a phone')
  await page.goto('/#ai-act-clock')
  await expect(page).toHaveURL(/#lag-ankomst$/)
  await expect(page.locator('#aiclock-jobs h2')).toBeVisible()
})
