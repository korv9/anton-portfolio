/**
 * The site scores a speech with the learned lexicon exactly as issue_lexicon.py does: same
 * top area and same score, on forty speeches from a real party-leader debate.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  issueScores,
  setIssueLexicon,
} from '../../src/politik/debatter/lexicon.ts'

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))

test('scores speeches as the Python lexicon does', () => {
  setIssueLexicon(
    read('../../public/data/politics/parliament/issue-lexicon.json'),
  )
  const cases: { text: string; top: string | null; score: number }[] = read(
    '../fixtures/issue-scores.json',
  )
  for (const c of cases) {
    const scores = issueScores(c.text)
    const top = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]
    assert.equal(top?.[0] ?? null, c.top)
    if (top) assert.ok(Math.abs(top[1] - c.score) < 0.01)
  }
})
