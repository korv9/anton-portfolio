/** A count written into page copy must equal the published file it describes. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'frontend/src'
const DATA = 'frontend/public/data/'
const json = (path: string) => JSON.parse(readFileSync(DATA + path, 'utf-8'))
const summary = json('schema/summary.json')
const PUBLISHED: [RegExp, number][] = [
  [
    /(data-quality tests|datakvalitetstester)/,
    json('products/drugcomb/tables/data_quality.json').length,
  ],
  [/(dbt models|dbt-modeller)/, summary.models],
  [/(dbt tests|dbt-tester)/, summary.tests],
  [/(source tables|källtabeller)/, summary.sources],
]
const COUNT = new RegExp(
  String.raw`(\d[\d,  ]*) (?:` +
    PUBLISHED.map(([r]) => r.source).join('|') +
    ')',
  'g',
)

test('every count in page copy is in the published data', () => {
  const files = readdirSync(SRC, { recursive: true, encoding: 'utf-8' }).filter(
    (f) => /\.tsx?$/.test(f),
  )
  let checked = 0
  for (const file of files)
    for (const [text, raw] of readFileSync(join(SRC, file), 'utf-8').matchAll(
      COUNT,
    )) {
      const [, value] = PUBLISHED.find(([r]) => r.test(text))!
      assert.equal(Number(raw.replace(/\D/g, '')), value, `${file}: ${text}`)
      checked++
    }
  assert.ok(checked > 0, 'no counts found; the pattern no longer matches copy')
})
