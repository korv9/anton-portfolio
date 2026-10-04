import { test, expect } from './test'

test('monthly chart positions observations by date and sorts input', async ({
  page,
}) => {
  await page.route('**/gold/marts/jobs.json', async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    data.roles = ['Data Engineer']
    data.monthly = [
      { month: '2024-05-01', new_ads: 30 },
      { month: '2024-01-01', new_ads: 10 },
      { month: '2024-02-01', new_ads: 20 },
    ].map((row) => ({ ...row, role: 'Data Engineer', unique_employers: 1 }))
    await route.fulfill({ json: data })
  })
  await page.goto('/#job-market-tech')
  const points = page.locator('.line-chart .line-point')
  await expect(points).toHaveCount(3)
  const x = await points.evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('cx'))),
  )
  expect((x[2] - x[1]) / (x[1] - x[0])).toBeCloseTo(90 / 31, 4)
  await expect(points.first()).toHaveAttribute('aria-label', /2024-01: 10/)
})

test('RFC composition retains a full whole and visible counts', async ({
  page,
}) => {
  await page.goto('/#rfc-drift')
  const data = await (
    await page.request.get('/data/gold/marts/rfc-drift.json')
  ).json()
  await expect(page.locator('.composition-stack')).toHaveCount(
    data.versions.length,
  )
  for (let i = 0; i < data.versions.length; i++) {
    const version = data.versions[i]
    const segments = page.locator('.composition-stack').nth(i).locator('i')
    const weights = await segments.evaluateAll((nodes) =>
      nodes.map((node) => Number(getComputedStyle(node).flexGrow)),
    )
    expect(weights).toEqual(
      ['binding', 'weak', 'absent'].map((key) => version.counts[key]),
    )
    expect(weights.reduce((a, b) => a + b, 0)).toBe(version.requirements)
    await expect(page.locator('.composition-legend').nth(i)).toContainText(
      `${version.shares_pct.binding}%`,
    )
  }
})
