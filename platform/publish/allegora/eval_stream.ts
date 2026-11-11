/**
 * Allegora's streamed path measured (docs/products/allegora/allegora-gcp.md): the questions eval_live.ts asks, and
 * three follow-up chains, through worker/ask.ts (POST /api/ask) against a search service and
 * Claude. For each question it records when each event arrived: the hits, the first piece of the
 * draft, the checked result and the fable.
 *
 *   ALLEGORA_SEARCH_KEY=... [ALLEGORA_SEARCH_URL=http://localhost:8080] \
 *     node --experimental-strip-types platform/publish/allegora/eval_stream.ts --label after
 *
 * Writes warehouse/features/workers_ai/eval/sfs-all-<label>.jsonl and, for the chains,
 * sfs-all-<label>-chains.jsonl. Keys are never printed.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import worker, { type Env } from '../../../worker/index.ts'
import { dotenv, paragraphOf, questions, unlimited, URL_SEARCH } from './eval_live.ts'

const OUT = join(import.meta.dirname, '..', '..', '..', 'warehouse', 'features', 'workers_ai', 'eval')
const CHAINS = [
  ['Hur lång uppsägningstid har jag om jag har jobbat på samma ställe i fem år?',
    'Och om jag är provanställd?'],
  ['Får min hyresvärd gå in i min lägenhet när jag inte är hemma?', 'Måste hen säga till innan?'],
  ['Hur många semesterdagar har jag rätt till varje år?', 'Kan jag spara några till nästa år?'],
]

type Hit = { id: string; title: string; law: string; kind?: string; score: number }
type Turn = { question: string; answer: string }

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

async function ask(env: Env, question: string, history: Turn[] = []) {
  const t0 = performance.now()
  const at: Record<string, number> = {}
  const data: Record<string, any> = {}
  let draft = ''
  const response = await worker.fetch(
    new Request('https://antonernstsson.com/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    }),
    env,
  )
  if (!response.ok) return { status: response.status, at, data, draft }
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const name = block.match(/^event: (.+)$/m)![1]
      const payload = JSON.parse(block.match(/^data: (.+)$/m)![1])
      at[name] ??= Math.round(performance.now() - t0)
      if (name === 'delta') draft += payload.text
      else data[name] = payload
    }
  }
  return { status: data.result?.status ?? 'error', at, data, draft }
}

const sentences = (fable?: string | null) =>
  fable ? fable.split('\n')[0].split(/(?<=[.!?])\s+/).filter(Boolean).length : null

function row(question: string, expected: string[], got: Awaited<ReturnType<typeof ask>>) {
  const hits: Hit[] = got.data.hits?.hits ?? []
  return {
    question,
    expected,
    query: got.data.hits?.query,
    status: got.status,
    found: expected.length
      ? hits.some((h) => expected.some((e) => paragraphOf(h) === e || h.id === e))
      : null,
    laws: new Set(hits.map((h) => h.law)).size,
    ordinances: hits.filter((h) => h.kind === 'förordning').length,
    paragraphs: new Set(hits.map(paragraphOf)).size,
    best: hits[0]?.score ?? null,
    ms: { hits: got.at.hits, first_draft: got.at.delta ?? null, result: got.at.result,
      fable: got.at.fable ?? null, done: got.at.done },
    claude: [got.data.result?.usage, got.data.fable?.usage].filter(Boolean),
    answer: got.data.result?.answer ?? null,
    fable_sentences: sentences(got.data.fable?.allegory),
    hits: hits.map((h) => ({ id: h.id, law: h.law, title: h.title, score: h.score })),
  }
}

async function main() {
  const label = arg('label') ?? 'stream'
  const keys = dotenv()
  if (!process.env.ALLEGORA_SEARCH_KEY || !keys.ANTHROPIC_API_KEY)
    throw new Error('ALLEGORA_SEARCH_KEY in the environment and ANTHROPIC_API_KEY in .env')
  const env = {
    ALLEGORA_SEARCH_URL: URL_SEARCH,
    ALLEGORA_SEARCH_KEY: process.env.ALLEGORA_SEARCH_KEY,
    ANTHROPIC_API_KEY: keys.ANTHROPIC_API_KEY,
    QUOTA: unlimited,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  } as unknown as Env
  mkdirSync(OUT, { recursive: true })

  const rows = []
  if (!process.argv.includes('--chains-only'))
    for (const q of questions()) {
      const r = row(q.question, q.expected, await ask(env, q.question))
      rows.push(r)
      console.log(r.status, r.found, r.laws, JSON.stringify(r.ms))
    }
  const chains = []
  for (const [first, follow] of CHAINS) {
    const a = row(first, [], await ask(env, first))
    const history = a.answer ? [{ question: first, answer: a.answer }] : []
    const b = row(follow, [], await ask(env, follow, history))
    chains.push({ first: a, follow: b })
    console.log('chain', a.status, '->', b.status, b.query)
  }
  const write = (name: string, list: unknown[]) =>
    writeFileSync(join(OUT, name), list.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8')
  if (rows.length) write(`sfs-all-${label}.jsonl`, rows)
  write(`sfs-all-${label}-chains.jsonl`, chains)
}

main()
