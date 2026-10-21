/**
 * B — The Ideal Human: changes run between complete years, and a reading's verdict needs
 * every baseline year to agree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agreed,
  baselines,
  lastComplete,
} from '../../src/sweden/languageChange.ts'

test('a year counted only from quarterly archives is not an endpoint', () => {
  assert.equal(lastComplete([2024, 2025, 2026], ['2026']), 2025)
  assert.equal(lastComplete([2024, 2025], []), 2025)
})

test('baselines are the first standardised year and two and four years later', () => {
  const years = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2025]
  assert.deepEqual(baselines(years, 2008, 2025), [2008, 2010, 2012])
  assert.deepEqual(baselines([2008, 2009, 2010], 2008, 2010), [2008])
})

test('a verdict that one baseline contradicts is undetermined', () => {
  assert.equal(agreed(['supports', 'supports']), 'supports')
  assert.equal(agreed(['supports', 'undetermined']), 'undetermined')
  assert.equal(agreed([]), 'undetermined')
})
