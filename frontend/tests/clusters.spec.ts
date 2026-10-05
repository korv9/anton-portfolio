import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

// Deliberate browser fixtures; no test dataset is written into public delivery.
const roles = ['Data Engineer', 'Software Developer']
const points = roles.map((role, index) => ({
  id: `test-${index}`,
  x: index,
  y: index,
  cluster: index,
  cluster_label: `Test skill ${index}`,
  probability: 0.8,
  role,
  seniority: index ? 'senior' : 'junior',
  year: 2024 + index,
  title: `Test advertisement ${index}`,
  region: 'Stockholm',
  skills: ['Python'],
}))
const clusters = points.map((p) => ({
  cluster_id: p.cluster,
  cluster_label: p.cluster_label,
  job_count: 1,
  dataset_share: 0.5,
  junior_share: 0.5,
  senior_share: 0.5,
  unspecified_share: 0,
  mean_probability: 0.8,
  top_skills: [{ skill: 'Python', count: 1, lift: 1 }],
  top_titles: [{ label: p.title, count: 1, share: 1 }],
  role_distribution: [{ label: p.role, count: 1, share: 1 }],
  representative_ads: [{ id: p.id, title: p.title }],
  label_uncertainty: 'Test fixture',
}))
const summary = {
  schema_version: 1,
  run_id: 'test',
  generated_at: '2026-10-04',
  source_size: 2,
  sampled: false,
  source_kinds: ['historical'],
  config: { model: 'Test model' },
  shards: ['jobs/clusters/test/points-0.json'],
  clusters,
  diagnostics: {
    dataset_size: 2,
    cluster_count: 2,
    noise_share: 0,
    trustworthiness: 0.9,
    trustworthiness_sample_size: 2,
    silhouette: null,
    mean_cluster_probability: 0.8,
    limitations: 'Test fixture',
  },
}

test('cluster explorer colour, year, keyboard and accessible cluster selection', async ({
  page,
}) => {
  await page.route('**/jobs/cluster-summary.json', (r) =>
    r.fulfill({ json: summary }),
  )
  await page.route('**/jobs/clusters/test/points-0.json', (r) =>
    r.fulfill({ json: { run_id: 'test', points } }),
  )
  await page.goto('/#job-market-clusters')
  const explorer = page.locator('.cluster-explorer')
  await expect(explorer.locator('canvas')).toBeVisible()
  for (const name of [
    'Existing role',
    'Seniority',
    'Year',
    'Discovered clusters',
  ]) {
    await explorer.getByRole('button', { name, exact: true }).click()
    await expect(
      explorer.getByRole('button', { name, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
  }
  await explorer.getByLabel('Publication year').selectOption('2025')
  await expect(explorer.locator('#cluster-visible')).toContainText(
    '1 advertisements in selection',
  )
  await explorer.locator('canvas').focus()
  await expect(explorer.locator('#cluster-point')).toContainText(
    'Test advertisement 1',
  )
  await page.keyboard.press('Enter')
  await expect(explorer.getByLabel('Inspect a cluster')).toHaveValue('1')
  await page.keyboard.press('Escape')
  await expect(explorer.getByLabel('Inspect a cluster')).toHaveValue('')
  await explorer.getByLabel('Publication year').selectOption('all')
  await expect(explorer.locator('#cluster-visible')).toContainText(
    '2 advertisements in selection',
  )
  await explorer.getByLabel('Inspect a cluster').selectOption('0')
  await expect(explorer.locator('.cluster-detail')).toContainText(
    'Test skill 0',
  )
  const legend = explorer.getByRole('list', { name: 'Colour legend' })
  await legend.getByRole('button', { name: '01 · Test skill 1' }).click()
  await expect(explorer.getByLabel('Inspect a cluster')).toHaveValue('1')
  await legend.getByRole('button', { name: '01 · Test skill 1' }).click()
  await expect(explorer.getByLabel('Inspect a cluster')).toHaveValue('')
  await explorer.locator('.cluster-size-bars button').first().click()
  await expect(explorer.getByLabel('Inspect a cluster')).toHaveValue('0')
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
  await page.goto('/#job-market-clusters')
  await expect(page.getByText('Loading the semantic map…')).toBeVisible()
  await expect(
    page.getByText(/The clustering analysis is currently unavailable/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.cluster-explorer canvas')).toBeVisible()
})

test('consensus support is distinguished from membership probability', async ({
  page,
}) => {
  await page.route('**/jobs/cluster-summary.json', (r) =>
    r.fulfill({
      json: {
        ...summary,
        config: { ...summary.config, assignment_method: 'seed-consensus' },
        feature_ensemble: {
          recipe: 'balanced',
          weights: { clean: 0.65, title: 0.15, skills: 0.2 },
          assignment_method: 'seed-consensus',
          candidate_count: 192,
        },
      },
    }),
  )
  await page.route('**/jobs/clusters/test/points-0.json', (r) =>
    r.fulfill({
      json: {
        run_id: 'test',
        points: points.map((p) => ({ ...p, probability: 2 / 3 })),
      },
    }),
  )
  await page.goto('/#job-market-clusters')
  const explorer = page.locator('.cluster-explorer')
  await expect(explorer.locator('canvas')).toBeVisible()
  await explorer.locator('canvas').focus()
  await expect(explorer.locator('#cluster-point')).toContainText(
    'Cluster assignment support: 66.7%',
  )
  await explorer
    .getByText('Method, diagnostics & limitations', { exact: true })
    .click()
  await expect(explorer).toContainText('at least two of three runs')
  await expect(explorer).toContainText('not a calibrated probability')
})

test('cluster frame enlarges groups while retaining distant noise in the full map', async ({
  page,
}) => {
  const noise = {
    ...points[0],
    id: 'noise',
    cluster: -1,
    x: 1000,
    y: 1000,
    probability: 0,
  }
  await page.route('**/jobs/cluster-summary.json', (r) =>
    r.fulfill({
      json: {
        ...summary,
        diagnostics: {
          ...summary.diagnostics,
          dataset_size: 3,
          noise_share: 1 / 3,
        },
        clusters: [
          ...clusters,
          { ...clusters[0], cluster_id: -1, cluster_label: 'Noise' },
        ],
      },
    }),
  )
  await page.route('**/jobs/clusters/test/points-0.json', (r) =>
    r.fulfill({ json: { run_id: 'test', points: [...points, noise] } }),
  )
  await page.goto('/#job-market-clusters')
  const explorer = page.locator('.cluster-explorer')
  await expect(explorer.locator('canvas')).toBeVisible()
  await expect(explorer.locator('#cluster-frame')).toContainText(
    '1 ads lie outside',
  )
  await expect(explorer.locator('#cluster-visible')).toContainText(
    '3 advertisements in selection · 2 within frame',
  )
  await explorer
    .getByRole('button', { name: 'Show all points', exact: true })
    .click()
  await expect(explorer.locator('#cluster-frame')).toContainText(
    'entire fitted map',
  )
  await expect(explorer.locator('#cluster-visible')).toContainText(
    '3 advertisements in selection · 3 within frame',
  )
  await explorer
    .getByRole('button', { name: 'Fit clusters', exact: true })
    .click()
  await expect(explorer.locator('#cluster-frame')).toContainText(
    '1 ads lie outside',
  )
})

test('home loads only preview and stays within mobile width', async ({
  page,
  isMobile,
}) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ANTON')
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
  if (published.config.assignment_method === 'seed-consensus') {
    expect(published.feature_ensemble.candidate_count).toBeGreaterThan(0)
    expect(
      published.feature_ensemble.consensus_window_stability.length,
    ).toBeGreaterThan(0)
    expect(
      records.every((p) =>
        [0, 2 / 3, 1].some((v) => Math.abs(v - p.probability) < 1e-8),
      ),
    ).toBe(true)
  }
  await page.goto('/#job-market-clusters')
  const explorer = page.locator('.cluster-explorer')
  await expect(explorer.locator('canvas')).toBeVisible()
  await expect(explorer.locator('#cluster-visible')).toContainText(
    records.length.toLocaleString('en-GB'),
  )
  await explorer
    .getByLabel('Inspect a cluster')
    .selectOption(
      String(
        published.clusters.find(
          (c: { cluster_id: number }) => c.cluster_id !== -1,
        ).cluster_id,
      ),
    )
  await expect(explorer.locator('.cluster-detail h3')).toBeVisible()
  const chosen = published.clusters.find(
    (c: { cluster_id: number }) => c.cluster_id !== -1,
  )
  await expect(explorer.locator('.cluster-detail')).toContainText(
    chosen.top_employers[0].label,
  )
  await expect(explorer.locator('.cluster-detail')).toContainText(
    'Employer concentration',
  )
  const year = String(Math.max(...records.map((p) => p.year)))
  await explorer.getByLabel('Publication year').selectOption(year)
  await expect(explorer.locator('#cluster-visible')).toContainText(
    records
      .filter((p) => String(p.year) === year)
      .length.toLocaleString('en-GB'),
  )
  await explorer.locator('canvas').focus()
  await page.keyboard.press('Home')
  await expect(explorer.locator('#cluster-point')).toContainText(
    records.filter((p) => String(p.year) === year)[0].title,
  )
  await explorer.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: `test-results/editorial-clusters-${isMobile ? 'mobile' : 'desktop'}.png`,
  })
  await page.goto('/#job-market-tech')
  await page
    .getByRole('link', { name: 'Semantic clusters', exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: 'Semantic clusters', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.cluster-explorer canvas')).toBeVisible()
})
