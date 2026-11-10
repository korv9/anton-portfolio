/**
 * Allegora's streamed answer (docs/allegora-gcp.md): POST /api/ask {question, history?} searches
 * every law in force (Allegora's search service on Cloud Run) and answers as server-sent events,
 * in this order:
 *
 *   hits    {query, hits}        the paragraphs found, before any answer is written
 *   delta   {text}               the answer as Claude writes it: a draft, not yet checked
 *   result  {status, ...}        verified {answer, quotes, model, usage}, unverified or no_answer
 *   fable   {allegory, usage}    after a verified answer only, told from the checked answer
 *   error   {reason}             a failure after the stream began
 *   done    {}
 *
 * Failures before the stream (input 400, allowance 429, configuration or search 503) answer JSON
 * like /api/answer. When no paragraph scores MIN_SCORE the result is no_answer and Claude is not
 * called. history is the thread's last two turns: the search query is the previous question and
 * this one together, and the answer prompt shows them as context; quotes still come only from
 * this turn's passages, and the check is the one /api/answer uses (quotes.ts). Visitor text is
 * never logged: the log lines hold token counts and milliseconds.
 */
import { claude, claudeStream } from './claude.ts'
import { readJson, reply } from './jobs.ts'
import { take } from './quota.ts'
import {
  ALLEGORY_SYSTEM,
  canonical,
  checkQuotes,
  SYSTEM,
  told,
  type Passage,
} from './quotes.ts'
import type { Env } from './index.ts'

export type Hit = Passage & {
  title: string
  url: string
  law: string
  kind?: string
  score: number
}

const K = 8
const MAX_TEXT = 500
const MAX_ANSWER = 1500
const TURNS = 2
const DRAFT = 48
/**
 * The best cosine a question must reach. On 2026-11-07 the twelve law questions reached 0.805 to
 * 0.884 and six questions about something else 0.636 to 0.684
 * (warehouse/features/workers_ai/eval/sfs-all-search.json); this sits between them.
 */
export const MIN_SCORE = 0.74

/** The eight paragraphs nearest the question among all laws in force, or null when the service fails. */
export async function search(
  env: Env,
  question: string,
): Promise<Hit[] | null> {
  if (!env.ALLEGORA_SEARCH_URL || !env.ALLEGORA_SEARCH_KEY) return null
  try {
    const response = await fetch(`${env.ALLEGORA_SEARCH_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Allegora-Key': env.ALLEGORA_SEARCH_KEY,
      },
      body: JSON.stringify({ question, k: K }),
    })
    if (!response.ok) return null
    const { hits } = (await response.json()) as { hits: Hit[] }
    return hits.map(({ id, title, url, text, law, kind, score }) => ({
      id,
      title,
      url,
      text,
      law,
      kind,
      score,
    }))
  } catch {
    return null
  }
}

/** Wakes the search service, which scales to zero, so its start is over before the question comes. */
export async function warm(_request: Request, env: Env): Promise<Response> {
  if (env.ALLEGORA_SEARCH_URL)
    await fetch(`${env.ALLEGORA_SEARCH_URL}/health`).catch(() => null)
  return new Response(null, { status: 204 })
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() && value.length <= max
    ? value.trim()
    : null

type Turn = { question: string; answer: string }

/** The last TURNS turns that are well formed; anything else in history is ignored. */
function thread(value: unknown): Turn[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(-TURNS)
    .map((t) => ({
      question: text(t?.question, MAX_TEXT),
      answer: text(t?.answer, MAX_ANSWER),
    }))
    .filter((t): t is Turn => t.question != null && t.answer != null)
}

const prompt = (passages: Passage[], question: string, turns: Turn[]) =>
  [
    passages.map((p) => `[[${p.id}]]\n${p.text}`).join('\n\n'),
    ...(turns.length
      ? [
          'Earlier in this conversation, to understand the question only (quote nothing from it):',
          ...turns.map(
            (t) => `Question: ${t.question}\nAnswer: ${told(t.answer)}`,
          ),
        ]
      : []),
    `Question: ${question}`,
  ].join('\n\n')

export async function ask(request: Request, env: Env): Promise<Response> {
  const input = await readJson(request, 16_000)
  const question = text(input?.question, MAX_TEXT)
  if (!question)
    return reply({ error: `question: 1 to ${MAX_TEXT} characters` }, 400)
  if (!env.QUOTA || !env.ANTHROPIC_API_KEY)
    return reply({ error: 'Allegora is not configured' }, 503)
  const ip = request.headers.get('CF-Connecting-IP') ?? 'anonymous'
  const taken = await take(env.QUOTA, ip)
  if (!taken.ok) return reply({ reason: taken.reason }, 429)
  const turns = thread(input?.history)
  const query = turns.length
    ? `${turns.at(-1)!.question} ${question}`.slice(0, MAX_TEXT)
    : question
  const hits = await search(env, query)
  if (hits === null) return reply({ reason: 'error' }, 503)

  const { readable, writable } = new TransformStream<Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const send = (event: string, data: unknown) =>
    writer.write(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
    )
  const key = env.ANTHROPIC_API_KEY
  const run = async () => {
    await send('hits', { query, hits })
    if (!hits.length || hits[0].score < MIN_SCORE) {
      await send('result', { status: 'no_answer', reason: 'threshold' })
      return
    }
    const found = hits.map(({ id, text }) => ({ id, text }))
    const started = Date.now()
    const stream = claudeStream(
      key,
      SYSTEM,
      prompt(found, question, turns),
      2048,
    )
    // The draft goes out in pieces of DRAFT characters or more: fewer events, less CPU.
    let written = ''
    let shown = 0
    let next = await stream.next()
    while (!next.done) {
      written += next.value
      if (written.length - shown >= DRAFT) {
        await send('delta', { text: written.slice(shown) })
        shown = written.length
      }
      next = await stream.next()
    }
    if (written.length > shown)
      await send('delta', { text: written.slice(shown) })
    const { model, usage } = next.value
    console.log(
      JSON.stringify({
        allegora: 'answer',
        ms: Date.now() - started,
        ...usage,
      }),
    )
    const answer = written.trim()
    const quotes = checkQuotes(answer, found)
    if (/^NO_ANSWER\W*$/.test(answer) || !quotes.length) {
      await send('result', { status: 'no_answer', usage })
      return
    }
    if (!quotes.every((q) => q.verbatim)) {
      await send('result', { status: 'unverified', usage })
      return
    }
    const checked = canonical(answer)
    await send('result', {
      status: 'verified',
      answer: checked,
      quotes: quotes.map(({ id, quote }) => ({ id, quote })),
      model,
      usage,
    })
    const fabled = Date.now()
    try {
      const fable = await claude(
        key,
        ALLEGORY_SYSTEM,
        `Question: ${question}\n\nChecked answer: ${told(checked)}`,
        600,
      )
      console.log(
        JSON.stringify({
          allegora: 'fable',
          ms: Date.now() - fabled,
          ...fable.usage,
        }),
      )
      const allegory =
        fable.text && !fable.text.includes('[[') ? fable.text : null
      await send('fable', { allegory, usage: fable.usage })
    } catch {
      await send('fable', { allegory: null })
    }
  }
  run()
    .catch(() => send('error', { reason: 'error' }))
    .finally(() => send('done', {}).then(() => writer.close()))
    .catch(() => {})
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
