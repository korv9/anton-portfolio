import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

// Deliberate browser fixtures; no test dataset is written into public delivery.
const roles = ['Data Engineer', 'Software Developer', 'Software Developer']
const points = roles.map((role, index) => ({
  id: `test-${index}`,
  x: index,
  y: index,
  cluster: index < 2 ? index : -1,
  probability: index < 2 ? 1 : 0,
  role,
  year: 2024 + (index % 2),
  title: `Test advertisement ${index}`,
}))
const profile = (id: number, label: string, role: string) => ({
  cluster_id: id,
  cluster_label: label,
  job_count: 1,
  dataset_share: 1 / 3,
  junior_share: 0,
  senior_share: 1,
  unspecified_share: 0,
  mean_probability: 1,
  top_skills: [{ skill: `Skill ${id}`, count: 1, lift: 2 }],
  top_titles: [{ label: `Title ${id}`, count: 1, share: 1 }],
  role_distribution: [{ label: role, count: 1, share: 1 }],
  representative_ads: [],
  years: [
    { label: '2024', count: 1, share: 0.5 },
    { label: '2025', count: 1, share: 0.5 },
  ],
  label_uncertainty: 'Test fixture',
})
const summary = {
  schema_version: 1,
  run_id: 'test',
  generated_at: '2026-10-04',
  source_size: 3,
  sampled: false,
  source_kinds: ['historical'],
  config: { model: 'Test model', assignment_method: 'seed-consensus' },
  coverage: [
    { month: '2024-01-01', status: 'complete', url: '', sha256: '' },
    { month: '2025-01-01', status: 'complete', url: '', sha256: '' },
  ],
  shards: ['jobs/clusters/test/points-0.json'],
  clusters: [
    profile(-1, 'Unassigned', 'Software Developer'),
    profile(0, 'Test group A', 'Data Engineer'),
    profile(1, 'Test group B', 'Software Developer'),
  ],
  diagnostics: {
    dataset_size: 3,
    cluster_count: 2,
    noise_share: 1 / 3,
    trustworthiness: 0.9,
    trustworthiness_sample_size: 3,
    silhouette: null,
    mean_cluster_probability: 1,
    limitations: 'Test fixture',
  },
}

async function serve(page: import('@playwright/test').Page) {
  await page.route('**/jobs/cluster-summary.json', (r) =>
    r.fulfill({ json: summary }),
  )
  await page.route('**/jobs/clusters/test/points-0.json', (r) =>
    r.fulfill({ json: { run_id: 'test', points } }),
  )
}

test('the map, the ranked groups and the picked profile work together', async ({
  page,
}) => {
  await serve(page)
  await page.goto('/#jobb-kluster')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'What groups do IT job ads form?',
  )
  const explorer = page.locator('.cluster-explorer')
  await expect(explorer.locator('canvas')).toBeVisible()
  await expect(explorer.locator('.cluster-finding')).toContainText(
    '3 IT ads from 2024–2025 form 2 groups',
  )
  // The largest group is picked first; picking another moves the profile.
  await expect(explorer.locator('.cluster-profile h2')).toHaveText(
    '1. Test group A',
  )
  await explorer.getByRole('button', { name: /2. Test group B/ }).click()
  await expect(explorer.locator('.cluster-profile h2')).toHaveText(
    '2. Test group B',
  )
  await expect(explorer.locator('.cluster-profile')).toContainText('Skill 1')
  await expect(explorer.locator('.cluster-noise')).toContainText('fit no group')
  await explorer.getByRole('button', { name: 'Job titles' }).click()
  await expect(explorer.locator('.cluster-key')).toContainText('Data Engineer')
  await explorer.getByText('Method and limits').click()
  await expect(explorer).toContainText('at least two of three runs')
  const results = await new AxeBuilder({ page })
    .include('.cluster-explorer')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('loading, unavailable data and retry are honest', async ({ page }) => {
  let requests = 0
  await page.route('**/jobs/cluster-summary.json', async (r) => {
    requests++
    if (requests === 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await r.fulfill({ status: 404, body: 'missing' })
    } else await r.fulfill({ json: summary })
  })
  await page.route('**/jobs/clusters/test/points-0.json', (r) =>
    r.fulfill({ json: { run_id: 'test', points } }),
  )
  await page.goto('/#jobb-kluster')
  await expect(page.getByText('Loading the semantic map…')).toBeVisible()
  await expect(
    page.getByText('The clustering analysis is unavailable just now.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.cluster-explorer canvas')).toBeVisible()
})

test('the old clustering address lands on the theme', async ({ page }) => {
  await serve(page)
  await page.goto('/#job-market-clusters')
  await expect(page).toHaveURL(/#jobb-kluster$/)
  await expect(page.locator('.cluster-explorer canvas')).toBeVisible()
})

test('home loads only preview and stays within mobile width', async ({
  page,
  isMobile,
}) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Anton Ernstsson',
  )
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  expect(
    requests.some((url) => /cluster-summary|points-\d\.json/.test(url)),
  ).toBe(false)
  await page.setViewportSize({ width: isMobile ? 375 : 1440, height: 900 })
  await page.screenshot({
    path: `test-results/editorial-home-${isMobile ? 'mobile' : 'desktop'}.png`,
  })
  await page.locator('#projekt').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: `test-results/editorial-projects-${isMobile ? 'mobile' : 'desktop'}.png`,
  })
})

test('published real analysis reconciles with its evaluated run and renders', async ({
  page,
  isMobile,
}) => {
  const response = await page.request.get('/data/jobs/cluster-summary.json')
  expect(response.ok()).toBe(true)
  const published = await response.json()
  const records: typeof points = []
  for (const shard of published.shards) {
    const part = await (await page.request.get(`/data/${shard}`)).json()
    expect(part.run_id).toBe(published.run_id)
    records.push(...part.points)
  }
  expect(records.length).toBe(published.diagnostics.dataset_size)
  expect(new Set(records.map((p) => p.id)).size).toBe(records.length)
  expect(
    records.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  ).toBe(true)
  expect(records.some((p) => 'description' in p || 'embedding' in p)).toBe(
    false,
  )
  expect(
    published.clusters.filter(
      (c: { cluster_id: number }) => c.cluster_id !== -1,
    ).length,
  ).toBe(published.diagnostics.cluster_count)
  expect(
    published.clusters.reduce(
      (n: number, c: { job_count: number }) => n + c.job_count,
      0,
    ),
  ).toBe(records.length)
  if (published.config.assignment_method === 'seed-consensus')
    expect(
      records.every((p) =>
        [0, 2 / 3, 1].some((v) => Math.abs(v - p.probability) < 1e-3),
      ),
    ).toBe(true)
  await page.goto('/#jobb-kluster')
  const explorer = page.locator('.cluster-explorer')
  await expect(explorer.locator('canvas')).toBeVisible()
  await expect(explorer.locator('.cluster-finding')).toContainText(
    records.length.toLocaleString('en-GB'),
  )
  const largest = published.clusters
    .filter((c: { cluster_id: number }) => c.cluster_id !== -1)
    .sort(
      (a: { job_count: number }, b: { job_count: number }) =>
        b.job_count - a.job_count,
    )[0]
  await expect(explorer.locator('.cluster-profile h2')).toContainText(
    largest.cluster_label,
  )
  await explorer.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: `test-results/editorial-clusters-${isMobile ? 'mobile' : 'desktop'}.png`,
  })
})
