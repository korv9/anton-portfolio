/**
 * Herr taLLMan's engine without network: Swedish numbers, entities, Allegoria's six labels,
 * certainty, and a whole question through the lexical retriever over the real index with a
 * stub shard.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  certainty,
  checkAll,
  stats,
  statsLine,
} from '../../src/tallman/engine/allegoria.ts'
import { entities } from '../../src/tallman/engine/entities.ts'
import { ask } from '../../src/tallman/engine/pipeline.ts'
import { LexicalRetriever } from '../../src/tallman/engine/retrieve.ts'
import { numbers, sameNumber } from '../../src/tallman/engine/text.ts'
import { parseClaims } from '../../src/tallman/engine/claims.ts'
import type {
  Claim,
  Passage,
  TallmanIndex,
} from '../../src/tallman/engine/types.ts'

const budgetS: Passage = {
  id: 'dp:budget:2026:S',
  kind: 'datapoint',
  text: 'Socialdemokraternas (S) budgetmotion för 2026 innebar sammanlagt +27 226 mnkr jämfört med regeringens förslag.',
  title: 'Budgetmotioner',
  parties: ['S'],
  values: { msek: 27226 },
  factKind: 'budget_total',
  sourceLabel: 'Finansutskottet',
  score: 1,
  retriever: 'lexikal',
}
const budgetC: Passage = {
  ...budgetS,
  id: 'dp:budget:2026:C',
  text: 'Centerpartiets (C) budgetmotion för 2026 innebar sammanlagt −5 035 mnkr jämfört med regeringens förslag.',
  parties: ['C'],
  values: { msek: -5035 },
}
const speech: Passage = {
  id: 'tal:HD09157-2#0',
  kind: 'speech',
  text: 'Vänsterpartiet yrkar bifall till reservation 1, vilket innebär avslag på regeringens förslag om en sänkning av straffbarhetsåldern till 14 år. Barn och unga som har begått brott måste möta konsekvenser.',
  title: 'Skärpta regler för unga lagöverträdare',
  parties: ['V'],
  speaker: 'Gudrun Nordborg (V)',
  date: '2026-08-13',
  sourceLabel: 'Riksdagens protokoll',
  score: 1,
  retriever: 'lexikal',
}
const passages = [budgetS, budgetC, speech]

function label(claim: Omit<Claim, 'id'>) {
  return checkAll([{ id: 'x', ...claim }], passages).claims[0]
}

test('numbers are read the Swedish way; years, dates and sessions are not measures', () => {
  assert.deepEqual(
    numbers('sammanlagt +27 226 mnkr och −5 035 mnkr, 41,3 %'),
    [27226, -5035, 41.3],
  )
  assert.deepEqual(numbers('riksmötet 2024/25, den 2026-08-13, år 2026'), [])
  assert.deepEqual(numbers('S-regeringen och 15–17 år'), [15, 17])
  assert.ok(sameNumber(41.3, 41.27))
  assert.ok(!sameNumber(41.3, 42.3))
})

test('entities: parties by name and abbreviation, sessions, years, intents, unknown parties', () => {
  const e = entities('Hur ofta röstade SD och Moderaterna lika 2024/25?')
  assert.deepEqual(e.parties, ['SD', 'M'])
  assert.deepEqual(e.sessions, ['2024/25'])
  assert.ok(e.intents.includes('agreement'))
  assert.deepEqual(entities('Hur gick det för Piratpartiet?').unknownParties, [
    'piratpartiet',
  ])
  // A lone lower-case "m" in running text is not Moderaterna.
  assert.deepEqual(entities('hur många m ska byggas').parties, [])
})

test('Allegoria: a figure stated by the source is directly supported', () => {
  const c = label({
    type: 'summary',
    text: 'Socialdemokraternas budgetmotion för 2026 innebar +27 226 mnkr jämfört med regeringens förslag.',
    sources: ['dp:budget:2026:S'],
  })
  assert.equal(c.label, 'direct')
})

test('Allegoria: a difference of two source values is computed', () => {
  const c = label({
    type: 'computed',
    text: 'Skillnaden mellan S och C är 32 261 mnkr.',
    sources: ['dp:budget:2026:S', 'dp:budget:2026:C'],
    formula: '27 226 − −5 035',
  })
  assert.equal(c.label, 'computed')
})

test('Allegoria: a number no source holds or yields is insufficient', () => {
  const c = label({
    type: 'summary',
    text: 'Socialdemokraternas budgetmotion innebar +40 000 mnkr.',
    sources: ['dp:budget:2026:S'],
  })
  assert.equal(c.label, 'insufficient')
})

test('Allegoria: a verbatim quote is direct, an altered one is insufficient', () => {
  const ok = label({
    type: 'quote',
    text: 'Gudrun Nordborg (V): ”Barn och unga som har begått brott måste möta konsekvenser.”',
    quote: 'Barn och unga som har begått brott måste möta konsekvenser.',
    sources: ['tal:HD09157-2#0'],
  })
  assert.equal(ok.label, 'direct')
  const altered = label({
    type: 'quote',
    text: 'Gudrun Nordborg (V): ”Barn som begått brott ska straffas hårt.”',
    quote: 'Barn som begått brott ska straffas hårt.',
    sources: ['tal:HD09157-2#0'],
  })
  assert.equal(altered.label, 'insufficient')
})

test('Allegoria: summary, interpretation, missing source, change without annotation', () => {
  assert.equal(
    label({
      type: 'summary',
      text: 'Vänsterpartiet yrkade avslag på sänkningen av straffbarhetsåldern.',
      sources: ['tal:HD09157-2#0'],
    }).label,
    'summary',
  )
  assert.equal(
    label({
      type: 'interpretation',
      text: 'Vänsterpartiet tyder på att vilja skydda barn från fängelse.',
      sources: ['tal:HD09157-2#0'],
    }).label,
    'interpretation',
  )
  assert.equal(
    label({
      type: 'summary',
      text: 'Något helt annat.',
      sources: ['tal:saknas'],
    }).label,
    'insufficient',
  )
  const change = label({
    type: 'summary',
    text: 'Regeringen har skärpt reglerna för unga lagöverträdare.',
    sources: ['tal:HD09157-2#0'],
  })
  assert.equal(change.label, 'insufficient')
  const annotated = checkAll(
    [
      {
        id: 'y',
        type: 'summary',
        text: 'Regeringen har skärpt reglerna för unga lagöverträdare.',
        sources: ['tal:HD09157-2#0'],
      },
    ],
    passages,
    [
      {
        id: 'a1',
        about: ['tal:HD09157-2#0'],
        direction: 'skärpning',
        text: 'test',
        reviewed_by: 'test',
        reviewed_at: '2026-09-29',
        source: 'test',
      },
    ],
  ).claims[0]
  assert.notEqual(annotated.label, 'insufficient')
})

test('Allegoria: two values for the same fact are conflicting sources', () => {
  const other = {
    ...budgetS,
    values: { msek: 30000 },
    text: budgetS.text.replace('27 226', '30 000'),
  }
  const result = checkAll(
    [{ id: 'z', type: 'summary', text: budgetS.text, sources: [budgetS.id] }],
    [budgetS, other],
  )
  assert.equal(result.claims[0].label, 'conflict')
  assert.equal(result.conflicts.length, 1)
})

test('certainty and the stats line', () => {
  const s = stats(12, [
    {
      id: '1',
      type: 'quote',
      text: '',
      sources: [],
      label: 'direct',
      support: 1,
      notes: [],
    },
    {
      id: '2',
      type: 'summary',
      text: '',
      sources: [],
      label: 'direct',
      support: 1,
      notes: [],
    },
    {
      id: '3',
      type: 'interpretation',
      text: '',
      sources: [],
      label: 'interpretation',
      support: 1,
      notes: [],
    },
  ])
  assert.equal(certainty(s), 'Hög')
  assert.equal(
    statsLine(s),
    '12 källor hämtade · 3 påståenden kontrollerade · 2 direkt stödda · 1 analytisk tolkning',
  )
  assert.equal(certainty(stats(0, [])), 'Låg')
})

test('model output is parsed strictly: malformed claims are dropped', () => {
  const set = parseClaims({
    lead: 'x',
    claims: [
      { text: 'a', type: 'summary', sources: ['dp:1'] },
      { text: 'b' },
      { text: 'c', type: 'påhittad', sources: ['dp:2'] },
    ],
  })
  assert.equal(set.claims.length, 2)
  assert.equal(set.claims[1].type, 'interpretation')
})

test('a whole question over the real index, no network', async () => {
  const index: TallmanIndex = JSON.parse(
    readFileSync(
      new URL('../../public/data/tallman/index.json', import.meta.url),
      'utf8',
    ),
  )
  const retriever = new LexicalRetriever(index, async () => [])
  const answer = await ask(
    'Hur ofta röstade SD och M lika under riksmötet 2024/25?',
    {
      retriever,
      dataVersion: 'test',
    },
  )
  assert.ok(answer.trace.passages.some((p) => p.id === 'dp:rost:2024/25:M-SD'))
  assert.ok(answer.claims.length > 0)
  assert.ok(answer.claims.every((c) => c.label !== 'insufficient'))
  const none = await ask('Vad beslutar riksdagen om budgeten 2030?', {
    retriever,
    dataVersion: 'test',
  })
  assert.equal(none.claims.length, 0)
  assert.equal(none.certainty, 'Låg')
})
