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
  // The projects page and the platform page are the Overview; the old addresses lead into it.
  assert.equal(parseHash('#projekt').path, '#projects')
  assert.equal(parseHash('#projects').page, 'projects')
  assert.equal(parseHash('#platform').path, '#projects')
  assert.equal(parseHash('#platform').page, 'projects')
  assert.equal(parseHash('#projects-platform').path, '#projects')
  assert.equal(parseHash('#ask-platform').path, '#projects')
  assert.equal(parseHash('#diva-lakehouse').path, '#projects')
  assert.equal(parseHash('#tech-er').page, 'projects')
  assert.equal(parseHash('#symbolic-findings').page, 'symbolic')
})

test('statute book and AI Act addresses land on Allegora', () => {
  for (const hash of ['#ai-act-roles', '#lagboken-tid']) {
    const route = parseHash(hash)
    assert.equal(route.path, '#fraga-lagen', hash)
  }
  assert.equal(parseHash('#ai-act-clock').path, '#lag-ankomst')
})
