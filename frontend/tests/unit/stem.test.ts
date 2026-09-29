/**
 * The site's Swedish stemmer agrees with the Snowball stemmer the lexicon was learned with, on
 * every word of two real party-leader debates (fixture written by snowballstemmer).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stem } from '../../src/politik/debatter/stem.ts'

const pairs: Record<string, string> = JSON.parse(
  readFileSync(new URL('../fixtures/stem-sv.json', import.meta.url), 'utf8'),
)

test('stems as Snowball does, word for word', () => {
  const wrong = Object.entries(pairs)
    .filter(([word, expected]) => stem(word) !== expected)
    .map(([word, expected]) => `${word}: ${stem(word)} ≠ ${expected}`)
  assert.equal(wrong.length, 0, wrong.slice(0, 20).join('\n'))
  assert.ok(Object.keys(pairs).length > 5000)
})
