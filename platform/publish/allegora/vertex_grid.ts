/**
 * Allegora's table through Vertex AI batch prediction: for each law and question, the eight nearest
 * passages within that law, an answer, the quote check, and an allegory of what passed.
 *
 *   node --experimental-strip-types platform/publish/allegora/vertex_grid.ts plan [--limit 2]
 *   node --experimental-strip-types platform/publish/allegora/vertex_grid.ts run  [--limit 2]
 *
 * `plan` embeds the questions (Workers AI, bge-m3, as the page does) and reports the cells and input
 * tokens without calling Vertex. `run` also submits, waits and writes the result to OUT. --limit
 * takes the first laws only. Needs CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and, for `run`,
 * VERTEX_ACCESS_TOKEN (from Workload Identity Federation in allegora-grid.yml); no key is stored.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { project, type Pca } from '../../../frontend/src/workersAi/search.ts'
import { EMBED_MODEL } from '../../../worker/index.ts'
import {
  LAWS,
  QUESTIONS,
  allegoryPrompt,
  answerPrompt,
  batchLine,
  cellQuestion,
  inLaw,
  judge,
  parseOutputs,
  usableAllegory,
  vertexHost,
  type Item,
  type Output,
} from './grid.ts'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const SFS = join(ROOT, 'frontend', 'public', 'data', 'workers-ai', 'sfs')
const OUT = join(ROOT, 'tmp', 'allegora-grid')
const PROJECT = 'allegora-513419'
const LOCATION = process.env.VERTEX_LOCATION?.trim() || 'eu'
const HOST = vertexHost(LOCATION)
const BUCKET = 'allegora-513419-batch'
const MODEL = process.env.VERTEX_MODEL ?? 'gemini-3.8-flash'
const K = 8
const POLL_MS = 60_000
const WAIT_MS = 5 * 60 * 60_000

const need = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set`)
  return value
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex')

async function embed(text: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${need('CLOUDFLARE_ACCOUNT_ID')}/ai/run/${EMBED_MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${need('CLOUDFLARE_API_TOKEN')}` },
      body: JSON.stringify({ text: [text] }),
    },
  )
  const body = (await response.json()) as { success: boolean; result?: { data: number[][] } }
  if (!body.success || !body.result) throw new Error(`embedding failed: ${response.status}`)
  return body.result.data[0]
}

/** The k nearest passages among the given rows of the corpus. */
function nearest(query: Float32Array, vectors: Int8Array, scale: number[], rows: number[]) {
  const dims = query.length
  return rows
    .map((row) => {
      let score = 0
      for (let d = 0; d < dims; d++) score += query[d] * scale[d] * vectors[row * dims + d]
      return { row, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, K)
    .map((hit) => hit.row)
}

async function vertex(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${need('VERTEX_ACCESS_TOKEN')}`, ...init.headers },
  })
  // Google's error body names the permission or model that failed; it holds no credential.
  if (!response.ok) throw new Error(`${response.status} ${path}\n${await response.text()}`)
  return response
}

/** Upload the lines, run one batch job, and return its outputs keyed by prompt. */
async function batch(name: string, lines: string[]) {
  const object = `${name}/input.jsonl`
  await vertex(
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(object)}`,
    { method: 'POST', body: `${lines.join('\n')}\n` },
  )
  const api = `${HOST}/v1/projects/${PROJECT}/locations/${LOCATION}/batchPredictionJobs`
  const job = (await (
    await vertex(api, {
      method: 'POST',
      body: JSON.stringify({
        displayName: name,
        model: `publishers/google/models/${MODEL}`,
        inputConfig: { instancesFormat: 'jsonl', gcsSource: { uris: [`gs://${BUCKET}/${object}`] } },
        outputConfig: {
          predictionsFormat: 'jsonl',
          gcsDestination: { outputUriPrefix: `gs://${BUCKET}/${name}/output` },
        },
      }),
    })
  ).json()) as { name: string }
  const url = `${HOST}/v1/${job.name}`
  console.log(`job ${job.name}`)
  for (const start = Date.now(); Date.now() - start < WAIT_MS; ) {
    const state = (await (await vertex(url)).json()) as { state: string; error?: unknown }
    console.log(state.state)
    if (state.state === 'JOB_STATE_SUCCEEDED') return outputs(`${name}/output/`)
    if (/FAILED|CANCELLED|EXPIRED/.test(state.state))
      throw new Error(`${state.state}: ${JSON.stringify(state.error)}`)
    await new Promise((done) => setTimeout(done, POLL_MS))
  }
  throw new Error(`still running after the wait, not cancelled: ${job.name}`)
}

async function outputs(prefix: string) {
  const list = (await (
    await vertex(
      `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=${encodeURIComponent(prefix)}`,
    )
  ).json()) as { items?: { name: string }[] }
  const merged = new Map<string, Output>()
  for (const { name } of list.items ?? []) {
    if (!name.endsWith('.jsonl') || name.includes('incremental')) continue
    const file = await vertex(
      `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(name)}?alt=media`,
    )
    for (const [key, value] of parseOutputs(await file.text())) merged.set(key, value)
  }
  return merged
}

async function main() {
  const [command, flag, value] = process.argv.slice(2)
  if (command !== 'plan' && command !== 'run') throw new Error('plan or run')
  const laws = flag === '--limit' ? LAWS.slice(0, Number(value)) : LAWS
  const pca = JSON.parse(readFileSync(join(SFS, 'pca.json'), 'utf-8')) as Pca
  const bin = readFileSync(join(SFS, 'vectors.bin'))
  const vectors = new Int8Array(bin.buffer, bin.byteOffset, bin.length)
  const delivery = JSON.parse(readFileSync(join(SFS, '..', '..', 'delivery.json'), 'utf-8'))
  const meta = (await (
    await fetch(`${delivery.bases.shard}workers-ai/sfs/meta.json`)
  ).json()) as { items: Item[]; fetched: string }

  const cells = []
  for (const law of laws) {
    const rows = meta.items.flatMap((item, row) => (inLaw(item.id, law.sfs) ? [row] : []))
    if (!rows.length) throw new Error(`no passages for ${law.title} (${law.sfs})`)
    for (const q of QUESTIONS) {
      const question = cellQuestion(law, q.sv)
      const query = project(await embed(cellQuestion(law, q.search ?? q.sv)), pca)
      const passages = nearest(query, vectors, pca.scale, rows).map((row) => meta.items[row])
      cells.push({ law, q, question, passages, prompt: answerPrompt(question, passages) })
    }
  }
  const characters = cells.reduce((sum, c) => sum + c.prompt.system.length + c.prompt.user.length, 0)
  console.log(
    `${laws.length} laws, ${cells.length} cells, ${MODEL} in ${LOCATION}, about ${Math.round(characters / 4)} input tokens`,
  )
  if (command === 'plan') return

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const answers = await batch(`grid-${stamp}/answers`, cells.map((c) => batchLine(c.prompt)))
  const judged = cells.map((c) => ({ ...c, verdict: judge(answers.get(c.prompt.user)?.text ?? null, c.passages) }))
  const passed = judged.flatMap((c) =>
    c.verdict.status === 'verified'
      ? [{ cell: c, prompt: allegoryPrompt(c.question, c.verdict.answer) }]
      : [],
  )
  const tales = passed.length
    ? await batch(`grid-${stamp}/allegories`, passed.map((p) => batchLine(p.prompt)))
    : new Map<string, Output>()
  const taleOf = new Map(passed.map((p) => [p.cell, tales.get(p.prompt.user)?.text]))
  const total = (m: Map<string, Output>, key: 'tokens_in' | 'tokens_out') =>
    [...m.values()].reduce((sum, o) => sum + o.usage[key], 0)
  const count = (status: string) => judged.filter((c) => c.verdict.status === status).length

  const result = {
    schema_version: 1,
    created: new Date().toISOString(),
    model: MODEL,
    location: LOCATION,
    embed_model: EMBED_MODEL,
    laws_fetched: meta.fetched,
    source_sha256: hash(cells.map((c) => c.passages.map((p) => p.text).join()).join()),
    counts: {
      cells: cells.length,
      verified: count('verified'),
      no_answer: count('no_answer'),
      unverified: count('unverified'),
      failed: count('failed'),
    },
    tokens: {
      in: total(answers, 'tokens_in') + total(tales, 'tokens_in'),
      out: total(answers, 'tokens_out') + total(tales, 'tokens_out'),
    },
    questions: QUESTIONS,
    laws: laws.map(({ sfs, title }) => ({ sfs, title })),
    cells: judged.map((c) => ({
      sfs: c.law.sfs,
      question: c.q.id,
      ...c.verdict,
      allegory: usableAllegory(taleOf.get(c)),
      // The text behind each quote, so a reader can check it without the 6.8 MB corpus.
      sources:
        c.verdict.status === 'verified'
          ? c.passages
              .filter((p) => (c.verdict as { quotes: { id: string }[] }).quotes.some((q) => q.id === p.id))
              .map(({ id, title, url }) => ({ id, title, url }))
          : [],
    })),
  }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'grid.json'), `${JSON.stringify(result, null, 1)}\n`)
  console.log(JSON.stringify({ counts: result.counts, tokens: result.tokens }))
}

await main()
