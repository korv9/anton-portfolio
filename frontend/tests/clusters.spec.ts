import { test, expect } from './test'

test(
  'the cluster visuals draw every clustering from its data and pick a cluster',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#cluster-visuals')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Cluster visuals',
    )
    await expect(page.locator('.cv-section')).toHaveCount(7)
    // The philosophy map is served with the site: its count comes from the file.
    const atlas = await (
      await page.request.get('/data/philosophy/atlas.json')
    ).json()
    const philosophy = page.locator('#cv-philosophy')
    await philosophy.scrollIntoViewIfNeeded()
    await expect(philosophy.locator('canvas')).toHaveAttribute(
      'aria-label',
      new RegExp(
        `${atlas.author_centered.length.toLocaleString('en-GB')} points`,
      ),
    )
    const first = philosophy.locator('.cv-legend button').first()
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'false')
    // It has two views.
    await philosophy.getByRole('button', { name: 'Raw' }).click()
    await expect(philosophy.locator('canvas')).toBeVisible()
  },
)

test(
  'research maps show source IDs and the full-run counts of their run',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#cluster-visuals')
    for (const [slug, id] of [
      ['debate-topics', 'research-debates'],
      ['philosophy-topics', 'research-philosophy'],
      ['municipalities', 'research-municipalities'],
    ]) {
      const response = await page.request.get(
        `/data/cluster-research/${slug}.json`,
      )
      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      expect(new Set(data.points.map((p: unknown[]) => p[0])).size).toBe(
        data.points.length,
      )
      expect(
        data.points.every(
          (p: unknown[]) => Number.isFinite(p[1]) && Number.isFinite(p[2]),
        ),
      ).toBeTruthy()
      const section = page.locator(`#cv-${id}`)
      await section.scrollIntoViewIfNeeded()
      await expect(section.locator('canvas')).toBeVisible()
      await expect(section.locator('.cv-specs')).toContainText(
        `${data.observations.toLocaleString('en-GB')} points`,
      )
      await expect(section.locator('.cv-specs')).toContainText(
        `${data.clusters} clusters`,
      )
    }
  },
)
