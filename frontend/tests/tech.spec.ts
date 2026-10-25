import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

// The run history comes from the status/github.json snapshot; the test answers for it.
const run = (id: number, conclusion: string) => ({
  id,
  status: 'completed',
  conclusion,
  event: 'schedule',
  run_started_at: '2026-10-13T04:37:00Z',
  updated_at: '2026-10-13T04:55:00Z',
  html_url: `https://github.com/korv9/anton-portfolio/actions/runs/${id}`,
  head_sha: 'abcdef1234567',
})

test('the projects page explains the pipeline, lists the projects and shows the runs, the ER diagrams, every table and the maps', async ({
  page,
}) => {
  await page.route('**/status/github.json', (route) =>
    route.fulfill({
      json: {
        generated_at: '2026-10-13T05:23:00+00:00',
        workflows: [
          {
            id: 1,
            name: 'Refresh public data',
            path: '.github/workflows/refresh-welfare.yml',
            runs: [run(3, 'failure'), run(2, 'success')],
          },
        ],
        scheduled_runs: {
          since: '2026-09-13',
          total_count: 0,
          workflow_runs: [],
        },
        failure_issues: [],
        incidents: [],
        fabric_demo: '',
      },
    }),
  )
  // The page never asks GitHub itself.
  await page.route('https://api.github.com/**', () => {
    throw new Error('the page called the GitHub API')
  })
  // The ingestion status lives in object storage, outside the repository.
  await page.route('**/status/ingestion.json', (route) =>
    route.fulfill({
      json: {
        subjects: {
          news: {
            recorded_at: '2026-10-13T05:20:00+00:00',
            outcome: 'failure',
            error: 'exit 1: python platform/ingest/news/news_ingest.py',
            github_run: null,
            sources: [
              {
                source_key: 'news',
                fetched_at: '2026-10-13T05:18:00+00:00',
                content_changed_at: null,
                files: 6,
                bytes: 120000,
                fetched: 6,
                changed: 0,
                errors: 2,
              },
            ],
          },
        },
      },
    }),
  )
  // The table list shows only when it is from the same export as the model count.
  await page.route('**/schema/summary.json', (route) =>
    route.fulfill({
      json: {
        models: 1,
        tests: 2,
        sources: 0,
        rows: 9,
        generated_at: '2026-10-13T05:00:00Z',
      },
    }),
  )
  await page.route('**/schema/models.json', (route) =>
    route.fulfill({
      json: {
        dbt_version: '1.12.4',
        layers: { gold: 1 },
        tests: 2,
        nodes: [
          {
            id: 'model.portfolio.fct_indicator',
            name: 'fct_indicator',
            kind: 'model',
            layer: 'gold',
            subject: 'welfare',
            materialized: 'table',
            description: '',
            path: 'models/gold/welfare/fct_indicator.sql',
            reads: [],
            read_by: [],
            tests: [],
            columns: [
              { name: 'indicator_key', type: 'VARCHAR', tests: ['not_null'] },
            ],
            rows: 9,
          },
        ],
      },
    }),
  )
  // The old address leads here.
  await page.goto('/#tech')
  await expect(page).toHaveURL(/#projects$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects')
  // The walkthrough: seven stops, the first chosen; a stop explains itself and lists what it holds.
  const rail = page.locator('.tour-rail button')
  await expect(rail).toHaveCount(7)
  await expect(rail.first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.tour-items li').first()).toBeVisible()
  await rail.nth(3).click()
  await expect(page.locator('#tour-step-title')).toHaveText('04 Build and test')
  await expect(page.locator('.tour-layers dt')).toHaveText([
    'bronze',
    'silver',
    'gold',
  ])
  await page.getByRole('button', { name: /Next step/ }).click()
  await expect(page.locator('#tour-step-title')).toHaveText(
    '05 Machine learning',
  )
  // The projects, one per row: no run or status lines under them.
  await expect(page.locator('.hub-item[href="#symbolic-atlas"]')).toBeVisible()
  await expect(page.locator('.hub-item-runs, .hub-item-status')).toHaveCount(0)
  const fetched = page.locator('.fetches tbody tr')
  await expect(fetched).toHaveAttribute('data-state', 'failure')
  await expect(fetched).toContainText('6, 0, 2')
  // Ingestion: the latest run decides the state, and every run is a link to its log.
  const workflow = page.locator('.runs > li')
  await expect(workflow).toHaveCount(1)
  await expect(workflow).toHaveAttribute('data-state', 'failure')
  await expect(workflow.locator('.runs-strip a')).toHaveCount(2)
  await expect(page.locator('#tech-ingestion')).toContainText(
    'platform/ingest/riksdagen',
  )
  await expect(page.locator('#tech-ingestion')).toContainText('tests:')
  // Pipeline: what each subject holds per stage.
  await expect(page.locator('.stages tbody tr').first()).toBeVisible()
  // ER: a diagram per subject, drawn from the export; a table opens with all its columns.
  const er = page.locator('#tech-er')
  await er.getByRole('button', { name: /Welfare/ }).click()
  await expect(er.locator('.er-box').first()).toBeVisible()
  await expect(er.locator('.er-lines path').first()).toBeAttached()
  await er.locator('.er-box').first().click()
  await expect(er.locator('.er-card .tech-table').first()).toBeVisible()
  // A quality check that does not apply to a product is not counted against it.
  await expect(page.locator('#tech-quality')).toContainText('9 / 9')
  // Every table, searchable by table or column.
  const tables = page.locator('#tech-tables')
  await tables.getByRole('searchbox').fill('fct_indicator')
  await expect(tables.locator('.tables > li')).toHaveCount(1)
  await tables.locator('summary').click()
  await expect(tables.locator('.tech-table tbody tr').first()).toBeVisible()
  // Cluster maps: small pictures that open full size.
  const maps = page.locator('#tech-maps')
  await maps.scrollIntoViewIfNeeded()
  const card = maps.locator('.umap-card:not(:disabled)').first()
  await expect(card).toBeVisible({ timeout: 30000 })
  await card.click()
  const dialog = page.locator('.umap-dialog')
  await expect(dialog.locator('canvas')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).not.toBeVisible()
  const scan = await new AxeBuilder({ page }).include('#projects').analyze()
  expect(scan.violations).toEqual([])
})

test(
  'the projects page fits a phone and points to GitHub when the snapshot is missing',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.route('**/status/github.json', (route) =>
      route.fulfill({ status: 404, json: {} }),
    )
    await page.goto('/#projects')
    await expect(page.locator('.tour-rail button')).toHaveCount(7)
    await expect(page.locator('#tech-ingestion')).toContainText(
      'The run history is on GitHub Actions',
    )
    await expect(page.locator('#projects')).not.toContainText(
      'could not be read',
    )
    await expect(page.locator('.stages tbody tr').first()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  },
)
