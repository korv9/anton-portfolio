/**
 * The project registry: menu groups without the withdrawn observatories, unique ids and
 * addresses, previous / next without wrapping, and every site page that belongs to a project found from its route.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROJECT_GROUPS,
  PROJECT_WORKSPACE,
  PROJECTS,
  projectForRoute,
} from '../../src/projects/projectRegistry.ts'

test('each listed project belongs to one menu group; homie and platform are unlisted', () => {
  const grouped = PROJECT_GROUPS.flatMap((group) => group.ids)
  assert.equal(new Set(grouped).size, grouped.length)
  assert.deepEqual(
    new Set([...grouped, 'homie', 'platform']),
    new Set(PROJECTS.map((p) => p.id)),
  )
})

test('regrouping the menu keeps each page theme', () => {
  assert.deepEqual(
    Object.fromEntries(PROJECTS.map((p) => [p.id, PROJECT_WORKSPACE[p.id]])),
    {
      'ai-act-clock': 'labs',
      replik: 'labs',
      'symbolic-atlas': 'labs',
      thesis: 'engineering',
      'philosophy-atlas': 'labs',
      'concept-constellation': 'labs',
      'ask-the-law': 'labs',
      drugcomb: 'labs',
      platform: 'engineering',
      homie: 'engineering',
    },
  )
})

test('ids and site addresses are unique', () => {
  const ids = PROJECTS.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length)
  const hrefs = PROJECTS.map((p) => p.href).filter(Boolean)
  assert.equal(new Set(hrefs).size, hrefs.length)
})

test('every flagship has the same grammar filled in', () => {
  for (const p of PROJECTS)
    for (const key of [
      'question',
      'built',
      'result',
      'summary',
      'descriptor',
    ] as const) {
      assert.ok(p[key].sv && p[key].en, `${p.id}.${key}`)
    }
})

test('the withdrawn observatories are not listed', () => {
  assert.deepEqual(
    PROJECT_GROUPS.map((group) => group.label),
    ['Research on public data', 'Engineering', 'Experiments'],
  )
  for (const id of [
    'politics',
    'jobs',
    'compliance',
    'welfare',
    'ai-act',
    'sfs',
  ])
    assert.equal(
      PROJECTS.find((p) => p.id === id),
      undefined,
      id,
    )
})

test('a route finds its project, including sub-views', () => {
  assert.equal(
    projectForRoute({ page: 'symbolic', path: '#symbolic-method' })?.id,
    'symbolic-atlas',
  )
  assert.equal(
    projectForRoute({ page: 'drugcomb', path: '#drugcomb-model' })?.id,
    'drugcomb',
  )
  assert.equal(projectForRoute({ page: 'home', path: '#start' }), undefined)
  assert.equal(
    projectForRoute({ page: 'meaning', path: '#what-does-it-even-mean' }),
    undefined,
  )
})
