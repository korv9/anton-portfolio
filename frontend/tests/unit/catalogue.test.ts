/** The data catalogue: globs match like the publisher's, and every dataset is traceable. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCatalogue, globMatch } from '../../src/catalogue/logic.ts'

const read = (path: string) =>
  JSON.parse(
    readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'),
  )

test('globs match files the way the publisher writes them', () => {
  assert.ok(globMatch('ai-act/*.json', 'ai-act/actors.json'))
  assert.ok(!globMatch('ai-act/*.json', 'ai-act/jobs/terms.json'))
  assert.ok(globMatch('debates/**', 'debates/2024/a.json'))
  assert.ok(
    globMatch(
      'symbolic/**book-centered-*',
      'symbolic/v4/book-centered-atlas.parquet',
    ),
  )
})

test('the AI Act obligations dataset has its model, its source and its reader', () => {
  const catalogue = buildCatalogue(
    read('architecture/graph.json'),
    read('catalog.json'),
    read('quality/checks.json'),
  )
  const d = catalogue.find((x) => x.id === 'out:ai-act/obligations.json')!
  assert.equal(d.files.length, 1)
  assert.ok(d.rows > 0)
  assert.deepEqual(
    d.models.map((m) => m.id),
    ['dbt:mart_ai_act_obligations'],
  )
  assert.ok(d.models[0].columns!.includes('source_quote'))
  assert.ok(d.sources.some((s) => s.id === 'src:publications-office'))
  assert.ok(d.consumers.some((c) => c.id === 'app:ai_act'))
  // A check naming several datasets counts for each of them.
  assert.ok(d.checks.length > 0)
})
