/** Idea Lineage on the page: derived status, the "why" trace and the published file. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ancestors,
  effective,
  projectState,
  setAside,
  type LineageEvent,
} from '../../src/lineage/logic.ts'

const ev = (id: string, rest: Partial<LineageEvent> = {}): LineageEvent => ({
  id,
  created_at: '2026-10-07T10:00:00+00:00',
  type: id.split('-')[0] as LineageEvent['type'],
  title: id,
  projects: ['symbolic-atlas'],
  ...rest,
})

const events = [
  ev('idea-2026-10-07-001'),
  ev('finding-2026-10-07-001', {
    relations: { results_from: ['idea-2026-10-07-001'] },
  }),
  ev('decision-2026-10-07-001', {
    importance: 'major',
    relations: {
      inspired_by: ['finding-2026-10-07-001'],
      supersedes: ['idea-2026-10-07-002'],
    },
  }),
  ev('idea-2026-10-07-002'),
  ev('question-2026-10-07-001'),
]

test('a later event changes an earlier one only through a stored link', () => {
  const s = effective(events)
  assert.equal(s.get('idea-2026-10-07-002')!.status, 'superseded')
  assert.equal(s.get('idea-2026-10-07-002')!.by, 'decision-2026-10-07-001')
  assert.equal(s.get('idea-2026-10-07-001')!.status, 'active')
  assert.equal(s.get('question-2026-10-07-001')!.status, 'open')
})

test('why follows links back to the origin and nothing else', () => {
  assert.deepEqual([...ancestors('decision-2026-10-07-001', events)].sort(), [
    'decision-2026-10-07-001',
    'finding-2026-10-07-001',
    'idea-2026-10-07-001',
    'idea-2026-10-07-002',
  ])
  assert.deepEqual(
    [...ancestors('question-2026-10-07-001', events)],
    ['question-2026-10-07-001'],
  )
})

test('project state and the set-aside list are derived, not stored', () => {
  const s = projectState('symbolic-atlas', events)
  assert.equal(s.direction?.id, 'decision-2026-10-07-001')
  assert.deepEqual(
    s.questions.map((e) => e.id),
    ['question-2026-10-07-001'],
  )
  assert.deepEqual(
    setAside(events).map((x) => [x.event.id, x.status, x.by?.id]),
    [['idea-2026-10-07-002', 'superseded', 'decision-2026-10-07-001']],
  )
})

test('the published file holds only public fields and links that resolve', () => {
  const data = JSON.parse(
    readFileSync(
      new URL('../../public/data/idea-lineage/events.json', import.meta.url),
      'utf8',
    ),
  )
  const ids = new Set(data.events.map((e: LineageEvent) => e.id))
  for (const e of data.events) {
    for (const key of ['visibility', 'source', 'prompt', 'conversation'])
      assert.ok(!(key in e), `${e.id} has ${key}`)
    for (const targets of Object.values(e.relations ?? {}) as string[][])
      for (const t of targets) assert.ok(ids.has(t), `${e.id} → ${t}`)
  }
})
