/**
 * Allegora's live path measured (docs/products/allegora/allegora-gcp.md): the Swedish eval questions
 * (configs/workers_ai/eval_questions.yaml, corpus sfs) and two reference questions asked through
 * worker/index.ts itself with corpus 'sfs-all', against the real search service and Claude.
 *
 *   ALLEGORA_SEARCH_KEY=... node --experimental-strip-types platform/publish/allegora/eval_live.ts \
 *     --label baseline [--limit 1]
 *
 * The search key comes from the environment (Secret Manager), ANTHROPIC_API_KEY from .env; neither
 * is printed. fetch is wrapped to time each step: the search, the answer, the fable; the quote
 * check is the gap between them. Recall@8 counts a question as found when one of the eight
 * passages is the expected paragraph or one of its stycken. One JSON line per question, with the
 * tokens of every Claude call, goes to warehouse/features/workers_ai/eval/sfs-all-<label>.jsonl.
 * ALLEGORA_SEARCH_URL points it at another search service, such as one run locally.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import worker, { type Env } from '../../../worker/index.ts'
import type { Kv } from '../../../worker/quota.ts'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const OUT = join(ROOT, 'warehouse', 'features', 'workers_ai', 'eval')
export const URL_SEARCH =
  process.env.ALLEGORA_SEARCH_URL ?? 'https://allegora-search-877662270161.europe-west4.run.app'

export type Question = { question: string; expected: string[] }
/** The two questions measured on antonernstsson.com on 2026-11-07 and 2026-11-03. */
const REFERENCE: Question[] = [
  {
    question: 'Får min hyresvärd gå in i min lägenhet när jag inte är hemma?',
    expected: ['sfs-1970-994-12-26'],
  },
  { question: 'Får min hyresvärd höja hyran hur som helst?', expected: [] },
]

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

export function dotenv(): Record<string, string> {
  const file = join(ROOT, '.env')
  const out: Record<string, string> = {}
  for (const line of existsSync(file) ? readFileSync(file, 'utf-8').split(/\r?\n/) : []) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

export function questions(): Question[] {
  // python reads the YAML and prints it as ASCII JSON, so the console's code page cannot change
  // å, ä and ö on the way.
  const text = execFileSync('python', ['-c', [
    'import json,sys,yaml',
    'q=yaml.safe_load(open(sys.argv[1],encoding="utf-8"))["questions"]',
    'print(json.dumps([x for x in q if x["corpus"]=="sfs"]))',
  ].join(';'), join(ROOT, 'configs', 'workers_ai', 'eval_questions.yaml')], { encoding: 'utf-8' })
  return [...JSON.parse(text), ...REFERENCE]
}

/** The paragraph a passage belongs to: its id without the stycke number when it is one stycke. */
export const paragraphOf = (hit: { id: string; title: string }) =>
  /, \S+ stycket$/.test(hit.title) ? hit.id.replace(/-\d+$/, '') : hit.id

/** A count that never fills: the daily allowance is the site's, not the eval's. */
export const unlimited: Kv = { get: async () => null, put: async () => {} }

type Step = { name: string; start: number; end: number; usage?: Record<string, number> }

async function main() {
  const label = arg('label') ?? 'run'
  const limit = Number(arg('limit') ?? Infinity)
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

  let steps: Step[] = []
  const real = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    const name = url.startsWith(URL_SEARCH) ? 'search' : url.includes('anthropic.com') ? 'claude' : 'other'
    const step: Step = { name, start: performance.now(), end: 0 }
    steps.push(step)
    const response = await real(input, init)
    if (name === 'claude') step.usage = (await response.clone().json()).usage
    step.end = performance.now()
    return response
  }

  mkdirSync(OUT, { recursive: true })
  const rows: unknown[] = []
  for (const [n, q] of questions().slice(0, limit).entries()) {
    steps = []
    const t0 = performance.now()
    const response = await worker.fetch(
      new Request('https://antonernstsson.com/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.question, corpus: 'sfs-all', passages: [] }),
      }),
      env,
    )
    const total = performance.now() - t0
    const body = (await response.json()) as {
      status?: string
      hits?: { id: string; title: string; law: string; score: number }[]
      allegory?: string
    }
    const hits = body.hits ?? []
    const kinds = hits.map((h) => (/förordning/i.test(h.title.split('(')[0]) ? 'förordning' : 'lag'))
    const [search] = steps.filter((s) => s.name === 'search')
    const [answer, fable] = steps.filter((s) => s.name === 'claude')
    const ms = (a?: number, b?: number) => (a != null && b != null ? Math.round(b - a) : null)
    const row = {
      n,
      question: q.question,
      expected: q.expected,
      status: body.status ?? response.status,
      found: q.expected.length
        ? hits.some((h) => q.expected.some((e) => paragraphOf(h) === e || h.id === e))
        : null,
      laws: new Set(hits.map((h) => h.law)).size,
      ordinances: kinds.filter((k) => k === 'förordning').length,
      paragraphs: new Set(hits.map(paragraphOf)).size,
      ms: {
        total: Math.round(total),
        search: ms(search?.start, search?.end),
        answer: ms(answer?.start, answer?.end),
        check: ms(answer?.end, fable?.start),
        fable: ms(fable?.start, fable?.end),
      },
      claude: [answer, fable].filter(Boolean).map((s) => s!.usage),
      fable_sentences: body.allegory
        ? body.allegory.split('\n')[0].split(/(?<=[.!?])\s+/).filter(Boolean).length
        : null,
      hits: hits.map((h) => ({ id: h.id, paragraph: paragraphOf(h), law: h.law, title: h.title, score: h.score })),
    }
    rows.push(row)
    console.log(n, row.status, row.found, JSON.stringify(row.ms))
  }
  const file = join(OUT, `sfs-all-${label}.jsonl`)
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8')
  console.log(`wrote ${rows.length} rows to ${file}`)
}

if (process.argv[1]?.endsWith('eval_live.ts')) main()
