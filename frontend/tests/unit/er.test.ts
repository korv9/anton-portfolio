/**
 * The ER model the diagram page draws (schema/er.json, from platform/publish/export_er.py):
 * every relation joins tables and columns that exist, keys are real columns, and a relation
 * checked in the data has the coverage the export promises.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const er = JSON.parse(
  readFileSync(
    new URL('../../public/data/schema/er.json', import.meta.url),
    'utf8',
  ),
)
const tables = new Map(er.tables.map((t: { id: string }) => [t.id, t]))
const cols = (id: string) =>
  new Set(
    (tables.get(id) as { columns: { name: string }[] }).columns.map(
      (c) => c.name,
    ),
  )

test('every primary key is made of the table’s own columns', () => {
  for (const t of er.tables)
    for (const k of t.pk) assert.ok(cols(t.id).has(k), `${t.id}.${k}`)
})

test('every relation joins existing tables on existing columns', () => {
  for (const r of er.relations) {
    assert.ok(tables.has(r.from), r.from)
    assert.ok(tables.has(r.to), r.to)
    assert.equal(r.from_cols.length, r.to_cols.length)
    for (const c of r.from_cols)
      assert.ok(cols(r.from).has(c), `${r.from}.${c}`)
    for (const c of r.to_cols) assert.ok(cols(r.to).has(c), `${r.to}.${c}`)
  }
})

test('a relation rests on the data or a dbt test, and checked ones cover at least 90 %', () => {
  for (const r of er.relations) {
    assert.ok(r.basis.length > 0)
    if (r.basis.includes('data'))
      assert.ok(r.coverage >= 0.9, `${r.from} → ${r.to}`)
    else assert.equal(r.coverage, null)
  }
})

test('every table belongs to a listed area', () => {
  const areas = new Set(er.domains.map((d: { key: string }) => d.key))
  for (const t of er.tables) assert.ok(areas.has(t.domain), t.id)
})
