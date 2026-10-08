/**
 * The quality views: cells take the weakest measured status, never invent a pass, keep
 * not_measured and not_applicable apart, and the published files keep every registered check,
 * failures included, without a single score.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  cellOf,
  cellText,
  nodeStatuses,
  nodesOfCheck,
  validityOf,
} from '../../src/quality/logic.ts'
import type { Analysis, QualityCheck } from '../../src/quality/types.ts'

const read = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../public/data/quality/${name}`, import.meta.url),
      'utf8',
    ),
  )
const en = (a: string) => a
const check = (
  status: QualityCheck['status'],
  extra: Partial<QualityCheck> = {},
) =>
  ({
    status,
    product_id: 'p',
    dataset_id: 'gold.t',
    dimension: 'accuracy',
    ...extra,
  }) as QualityCheck

test('a cell shows its weakest measured result', () => {
  assert.equal(cellOf([check('pass'), check('warning')])!.status, 'warning')
  assert.equal(
    cellOf([check('pass'), check('fail'), check('warning')])!.status,
    'fail',
  )
  assert.equal(cellOf([check('pass'), check('not_measured')])!.status, 'pass')
  assert.equal(cellOf([]), null)
})

test('not measured and not applicable are never shown as passes', () => {
  assert.equal(cellOf([check('not_measured')])!.status, 'not_measured')
  assert.equal(cellOf([check('not_applicable')])!.status, 'not_applicable')
  assert.equal(
    cellOf([check('not_applicable'), check('not_measured')])!.status,
    'not_measured',
  )
  assert.equal(cellText(cellOf([check('not_measured')]), en), 'not measured')
  assert.equal(
    cellText(cellOf([check('pass'), check('not_measured')]), en),
    '1 measured, 1 pass, 1 not measured',
  )
})

test('checks map to their product and models in the constellation', () => {
  const c = check('fail', {
    product_id: 'politics',
    dataset_id: 'gold.fct_roll_call, models/*/parliament',
  })
  assert.deepEqual(nodesOfCheck(c), ['app:politics', 'dbt:fct_roll_call'])
  const marks = nodeStatuses([
    c,
    check('pass', { product_id: 'politics', dataset_id: 'warehouse/raw/x' }),
  ])
  assert.equal(marks.get('app:politics'), 'fail')
})

test('a product takes its weakest analysis status', () => {
  const a = (s: Analysis['analysis_status']) =>
    ({ product_id: 'p', analysis_status: s }) as Analysis
  assert.equal(validityOf([a('supported'), a('warning')], 'p'), 'warning')
  assert.equal(validityOf([a('supported')], 'q'), null)
})

test('the published quality data keeps failures and has no score', () => {
  const summary = read('summary.json')
  const checks = read('checks.json') as QualityCheck[]
  const validity = read('validity.json') as Analysis[]
  assert.ok(checks.length >= 30)
  assert.ok(!JSON.stringify(summary).includes('score'))
  for (const c of checks) {
    assert.ok(summary.statuses.includes(c.status))
    if (c.status === 'not_measured' || c.status === 'not_applicable')
      assert.equal(c.value, null)
    else assert.notEqual(c.value, null)
  }
  assert.match(summary.standards.claim, /not a certification/)
  const symbolic = validity.find(
    (a) => a.analysis_id === 'symbolic_atlas_clustering',
  )!
  const base = symbolic.diagnostics.find(
    (d) => d.diagnostic_id === 'baseline_largest_book_share',
  )!
  const centred = symbolic.diagnostics.find(
    (d) => d.diagnostic_id === 'book_centered_largest_book_share',
  )!
  assert.equal(base.experiment, 'baseline')
  assert.equal(centred.experiment, 'book_centered')
  assert.ok(base.result! > centred.result!)
})
