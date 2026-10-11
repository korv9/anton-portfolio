import { test, expect } from './test'

test('local lab reopens real saved runs, switches layouts and keeps assignments', async ({
  page,
}) => {
  const response = await page.request.get('/__cluster_lab/index.json')
  expect(response.ok()).toBeTruthy()
  const index = await response.json()
  expect(index.runs.length).toBeGreaterThanOrEqual(2)
  const run = index.runs.find(
    (entry: { layouts: unknown[] }) => entry.layouts.length >= 2,
  )
  expect(run).toBeTruthy()
  const first = await (
    await page.request.get(`/__cluster_lab/${run.layouts[0].view}`)
  ).json()
  const second = await (
    await page.request.get(`/__cluster_lab/${run.layouts[1].view}`)
  ).json()
  const labels = (view: {
    points: { observation_id: string; cluster: number }[]
  }) =>
    view.points
      .map((p) => [p.observation_id, p.cluster])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  expect(labels(first)).toEqual(labels(second))
  await page.goto(`/#cluster-visuals?lab_runs=${run.run_id}`)
  const lab = page.locator('.clab')
  await expect(
    lab.getByRole('heading', { name: 'Cluster Lab', exact: true }),
  ).toBeVisible()
  await expect(lab.locator('canvas')).toHaveCount(1)
  await expect(lab.locator('canvas')).toHaveAttribute(
    'aria-label',
    new RegExp(`${run.layouts[0].drawn.toLocaleString('en-GB')} drawn points`),
  )
  const layout = lab.getByRole('combobox', { name: 'Layout', exact: true })
  await layout.selectOption(run.layouts[1].layout_id)
  await expect(lab.locator('canvas')).toBeVisible()
  await expect(layout).toHaveValue(run.layouts[1].layout_id)
  await lab.getByText('Exact resolved configuration', { exact: true }).click()
  await expect(lab.locator('pre').first()).toContainText('min_cluster_size')
  await lab.getByText('Profiles and examples', { exact: true }).click()
  await expect(
    lab.getByText(
      'Automatic terms are preliminary. Examples retain their observation IDs.',
    ),
  ).toBeVisible()
  const other = index.runs.find(
    (entry: { run_id: string }) => entry.run_id !== run.run_id,
  )
  await page.goto(`/#cluster-visuals?lab_runs=${run.run_id},${other.run_id}`)
  await expect(lab.locator('.clab-open')).toHaveCount(2)
  await expect(lab.locator('canvas')).toHaveCount(2)
  await lab.screenshot({
    path: `warehouse/cluster_lab/logs/gallery-${test.info().project.name}.png`,
  })
})

test('local artifact route blocks traversal and POST mutations', async ({
  request,
}) => {
  const invalid = await request.get(
    '/__cluster_lab/%2e%2e%2fruns%2fsecret.json',
  )
  expect(invalid.status()).toBe(403)
  const mutation = await request.post('/__cluster_lab/index.json')
  expect(mutation.status()).toBe(405)
})
