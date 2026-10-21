/**
 * The project registry: menu groups without the withdrawn observatories, unique ids and
 * addresses, previous / next without wrapping, and every site page that belongs to a project found from its route.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROJECT_GROUPS,
  PROJECTS,
  neighbours,
  projectForRoute,
} from '../../src/projects/projectRegistry.ts'

test('each retained project belongs to one menu group', () => {
  const grouped = PROJECT_GROUPS.flatMap((group) => group.ids)
  assert.equal(new Set(grouped).size, grouped.length)
  assert.deepEqual(new Set(grouped), new Set(PROJECTS.map((p) => p.id)))
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
    ['Labs', 'Engineering'],
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

test('previous and next follow the project groups without wrapping', () => {
  assert.equal(neighbours('symbolic-atlas').previous, undefined)
  assert.equal(neighbours('symbolic-atlas').next?.id, 'philosophy-atlas')
  assert.equal(neighbours('drugcomb').next?.id, 'thesis')
  assert.equal(neighbours('diva-lakehouse').next, undefined)
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
