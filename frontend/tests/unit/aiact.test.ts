/**
 * The EU AI Act Observatory (data from platform/publish/eu_ai_act/export_ai_act.py): the
 * published files hang together, every obligation and milestone links to an official source,
 * application dates follow Article 113, and the navigator's result follows its rules.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  articleOrder,
  articleStatus,
  changesInMonth,
  isShown,
  navigatorResult,
  nowAndNext,
  obligationMatrix,
} from '../../src/aiact/logic.ts'
import type {
  Article,
  Change,
  Milestone,
  Navigator,
  Obligation,
  Actor,
} from '../../src/aiact/types.ts'

const read = <T>(name: string): T =>
  JSON.parse(
    readFileSync(
      new URL(`../../public/data/ai-act/${name}`, import.meta.url),
      'utf8',
    ),
  )
const articles = read<Article[]>('articles.json')
const obligations = read<Obligation[]>('obligations.json')
const timeline = read<Milestone[]>('timeline.json')
const changes = read<Change[]>('changes.json')
const actors = read<Actor[]>('actors.json')
const navigator = read<Navigator>('navigator.json')
const textsEn = read<Record<string, string>>('article-text-en.json')
const textsSv = read<Record<string, string>>('article-text-sv.json')
const OFFICIAL =
  /^https:\/\/(eur-lex\.europa\.eu|publications\.europa\.eu|digital-strategy\.ec\.europa\.eu|ai-act-service-desk\.ec\.europa\.eu)\//

test('every article has its text in both languages and a unique number', () => {
  const numbers = articles.map((a) => a.article_number)
  assert.equal(new Set(numbers).size, numbers.length)
  for (const a of articles) {
    assert.ok(textsEn[a.article_id]?.length, `en ${a.article_id}`)
    assert.ok(textsSv[a.article_id]?.length, `sv ${a.article_id}`)
    assert.match(a.source_url, OFFICIAL)
  }
})

test('obligations name existing actors and articles, quote the article, and link officially', () => {
  const actorIds = new Set(actors.map((a) => a.actor_id))
  const byNumber = new Map(articles.map((a) => [a.article_number, a]))
  const fold = (s: string) =>
    s.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
  for (const o of obligations) {
    assert.ok(actorIds.has(o.actor_id), o.obligation_id)
    const article = byNumber.get(o.article_number)
    assert.ok(article, o.obligation_id)
    assert.ok(
      fold(textsEn[article!.article_id]).includes(fold(o.source_quote)),
      `quote of ${o.obligation_id} not in Article ${o.article_number}`,
    )
    assert.match(o.source_url, OFFICIAL)
  }
})

test('application dates follow Article 113', () => {
  const at = (n: string) => articles.find((a) => a.article_number === n)!
  assert.equal(at('4').applies_from, '2025-02-02') // Chapter I
  assert.equal(at('5').applies_from, '2025-02-02') // Chapter II, partly later
  assert.equal(at('5').applies_from_second, '2026-12-02')
  assert.equal(at('53').applies_from, '2025-08-02') // Chapter V
  assert.equal(at('101').applies_from, '2026-08-02') // excepted from point (b)
  assert.equal(at('26').applies_from, '2027-12-02') // Chapter III, Section 3
  assert.equal(at('26').applies_from_second, '2028-08-02')
  assert.equal(at('50').applies_from, '2026-08-02') // the general date
  assert.equal(at('105').applies_from, '2026-07-27') // Articles 102–110
})

test('status on a day: applies, partly, upcoming', () => {
  const art5 = articles.find((a) => a.article_number === '5')!
  assert.equal(articleStatus(art5, '2025-01-01'), 'upcoming')
  assert.equal(articleStatus(art5, '2026-10-06'), 'partly')
  assert.equal(articleStatus(art5, '2027-01-01'), 'applies')
})

test('now and next split the timeline around a day', () => {
  const { latest, next } = nowAndNext(timeline, '2026-10-06')
  assert.ok(latest && latest.date <= '2026-10-06')
  assert.ok(next && next.date > '2026-10-06')
  assert.notEqual(latest?.kind, 'document')
})

test('every milestone and change links to an official source', () => {
  for (const m of timeline) assert.match(m.source_url, OFFICIAL, m.milestone_id)
  for (const c of changes) assert.match(c.source_url, OFFICIAL, c.change_id)
  assert.ok(changesInMonth(changes, '2026-07').length > 0)
})

test('the navigator only adds role-bound obligations for established roles', () => {
  const deployerOnly = navigatorResult(
    navigator,
    { uses_ai: 'yes', annex_iii_area: 'yes' },
    obligations,
  )
  assert.deepEqual(deployerOnly.roles, ['deployer'])
  const ids = deployerOnly.obligations.map((o) => o.obligation_id)
  assert.ok(ids.includes('deployer-human-oversight'))
  assert.ok(
    !ids.includes('risk-management'),
    'no provider duties for a deployer',
  )
  assert.ok(deployerOnly.riskClasses.includes('high_risk'))
  assert.ok(deployerOnly.articles.includes('26'))
})

test('navigator questions with a condition stay hidden until it holds', () => {
  const systemic = navigator.questions.find((q) => q.id === 'systemic_scale')!
  assert.equal(isShown(systemic, {}), false)
  assert.equal(isShown(systemic, { builds_model: 'yes' }), true)
  // An answer to a hidden question does not count.
  const result = navigatorResult(
    navigator,
    { systemic_scale: 'yes' },
    obligations,
  )
  assert.equal(result.answered, 0)
})

test('article numbers sort in the Act’s order', () => {
  assert.deepEqual(['10', '4a', '5', '4'].sort(articleOrder), [
    '4',
    '4a',
    '5',
    '10',
  ])
})

test('the obligation matrix counts by actor and topic', () => {
  const m = obligationMatrix(obligations)
  const total = [...m.values()].reduce(
    (s, row) => s + [...row.values()].reduce((a, b) => a + b, 0),
    0,
  )
  assert.equal(total, obligations.length)
})
