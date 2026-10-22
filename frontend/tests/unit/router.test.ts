/** The withdrawn observatories' addresses, old and current, lead to the meaning feed. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MEANING, parseHash } from '../../src/router.ts'

test('observatory addresses land on the meaning feed', () => {
  for (const hash of [
    '#politik',
    '#politik-budget?partier=S',
    '#jobb-lan',
    '#job-market-regions',
    '#jobb-it',
    '#compliance-rankings',
    '#wellbeing-health',
    '#sweden-work',
    '#ai-act-roles',
    '#lagboken-tid',
    '#now-seats',
    '#politics',
    '#debates',
  ]) {
    const route = parseHash(hash)
    assert.equal(route.path, MEANING, hash)
    assert.equal(route.page, 'meaning', hash)
  }
})

test('kept pages keep their addresses', () => {
  assert.equal(parseHash('#sweden').page, 'sweden')
  assert.equal(parseHash('#fraga-lagen').page, 'lawqa')
  assert.equal(parseHash('#symbolic-findings').page, 'symbolic')
})
