import { test, expect } from './test'

test(
  'the cluster visuals draw the clearest clusterings as large maps with one caption',
  { tag: '@mobile' },
  async ({ page }) => {
    const lab: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/__cluster_lab/')) lab.push(r.url())
    })
    await page.goto('/#cluster-visuals')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Cluster visuals',
    )
    // The sentence demo leads; the old per-project sections are gone from this page.
    await expect(page.locator('#cv-place')).toBeVisible()
    await expect(page.locator('.cv .cv-section')).toHaveCount(0)
    const tiles = page.locator('.cv-tile')
    await expect(tiles).toHaveCount(7)
    await expect(tiles.first()).toHaveAttribute('id', 'cv-map-jobs-detail')
    // Only models whose gate passed are listed, each with its verdict.
    const models = page.locator('#cv-models .model-card')
    await expect(models.first()).toBeAttached()
    await expect(page.locator('#cv-models .model-verdict.is-held')).toHaveCount(
      0,
    )
    // The atlas reads its counts from meta.json and lists links between corpora.
    const meta = await (await page.request.get('/data/atlas/meta.json')).json()
    const shared = page.locator('#cv-atlas')
    await expect(shared.locator('.cx-question')).toContainText(
      meta.passages.toLocaleString('en-GB'),
    )
    await expect(shared.locator('canvas')).toHaveCount(1)
    await expect(shared.locator('table').first()).toBeAttached()
    // Maps far down the page have not asked for their data yet.
    await expect(page.locator('#cv-map-debates-legacy canvas')).toHaveCount(0)
    await expect(
      page.locator('#cv-map-debates-legacy .cv-tile-map'),
    ).toHaveAttribute('aria-busy', 'true')
    // Captions carry the counts from the data files.
    const atlas = await (
      await page.request.get('/data/philosophy/atlas.json')
    ).json()
    for (const [key, n] of [
      ['philosophy-author', atlas.author_centered.length],
    ]) {
      const tile = page.locator(`#cv-map-${key}`)
      await tile.scrollIntoViewIfNeeded()
      const canvas = tile.locator('canvas')
      await expect(canvas).toHaveAttribute('aria-hidden', 'true')
      await expect(canvas).not.toHaveAttribute('data-points', '0')
      await expect(tile.locator('figcaption h2')).not.toBeEmpty()
      await expect(tile.locator('figcaption .cv-specs')).toContainText(
        `${n.toLocaleString('en-GB')} points`,
      )
    }
    // No legends in the gallery, and no method block under it.
    await expect(tiles.locator('.cv-legend')).toHaveCount(0)
    await expect(page.locator('details.cv-method')).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width)
    expect(lab).toEqual([])
  },
)

test(
  'research maps show source IDs and the full-run counts of their run',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#cluster-visuals')
    for (const slug of [
      'debate-topics',
      'philosophy-topics',
      'municipalities',
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
      // Only the clearest maps are drawn in the gallery; the others are checked as data.
      if (slug !== 'debate-topics') continue
      const tile = page.locator(`#cv-map-${slug}`)
      await tile.scrollIntoViewIfNeeded()
      await expect(tile.locator('canvas')).toBeVisible()
      await expect(tile.locator('.cv-specs')).toContainText(
        `${data.observations.toLocaleString('en-GB')} points`,
      )
      await expect(tile.locator('.cv-specs')).toContainText(
        `${data.clusters} clusters`,
      )
    }
    // The hero map keeps its named debate subjects.
    const place = page.locator('#cv-place')
    await place.scrollIntoViewIfNeeded()
    await expect(place.locator('canvas')).toBeVisible()
    const first = place.locator('.cv-legend button').first()
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
  },
)
