/**
 * The Riksdag ↔ AI Act analysis (platform/publish/ai_politics/export_ai_politics.py): shares rest
 * on their denominators, framing balances only exist with enough speeches, similarity pairs are
 * above their own chance baseline, and the pure helpers add up.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { balanceWord, partyTotals, yearlyShare } from '../../src/aiact/logic.ts'
import type {
  ConceptRow,
  FramingRow,
  MonthRow,
  PartyYear,
  PoliticsSummary,
  SimilarityRow,
} from '../../src/aiact/politicsTypes.ts'

const read = <T>(name: string): T =>
  JSON.parse(
    readFileSync(
      new URL(`../../public/data/ai-act/politics/${name}`, import.meta.url),
      'utf8',
    ),
  )
const summary = read<PoliticsSummary>('summary.json')
const monthly = read<MonthRow[]>('monthly.json')
const partyYear = read<PartyYear[]>('party-year.json')
const concepts = read<ConceptRow[]>('concepts.json')
const framing = read<FramingRow[]>('framing.json')
const similarity = read<SimilarityRow[]>('similarity.json')

test('monthly counts add up to the corpus and shares rest on them', () => {
  const speeches = monthly.reduce((s, m) => s + m.speeches, 0)
  const ai = monthly.reduce((s, m) => s + m.ai_speeches, 0)
  assert.equal(speeches, summary.counts.speeches)
  assert.equal(ai, summary.counts.ai_speeches)
  for (const m of monthly) {
    assert.ok(m.ai_speeches <= m.speeches, m.month)
    assert.ok(Math.abs(m.ai_share - m.ai_speeches / m.speeches) < 1e-4, m.month)
  }
})

test('yearly shares are sums, not averages of monthly shares', () => {
  const y = yearlyShare(monthly)
  assert.equal(
    y.reduce((s, r) => s + r.ai, 0),
    summary.counts.ai_speeches,
  )
  for (const r of y) assert.ok(Math.abs(r.share - r.ai / r.speeches) < 1e-12)
})

test('party totals never exceed the corpus and are sorted by share', () => {
  const totals = partyTotals(partyYear)
  assert.ok(totals.reduce((s, t) => s + t.ai, 0) <= summary.counts.ai_speeches)
  for (let i = 1; i < totals.length; i++)
    assert.ok(totals[i - 1].share >= totals[i].share)
})

test('concept shares rest on the AI speeches of the same party and period', () => {
  const all = concepts.filter((c) => c.party === 'ALL' && c.period === 'all')
  assert.ok(all.length > 0)
  for (const c of all) assert.equal(c.ai_speeches, summary.counts.ai_speeches)
  for (const c of concepts) {
    assert.ok(c.speeches_with_concept <= c.ai_speeches)
    assert.ok(c.share >= 0 && c.share <= 1)
  }
})

test('a framing balance exists only with ten speeches using either side', () => {
  for (const f of framing) {
    if (f.speeches_a + f.speeches_b < 10) assert.equal(f.balance, null)
    else
      assert.ok(
        Math.abs(
          f.balance! -
            (f.speeches_a - f.speeches_b) / (f.speeches_a + f.speeches_b),
        ) < 1e-4,
      )
  }
  assert.equal(balanceWord(null), 'few')
  assert.equal(balanceWord(0.5), 'a')
  assert.equal(balanceWord(-0.5), 'b')
  assert.equal(balanceWord(0.05), 'even')
})

test('published similarity pairs are above chance and link to the speech', () => {
  const p95 = summary.similarity.baseline_random_pairs.p95
  for (const s of similarity) {
    assert.ok(
      s.above_chance && s.similarity > p95,
      `${s.article_number}#${s.rank}`,
    )
    assert.match(s.speech_url, /^https:\/\/data\.riksdagen\.se\/anforande\//)
  }
})

test('the dictionary is published with every pattern', () => {
  const gate = summary.concepts
    .filter((c) => c.kind === 'gate')
    .map((c) => c.concept_id)
  assert.deepEqual(gate.sort(), ['ai', 'ai_act'])
  for (const c of summary.concepts)
    assert.ok(c.pattern.length > 0, c.concept_id)
})
