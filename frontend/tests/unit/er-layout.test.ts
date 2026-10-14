/**
 * The tech panel's ER layout (src/tech/erLayout.ts) on the exported model: every table of a
 * subject is placed, no two boxes overlap, and every relation is drawn between boxes that are
 * in the diagram, so a new table or relation in schema/er.json is drawn without code changes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BOX_W,
  layout,
  tablesOf,
  type ErModel,
} from '../../src/tech/erLayout.ts'

const er: ErModel = JSON.parse(
  readFileSync(
    new URL('../../public/data/schema/er.json', import.meta.url),
    'utf8',
  ),
)

for (const { key } of er.domains)
  test(`${key}: every table placed, none overlapping, every relation drawn`, () => {
    const { own, relations } = tablesOf(er, key)
    const { boxes, lines, width, height } = layout(er, key)
    const placed = new Set(boxes.map((b) => b.table.id))
    for (const t of own) assert.ok(placed.has(t.id), t.id)
    for (const a of boxes) {
      assert.ok(a.x >= 0 && a.x + BOX_W <= width, `${a.table.id} inside width`)
      assert.ok(a.y >= 0 && a.y + a.h <= height, `${a.table.id} inside height`)
      for (const b of boxes)
        if (a !== b)
          assert.ok(
            a.x + BOX_W <= b.x ||
              b.x + BOX_W <= a.x ||
              a.y + a.h <= b.y ||
              b.y + b.h <= a.y,
            `${a.table.id} overlaps ${b.table.id}`,
          )
    }
    assert.equal(lines.length, relations.filter((r) => r.from !== r.to).length)
    for (const l of lines) {
      assert.ok(placed.has(l.relation.from), l.relation.from)
      assert.ok(placed.has(l.relation.to), l.relation.to)
      assert.doesNotMatch(l.path, /NaN/)
    }
  })

test('a table added to the export is drawn', () => {
  const grown: ErModel = {
    ...er,
    tables: [
      ...er.tables,
      {
        id: 'fct_new',
        layer: 'gold',
        domain: 'news',
        kind: 'fact',
        built: true,
        rows: 1,
        description: '',
        columns: [{ name: 'date_day', type: 'DATE' }],
        pk: [],
      },
    ],
    relations: [
      ...er.relations,
      {
        from: 'fct_new',
        from_cols: ['date_day'],
        to: 'dim_date',
        to_cols: ['date_day'],
        cardinality: 'many-to-one',
        basis: ['data'],
        coverage: 1,
      },
    ],
  }
  const { boxes, lines } = layout(grown, 'news')
  assert.ok(boxes.some((b) => b.table.id === 'fct_new'))
  assert.ok(boxes.some((b) => b.table.id === 'dim_date' && b.foreign))
  assert.ok(lines.some((l) => l.relation.from === 'fct_new'))
})
