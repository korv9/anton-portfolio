import { test, expect } from './test'

// GitHub and the ingestion status live outside the repository; the test answers for both.
const now = Date.now()
const iso = (hoursAgo: number) => new Date(now - hoursAgo * 36e5).toISOString()
const run = (id: number, conclusion: string, hoursAgo: number) => ({
  id,
  name: 'Refresh public data',
  status: 'completed',
  conclusion,
  created_at: iso(hoursAgo),
  updated_at: iso(hoursAgo - 0.5),
  html_url: `https://github.com/korv9/anton-portfolio/actions/runs/${id}`,
})
const demo = `# Demo

## Resultat från lokal körning (syntetiskt)

| Steg | new | changed | unchanged | deleted | Bronze-rader totalt |
|---|---|---|---|---|---|
| 1 batch A | 4 | 0 | 0 | 0 | 5 |
| 2 batch B | 1 | 1 | 1 | 1 | 9 |
| 3 batch B igen (nytt run_id) | 0 | 0 | 4 | 0 | 13 |
| 4 samma run_id igen | 0 | 0 | 4 | 0 | 13 |
`

test.beforeEach(async ({ page }) => {
  await page.route('https://api.github.com/**', (route) => {
    const url = decodeURIComponent(route.request().url())
    if (url.includes('/actions/runs'))
      return route.fulfill({
        json: { workflow_runs: [run(3, 'success', 2), run(2, 'failure', 26)] },
      })
    if (url.includes('/issues'))
      return route.fulfill({
        json: [
          {
            number: 109,
            title: 'Data pipeline failed: Refresh public data',
            html_url: 'https://github.com/korv9/anton-portfolio/issues/109',
            body: 'Workflow: Refresh public data\n\nFailed jobs and steps:\n- refresh: Data contracts',
            created_at: iso(25),
            closed_at: iso(1),
          },
        ],
      })
    if (url.includes('/contents/docs/incidents'))
      return route.fulfill({
        json: [
          {
            name: '2026-10-22-warehouse-wipe.md',
            html_url:
              'https://github.com/korv9/anton-portfolio/blob/main/docs/incidents/2026-10-22-warehouse-wipe.md',
          },
        ],
      })
    if (url.includes('/contents/docs/demo.md'))
      return route.fulfill({
        json: { content: Buffer.from(demo).toString('base64') },
      })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.route('**/status/ingestion.json', (route) =>
    route.fulfill({
      json: {
        subjects: {
          welfare: {
            recorded_at: iso(3),
            outcome: 'success',
            github_run:
              'https://github.com/korv9/anton-portfolio/actions/runs/3',
            sources: [{ source_key: 'scb' }, { source_key: 'fohm' }],
          },
          market: {
            recorded_at: iso(4),
            outcome: 'failure',
            last_success_at: iso(28),
            sources: [{ source_key: 'jobtech' }],
          },
        },
      },
    }),
  )
})

test('the platform page shows live status, run health, the Fabric lakehouse and the stack map', async ({
  page,
}) => {
  await page.goto('/#platform')
  await expect(page.locator('main h1')).toHaveText('The data platform')
  const status = page.getByTestId('platform-status')
  await expect(status).toContainText('3 h ago')
  await expect(status).toContainText('1/2')
  await expect(status).toContainText('3')
  await expect(page.locator('.tour-rail')).toBeVisible()
  await expect(page.getByText('Example:')).toBeVisible()
  await expect(page.getByTestId('run-health-total')).toContainText(
    '2 scheduled runs in the last 30 days, 1 red.',
  )
  await expect(
    page.locator('.platform-causes a[href$="/issues/109"]'),
  ).toBeVisible()
  await expect(page.locator('.platform-steps')).toContainText('Data contracts')
  await expect(
    page.getByRole('link', { name: '2026-10-22: warehouse wipe' }),
  ).toBeVisible()
  await expect(page.locator('#platform-fabric tbody tr')).toHaveCount(4)
  await expect(page.locator('#platform-fabric')).toContainText(
    'the 2 reruns of batch B report 0 new, changed or deleted records',
  )
  await expect(page.locator('#platform-stack tbody tr')).toHaveCount(4)
})

for (const old of ['#ask-platform', '#diva-lakehouse'])
  test(`${old} leads to the platform page`, async ({ page }) => {
    await page.goto(`/${old}`)
    await expect(page).toHaveURL(/#platform$/)
    await expect(page.locator('main h1')).toHaveText('The data platform')
  })

test('the projects page links to the platform page', async ({ page }) => {
  await page.goto('/#projekt')
  await page.getByRole('link', { name: 'The platform on one page' }).click()
  await expect(page).toHaveURL(/#platform$/)
})
