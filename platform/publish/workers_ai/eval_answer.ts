/**
 * Ask the eval questions (configs/workers_ai/eval_questions.yaml) through the same path as the
 * Fråga lagen page, to choose the model behind /api/answer (docs/workers-ai.md).
 *
 *   node --experimental-strip-types platform/publish/workers_ai/eval_answer.ts \
 *     run --model @cf/openai/gpt-oss-20b [--options '{"reasoning_effort":"low"}'] [--label low]  *     [--max-neurons 1500] [--limit 1]
 *   node --experimental-strip-types platform/publish/workers_ai/eval_answer.ts \
 *     examples --model <chosen> --ids sfs:0,sfs:1,ai-act-sv:12,ai-act-en:12,...
 *
 * In --ids, <corpus>:<n> is the n-th eval question (from 0); for ai-act-en its question_en is asked.
 * --questions picks another question file (eval_questions_platform.yaml for Ask the platform) and
 * --agent the name in the ledger (default law-eval).
 *
 * The question is embedded and answered by worker/index.ts itself (its fetch handler, system
 * prompt and quote check), with env.AI.run sent to the Workers AI REST endpoint and env.ASSETS
 * reading frontend/public/data. The search is the browser's (frontend/src/workersAi/search.ts):
 * PCA from pca.json, int8 kNN, top 8. The answer model is swapped by the shim, so the Worker code
 * is unchanged. Every call appends one line to warehouse/cluster_lab/workers_ai_ledger.jsonl;
 * results go to warehouse/features/workers_ai/eval/<model>.jsonl. Keys come from .env and are
 * never printed. SFS meta.json lives in R2 and is fetched from the public delivery base.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import worker, {
  ANSWER_MODEL,
  ANSWER_OPTIONS,
  EMBED_MODEL,
  type Env,
} from '../../../worker/index.ts'
import { knn, project, type Pca } from '../../../frontend/src/workersAi/search.ts'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const DATA = join(ROOT, 'frontend', 'public', 'data')
const LEDGER = join(ROOT, 'warehouse', 'cluster_lab', 'workers_ai_ledger.jsonl')
const OUT = join(ROOT, 'warehouse', 'features', 'workers_ai', 'eval')
const K = 8
// Neurons per token, from developers.cloudflare.com/workers-ai/platform/pricing (2026-10-15).
const PRICE: Record<string, [number, number]> = {
  '@cf/baai/bge-m3': [1075e-6, 0],
  '@cf/google/gemma-4-26b-a4b-it': [9091e-6, 27273e-6],
  '@cf/openai/gpt-oss-20b': [18182e-6, 27273e-6],
}

type Question = {
  corpus: string
  question: string
  question_en: string
  expected: string[]
}
type Item = { id: string; text: string }
type Usage = {
  model: string
  tokens_in: number
  tokens_out: number
  neurons: number
  text?: string
}

function env(): Record<string, string> {
  const out: Record<string, string> = {}
  const file = join(ROOT, '.env')
  const lines = existsSync(file) ? readFileSync(file, 'utf-8').split(/\r?\n/) : []
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return { ...out, ...(process.env as Record<string, string>) }
}

function spentToday(): number {
  if (!existsSync(LEDGER)) return 0
  const day = new Date().toISOString().slice(0, 10)
  return readFileSync(LEDGER, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
    .filter((r) => String(r.utc).slice(0, 10) === day)
    .reduce((sum, r) => sum + (r.neurons_est ?? 0), 0)
}

/** env.AI over REST; the Worker's answer model and its ANSWER_OPTIONS are replaced. */
function shim(answerModel: string, calls: Usage[], options?: Record<string, unknown>): Env['AI'] {
  const keys = env()
  return {
    async run(model: string, input: unknown) {
      const used = model === ANSWER_MODEL ? answerModel : model
      if (model === ANSWER_MODEL && options) {
        const rest = { ...(input as Record<string, unknown>) }
        for (const key of Object.keys(ANSWER_OPTIONS)) delete rest[key]
        input = { ...rest, ...options }
      }
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${keys.CLOUDFLARE_ACCOUNT_ID.trim()}/ai/run/${used}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${keys.CLOUDFLARE_API_TOKEN.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        },
      )
      const body = (await response.json()) as {
        success: boolean
        errors?: unknown
        result: Record<string, unknown>
      }
      if (!body.success) throw new Error(JSON.stringify(body.errors))
      const usage = (body.result.usage ?? {}) as Record<string, number>
      const tokensIn = usage.prompt_tokens ?? 0
      const tokensOut = usage.completion_tokens ?? 0
      const [pin, pout] = PRICE[used] ?? [0, 0]
      const call = {
        model: used,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        // Cloudflare reports neurons for chat models; the price list covers the rest.
        neurons: usage.neurons ?? tokensIn * pin + tokensOut * pout,
      }
      const choice = (body.result.choices as { message?: { content?: string } }[] | undefined)?.[0]
      calls.push({ ...call, text: String(body.result.response ?? choice?.message?.content ?? '') })
      appendFileSync(
        LEDGER,
        JSON.stringify({
          utc: new Date().toISOString(),
          agent: arg('agent') ?? 'law-eval',
          model: used,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          neurons_est: Math.round(call.neurons * 1e4) / 1e4,
        }) + '\n',
      )
      return body.result
    },
  }
}

const assets: Env['ASSETS'] = {
  async fetch(request: Request) {
    const path = join(DATA, decodeURIComponent(new URL(request.url).pathname.replace(/^\/data\//, '')))
    return existsSync(path)
      ? new Response(readFileSync(path))
      : new Response('not found', { status: 404 })
  },
}

async function corpus(name: string) {
  const dir = join(DATA, 'workers-ai', name)
  const pca = JSON.parse(readFileSync(join(dir, 'pca.json'), 'utf-8')) as Pca
  const bin = readFileSync(join(dir, 'vectors.bin'))
  const vectors = new Int8Array(bin.buffer, bin.byteOffset, bin.length)
  let meta: { items: Item[] }
  if (existsSync(join(dir, 'meta.json')))
    meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf-8'))
  else {
    const delivery = JSON.parse(readFileSync(join(DATA, 'delivery.json'), 'utf-8'))
    meta = await (await fetch(`${delivery.bases.shard}workers-ai/${name}/meta.json`)).json()
  }
  return { pca, vectors, items: meta.items }
}

async function post(ai: Env['AI'], path: string, body: unknown) {
  const request = new Request(`https://local/api/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const response = await worker.fetch(request, { AI: ai, ASSETS: assets })
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

/** One question through embed, browser search and answer, as the page does it. */
async function ask(ai: Env['AI'], name: string, question: string, calls: Usage[]) {
  const c = await corpus(name)
  const embedded = await post(ai, 'embed', { text: question })
  if (embedded.status !== 200) throw new Error(`embed: http ${embedded.status} ${JSON.stringify(embedded.body)}`)
  const vector = embedded.body.vector as number[]
  const hits = knn(project(vector, c.pca), c.vectors, c.pca.scale, 10)
  const top = hits.slice(0, K).map((h) => c.items[h.index])
  const before = calls.length
  const answered = await post(ai, 'answer', {
    question,
    corpus: name,
    passages: top.map(({ id, text }) => ({ id, text })),
  })
  const used = calls.slice(before).filter((u) => u.model !== EMBED_MODEL)
  return {
    vector,
    retrieved: hits.map((h) => c.items[h.index].id),
    status: answered.status === 200 ? answered.body.status : `http ${answered.status}`,
    answer: answered.body,
    // The model's own text, kept for the eval log: the Worker drops an unverified answer.
    raw: used.map((u) => u.text).join('\n'),
    tokens_in: used.reduce((s, u) => s + u.tokens_in, 0),
    tokens_out: used.reduce((s, u) => s + u.tokens_out, 0),
    neurons: used.reduce((s, u) => s + u.neurons, 0),
  }
}

function questions(): Question[] {
  const out = execFileSync('python', ['-c',
    'import json,sys,yaml;print(json.dumps(yaml.safe_load(open(sys.argv[1],encoding="utf-8"))["questions"]))',
    join(ROOT, 'configs', 'workers_ai', arg('questions') ?? 'eval_questions.yaml')], { encoding: 'utf-8' })
  return JSON.parse(out)
}

const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`)
  return at > 0 ? process.argv[at + 1] : undefined
}

async function run(model: string, maxNeurons: number, limit: number, label: string,
  options?: Record<string, unknown>, from = 0) {
  const calls: Usage[] = []
  const ai = shim(model, calls, options)
  mkdirSync(OUT, { recursive: true })
  const file = join(OUT, `${model.split('/').pop()}${label ? '-' + label : ''}.jsonl`)
  // --from resumes an interrupted run: earlier rows stay in the file.
  if (!from) writeFileSync(file, '')
  const start = spentToday()
  for (const [index, q] of questions().slice(0, limit).entries()) {
    if (index < from) continue
    const spent = calls.reduce((s, u) => s + u.neurons, 0)
    if (spent > maxNeurons || start + spent > 9500) {
      console.log(`Stopping: ${spent.toFixed(1)} neurons this run`)
      break
    }
    const result = await ask(ai, q.corpus, q.question, calls)
    const hit = (n: number) => result.retrieved.slice(0, n).some((id) => q.expected.includes(id))
    const row = {
      index,
      ...q,
      model,
      options: options ?? ANSWER_OPTIONS,
      status: result.status,
      hit_at_8: hit(K),
      hit_at_10: hit(10),
      retrieved: result.retrieved,
      answer: result.answer,
      raw: result.raw,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      neurons: result.neurons,
    }
    appendFileSync(file, JSON.stringify(row) + '\n')
    console.log(`${index + 1}. ${result.status} hit@8 ${row.hit_at_8} in ${row.tokens_in} out ${row.tokens_out}`)
  }
  const spent = calls.reduce((s, u) => s + u.neurons, 0)
  console.log(`${model}: ${calls.length} calls, ${spent.toFixed(1)} neurons`)
}

/** Build-time examples: chosen eval questions answered again, verified, with their vector. */
async function examples(model: string, picks: string[], options?: Record<string, unknown>) {
  const calls: Usage[] = []
  const ai = shim(model, calls, options)
  const all = questions()
  const out: Record<string, unknown[]> = {}
  for (const pick of picks) {
    const [name, n] = pick.split(':')
    const q = all[Number(n)]
    const english = name === 'ai-act-en'
    const question = english ? q.question_en : q.question
    const result = await ask(ai, name, question, calls)
    console.log(`${name} ${n}: ${result.status}`)
    if (result.status !== 'verified') continue
    ;(out[name] ??= []).push({
      question,
      question_en: q.question_en,
      vector: result.vector,
      passages: result.retrieved.slice(0, K),
      status: 'verified',
      answer: result.answer,
    })
  }
  const created = new Date().toISOString().slice(0, 19) + 'Z'
  for (const [name, list] of Object.entries(out))
    writeFileSync(
      join(DATA, 'workers-ai', name, 'examples.json'),
      JSON.stringify({ model, created, examples: list }) + '\n',
    )
  console.log(`${calls.reduce((s, u) => s + u.neurons, 0).toFixed(1)} neurons`)
}

const [command] = process.argv.slice(2)
const model = arg('model') ?? ANSWER_MODEL
const options = arg('options') ? JSON.parse(arg('options')!) : undefined
if (command === 'run')
  await run(model, Number(arg('max-neurons') ?? 1500), Number(arg('limit') ?? 1e9),
    arg('label') ?? '', options, Number(arg('from') ?? 0))
else if (command === 'examples') await examples(model, (arg('ids') ?? '').split(','), options)
else console.log('usage: run|examples --model <id>')
