/**
 * The project registry: five numbered flagships in order, unique ids and addresses, previous /
 * next without wrapping, and every site page that belongs to a project found from its route.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FLAGSHIPS,
  PROJECTS,
  neighbours,
  projectForRoute,
} from '../../src/projects/projectRegistry.ts'

test('six flagships, numbered 01–06 in order', () => {
  assert.deepEqual(
    FLAGSHIPS.map((p) => [p.number, p.id]),
    [
      ['01', 'politics'],
      ['02', 'ai-act'],
      ['03', 'jobs'],
      ['04', 'symbolic-atlas'],
      ['05', 'welfare'],
      ['06', 'thesis'],
    ],
  )
  assert.ok(
    PROJECTS.filter((p) => !FLAGSHIPS.includes(p)).every(
      (p) => !p.number && !p.featured,
    ),
  )
})

test('ids and site addresses are unique', () => {
  const ids = PROJECTS.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length)
  const hrefs = PROJECTS.map((p) => p.href).filter(Boolean)
  assert.equal(new Set(hrefs).size, hrefs.length)
})

test('every flagship has the same grammar filled in', () => {
  for (const p of FLAGSHIPS)
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

test('previous and next follow the flagship order without wrapping', () => {
  assert.deepEqual(neighbours('politics').previous, undefined)
  assert.equal(neighbours('politics').next?.id, 'ai-act')
  assert.equal(neighbours('jobs').previous?.id, 'ai-act')
  assert.equal(neighbours('symbolic-atlas').previous?.id, 'jobs')
  assert.equal(neighbours('symbolic-atlas').next?.id, 'welfare')
  assert.equal(neighbours('thesis').next, undefined)
  assert.deepEqual(neighbours('drugcomb'), {})
})

test('a route finds its project, including sub-views', () => {
  assert.equal(
    projectForRoute({ page: 'politik', path: '#politik-budget' })?.id,
    'politics',
  )
  assert.equal(
    projectForRoute({ page: 'symbolic', path: '#symbolic-method' })?.id,
    'symbolic-atlas',
  )
  assert.equal(
    projectForRoute({ page: 'aiact', path: '#ai-act-obligations' })?.id,
    'ai-act',
  )
  assert.equal(
    projectForRoute({ page: 'welfare', path: '#sweden-counties' })?.id,
    'welfare',
  )
  assert.equal(projectForRoute({ page: 'home', path: '#start' }), undefined)
  assert.equal(
    projectForRoute({ page: 'technical', path: '#technical' }),
    undefined,
  )
})
