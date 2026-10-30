/**
 * Clustering experiments on Cluster Visuals: the champion by default, candidates and rejected
 * runs in their own view, deep links to a run and a group, and the empty and error states. The
 * data is a synthetic fixture served by route mocks only; nothing here is published.
 */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { test, expect } from './test'

const CHAMPION = 'aaaaaaaaaaaaaaaa'
const CANDIDATE = 'bbbbbbbbbbbbbbbb'
const REJECTED = 'cccccccccccccccc'
const LONE = 'dddddddddddddddd'

const summary = (run_id: string, status: string, label: string) => ({
  run_id,
  status,
  label,
  role: 'evaluation',
  created_at: '2026-10-20T10:00:00Z',
  dataset_version: 'fixture-v1',
  embedding: { model: 'fixture/model', revision: 'abc123' },
  clustering: { method: 'hdbscan', min_cluster_size: 10 },
  cluster_count: 2,
  noise_share: 0.2,
  seed_ari: 0.71,
  accepted: status === 'champion' ? null : status === 'candidate',
})

const INDEX = {
  schema_version: 1,
  generated_at: '2026-10-20T10:00:00Z',
  coordinates:
    'Coordinates come from this run’s own 2-D UMAP fit. Maps of different runs are not aligned.',
  domains: {
    jobs: {
      champion: CHAMPION,
      question: 'Which kinds of IT job ad are written alike?',
      runs: [
        summary(CHAMPION, 'champion', 'Fixture champion'),
        summary(CANDIDATE, 'candidate', 'Fixture candidate'),
        summary(REJECTED, 'rejected', 'Fixture rejected'),
      ],
    },
    philosophy: {
      champion: null,
      question: 'Which passages of philosophy share a subject?',
      runs: [summary(LONE, 'candidate', 'Fixture lone candidate')],
    },
  },
}

function runFile(run_id: string, status: string, label: string) {
  const points = Array.from({ length: 60 }, (_, i) => [
    `p${i}`,
    (i % 3) + Math.sin(i),
    Math.floor(i / 3) % 2 ? 4 + Math.cos(i) : Math.cos(i),
    i % 5 === 0 ? -1 : i % 2,
  ])
  return {
    schema_version: 1,
    run_id,
    status,
    acceptance:
      status === 'champion'
        ? null
        : {
            passed: status === 'candidate',
            failed: status === 'candidate' ? [] : ['stable'],
            criteria_sha256: 'f'.repeat(64),
            champion_run_id: CHAMPION,
            criteria: [
              {
                name: 'stable',
                metric: 'seed_stability.ari_mean',
                at_least: 0.6,
                candidate: status === 'candidate' ? 0.71 : 0.41,
                champion: 0.66,
                passed: status === 'candidate',
                note: '',
              },
              {
                name: 'gain',
                passed: true,
                any_of: [
                  {
                    metric: 'noise_share',
                    direction: 'lower',
                    better_than_champion: 0.02,
                    candidate: 0.2,
                    champion: 0.25,
                    passed: true,
                    note: '',
                  },
                ],
              },
            ],
          },
    run: {
      domain: 'jobs',
      question: 'Which kinds of IT job ad are written alike?',
      corpus: 'Fixture corpus',
      sample: { n: 60, seed: 1 },
      dataset_version: 'fixture-v1',
      pipeline: {
        text: { field: 'description' },
        embedding: { model: 'fixture/model', revision: 'abc123' },
        representation: { kind: 'raw' },
        reduction: { method: 'umap', n_components: 10 },
        clustering: { method: 'hdbscan', min_cluster_size: 10 },
      },
      seeds: [1, 2, 3],
      role: 'evaluation',
      metrics: {
        cluster_count: 2,
        noise_share: 0.2,
        seed_stability: { ari_mean: 0.71, ari_min: 0.6 },
        separation_clustered: 0.4,
        separation_representation: 0.1,
        dominance: {
          employer: {
            weighted_top_share: 0.3,
            null_top_share_p95: 0.12,
            ami: 0.05,
          },
        },
      },
      resources: { seconds: 42, peak_rss_mb: 900 },
      limitations: ['Fixture limitation: one source only.'],
      created_at: '2026-10-20T10:00:00Z',
      label,
    },
    map: {
      method: '2-D UMAP of the representation',
      note: 'Coordinates belong to this run.',
      columns: ['id', 'x', 'y', 'cluster'],
      points,
    },
    groups: [0, 1].map((cluster) => ({
      cluster,
      key: `${run_id}:${cluster}`,
      size: 24,
      name_status: cluster === 0 ? 'generated:fixture' : 'unnamed',
      name: cluster === 0 ? 'Fixture generated name' : undefined,
      terms: ['alpha', 'beta'],
      dominant: { employer: ['Fixture AB', 0.3] },
      examples: [
        {
          id: `ex-${cluster}`,
          text: `Fixture passage for group ${cluster}.`,
          source: { title: 'Fixture ad', url: 'https://example.org/ad' },
        },
      ],
    })),
  }
}

const RUNS: Record<string, [string, string]> = {
  [CHAMPION]: ['champion', 'Fixture champion'],
  [CANDIDATE]: ['candidate', 'Fixture candidate'],
  [REJECTED]: ['rejected', 'Fixture rejected'],
  [LONE]: ['candidate', 'Fixture lone candidate'],
}

async function serve(page: Page, index: unknown = INDEX, runStatus = 200) {
  await page.route('**/data/cluster-experiments/index.json', (route) =>
    typeof index === 'number'
      ? route.fulfill({ status: index, body: 'no' })
      : route.fulfill({ json: index }),
  )
  await page.route('**/data/cluster-experiments/runs/*.json', (route) => {
    const id = route.request().url().split('/').pop()!.replace('.json', '')
    if (runStatus !== 200 || !RUNS[id])
      return route.fulfill({ status: runStatus === 200 ? 404 : runStatus })
    return route.fulfill({ json: runFile(id, ...RUNS[id]) })
  })
}

test('the champion is shown by default on Cluster Visuals', async ({
  page,
}) => {
  await serve(page)
  await page.goto('/#cluster-visuals')
  const section = page.locator('#cv-experiments')
  await section.scrollIntoViewIfNeeded()
  await expect(section.getByRole('heading', { level: 3 })).toContainText(
    'Fixture champion',
  )
  await expect(section.locator('.cx-status').first()).toHaveText('Champion')
  await expect(section).toContainText('fixture/model @ abc123')
  await expect(section).toContainText('Maps of different runs are not aligned')
  await expect(section.locator('canvas')).toHaveAttribute('role', 'img')
  // The groups table is the map's text alternative; names say they were generated.
  await expect(
    section.locator('.cx-table').first().locator('tbody tr'),
  ).toHaveCount(2)
  await expect(section).toContainText('Generated, not reviewed')
  await expect(section).not.toContainText('Reviewed by a person')
  // A domain without a champion says so instead of promoting a candidate.
  await section.getByRole('link', { name: 'Philosophy' }).click()
  await expect(section).toContainText('No champion yet for this question.')
  await expect(section.locator('.cx-run')).toHaveCount(0)
})

test('the experiments view lists candidates and rejected runs with their status', async ({
  page,
}) => {
  await serve(page)
  await page.goto('/#cluster-visuals-experiments?domain=jobs')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Clustering experiments',
  )
  const runs = page.locator('.cx-table').first()
  await expect(runs.locator('tbody tr')).toHaveCount(2)
  await expect(runs).toContainText('Candidate')
  await expect(runs).toContainText('Rejected')
  await expect(runs.locator('tbody')).not.toContainText('Fixture champion')
  // The first non-champion opens, with the champion comparison as acceptance recorded it.
  await expect(page.locator('.cx-run h3')).toContainText('Fixture candidate')
  const accept = page.locator('.cx-accept')
  await expect(accept).toContainText(`Compared with ${CHAMPION}`)
  await expect(accept.locator('tbody tr').first()).toContainText('stable')
  await expect(accept.locator('tbody tr').first()).toContainText('0.71')
  await expect(accept.locator('tbody tr').first()).toContainText('0.66')
  await expect(accept.locator('tbody tr').first()).toContainText('Yes')
  await expect(accept.locator('.cx-inner')).toHaveCount(1)
})

test('a deep link opens a run and one of its groups', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/cluster-experiments/runs/')) requested.push(r.url())
  })
  await serve(page)
  await page.goto(`/#cluster-visuals-experiments?run=${REJECTED}&group=0`)
  const run = page.locator('.cx-run')
  await expect(run.locator('h3')).toContainText('Fixture rejected')
  await expect(run.locator('h3 .cx-status')).toHaveText('Rejected')
  await expect(run.locator('.cx-group h4')).toHaveText(
    'Group 0: Fixture generated name',
  )
  await expect(run.locator('.cx-passages')).toContainText(
    'Fixture passage for group 0.',
  )
  await expect(page.locator('.cx-accept caption')).toContainText(
    'Failed: stable',
  )
  // Only the opened run's file was fetched.
  expect(requested.every((u) => u.includes(REJECTED))).toBeTruthy()
  // Picking another group in the table keeps the address shareable.
  await run.locator('tbody a', { hasText: '1' }).first().click()
  await expect(page).toHaveURL(new RegExp(`run=${REJECTED}&group=1`))
  await expect(run.locator('.cx-group h4')).toContainText('Group 1')
})

test(
  'no index means no runs registered yet',
  { tag: '@mobile' },
  async ({ page }) => {
    await serve(page, 404)
    await page.goto('/#cluster-visuals-experiments')
    await expect(page.locator('.cx-state')).toHaveText(
      'No runs registered yet.',
    )
    await serve(page, { ...INDEX, domains: {} })
    await page.reload()
    await expect(page.locator('.cx-state')).toHaveText(
      'No runs registered yet.',
    )
  },
)

test('a broken index or run file is an error, not an empty page', async ({
  page,
}) => {
  await serve(page, 500)
  await page.goto('/#cluster-visuals-experiments')
  await expect(page.getByRole('alert')).toHaveText(
    'The experiment index did not load.',
  )
  // Later routes win over earlier ones.
  await serve(page, INDEX, 500)
  await page.reload()
  await expect(page.getByRole('alert')).toHaveText(
    `The file for run ${CANDIDATE} did not load.`,
  )
})

test(
  'the experiments view fits a phone and has no axe violations',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await serve(page)
    await page.goto(`/#cluster-visuals-experiments?run=${CANDIDATE}&group=0`)
    await expect(page.locator('.cx-passages')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width)
    if (process.env.CX_SCREENS)
      await page.screenshot({
        path: fileURLToPath(
          new URL(
            `../../tmp/screens-experiments/${isMobile ? 'mobile' : 'desktop'}-run.png`,
            import.meta.url,
          ),
        ),
        fullPage: true,
      })
    if (isMobile) return
    const result = await new AxeBuilder({ page })
      .include('main')
      .exclude('canvas')
      .analyze()
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`),
    ).toEqual([])
  },
)
