/**
 * Runs the test questions through taLLMan and measures two things:
 *
 * - retrieval: did the expected passages (or debates) come back? (recall per question)
 * - source support: of the claims made, how many did Allegoria find supported
 *   (direct, computed, summary), how many are interpretations, how many lack support?
 *
 * Questions without an answer in the data must get no supported claims, and questions about
 * change over time must not be answered as settled without a reviewed annotation.
 *
 *   node platform/tallman/eval/run.ts            # lexical, no model
 *   node platform/tallman/eval/run.ts --llm      # with Claude; needs ANTHROPIC_API_KEY
 *
 * Shards are read from R2 (SHARD_BASE to override). Writes report-<mode>.json next to this file.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ask } from '../../../frontend/src/tallman/engine/pipeline.ts'
import { LexicalRetriever, fetchShards } from '../../../frontend/src/tallman/engine/retrieve.ts'
import type { Answer, TallmanIndex } from '../../../frontend/src/tallman/engine/types.ts'

type Expect = {
  sources?: string[]
  debates?: string[]
  insufficient?: boolean
  changeWithoutAnnotation?: boolean
}
type Question = { id: string; category: string; question: string; expect: Expect; reviewed: boolean }

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const index: TallmanIndex = JSON.parse(
  readFileSync(join(root, 'frontend/public/data/tallman/index.json'), 'utf8'),
)
const { questions }: { questions: Question[] } = JSON.parse(
  readFileSync(join(here, 'questions.json'), 'utf8'),
)
const useLlm = process.argv.includes('--llm')

const retriever = new LexicalRetriever(
  index,
  fetchShards(process.env.SHARD_BASE ?? 'https://pub-9867b18896ba49e4a0b4a3d2f39c0385.r2.dev/'),
)
let model = null
if (useLlm) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('--llm needs ANTHROPIC_API_KEY in the environment')
  const { anthropicModel } = await import('../../../worker/llm.ts')
  model = anthropicModel({ apiKey: key, model: process.env.LLM_MODEL })
}

const CHANGE = /skärp|lätta|lättnad|strängare|mildare|mildra|hårdare|mjukare/i
const SUPPORTED = new Set(['direct', 'computed', 'summary'])

function score(q: Question, a: Answer) {
  const ids = a.trace.passages.map((p) => p.id)
  const titles = a.trace.passages.map((p) => p.title.toLowerCase())
  const wanted = [
    ...(q.expect.sources ?? []).map((s) => ids.includes(s)),
    ...(q.expect.debates ?? []).map((d) => titles.some((t) => t.includes(d.toLowerCase()))),
  ]
  const recall = wanted.length ? wanted.filter(Boolean).length / wanted.length : null
  const supported = a.claims.filter((c) => SUPPORTED.has(c.label)).length
  const interpretation = a.claims.filter((c) => c.label === 'interpretation').length
  const unsupported = a.claims.length - supported - interpretation
  let pass: boolean
  if (q.expect.insufficient) pass = supported === 0
  else if (q.expect.changeWithoutAnnotation)
    pass =
      a.certainty !== 'Hög' &&
      a.claims
        .filter((c) => !c.quote && CHANGE.test(c.text))
        .every((c) => c.label === 'insufficient')
  else pass = recall === 1 && supported > 0
  return { recall, claims: a.claims.length, supported, interpretation, unsupported, pass }
}

const rows = []
for (const q of questions) {
  const answer = await ask(q.question, {
    retriever,
    model,
    dataVersion: `index ${index.generated_at}`,
  })
  const s = score(q, answer)
  rows.push({
    id: q.id,
    category: q.category,
    question: q.question,
    reviewed: q.reviewed,
    ...s,
    certainty: answer.certainty,
    stats: answer.statsLine,
    retrieved: answer.trace.passages.map((p) => p.id),
    labels: answer.claims.map((c) => c.label),
  })
  console.log(
    `${s.pass ? 'ok  ' : 'FAIL'} ${q.id.padEnd(13)} recall ${s.recall == null ? ' – ' : s.recall.toFixed(2)}  ${answer.statsLine}`,
  )
}

const retrieval = rows.filter((r) => r.recall != null)
const claims = rows.reduce((n, r) => n + r.claims, 0)
const summary = {
  mode: useLlm ? `llm (${model?.name})` : 'extraktiv, utan språkmodell',
  retriever: retriever.name,
  run_at: new Date().toISOString(),
  index_generated_at: index.generated_at,
  questions: rows.length,
  reviewed_questions: rows.filter((r) => r.reviewed).length,
  passed: rows.filter((r) => r.pass).length,
  retrieval_recall:
    Math.round((retrieval.reduce((s, r) => s + r.recall!, 0) / retrieval.length) * 1000) / 1000,
  claims,
  supported_share: claims
    ? Math.round((rows.reduce((n, r) => n + r.supported, 0) / claims) * 1000) / 1000
    : null,
  interpretation_share: claims
    ? Math.round((rows.reduce((n, r) => n + r.interpretation, 0) / claims) * 1000) / 1000
    : null,
  unsupported_share: claims
    ? Math.round((rows.reduce((n, r) => n + r.unsupported, 0) / claims) * 1000) / 1000
    : null,
}
console.log('\n' + JSON.stringify(summary, null, 1))
writeFileSync(
  join(here, `report-${useLlm ? 'llm' : 'extractive'}.json`),
  JSON.stringify({ summary, rows }, null, 1) + '\n',
)
