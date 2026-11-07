import assert from 'node:assert/strict'
import test from 'node:test'
import { skillGaps } from '../../src/job-assistant/gaps.ts'
import type { Match } from '../../src/job-assistant/model.ts'

const m = (id: string, cls: Match['class'], gaps?: string[]) =>
  ({ id, class: cls, gaps }) as Match

test('gaps count the good, possible and stretch matches, the single gaps first', () => {
  const gaps = skillGaps([
    m('1', 'strong', ['Kubernetes']),
    m('2', 'possible', ['Kubernetes', 'Go']),
    m('3', 'stretch', ['Go']),
    m('4', 'stretch', ['Go', 'Go', 'Rust']),
    m('5', 'outside', ['Rust', 'Rust']),
    m('6', 'strong'),
  ])
  assert.deepEqual(gaps, [
    { skill: 'Go', ads: 3, only: 1, listed: 1 },
    { skill: 'Kubernetes', ads: 2, only: 1, listed: 2 },
    { skill: 'Rust', ads: 1, only: 0, listed: 0 },
  ])
})

test('no matches or no gaps: nothing to show', () => {
  assert.deepEqual(skillGaps([]), [])
  assert.deepEqual(skillGaps([m('1', 'strong', [])]), [])
})
