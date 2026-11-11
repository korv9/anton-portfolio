/**
 * The site's Worker: static assets as before, plus two endpoints on Workers AI
 * (docs/products/allegora/workers-ai.md). POST /api/embed embeds a visitor's sentence with bge-m3; POST /api/answer
 * answers a question from passages the browser found, after checking that every passage is
 * verbatim published law text and that every quote in the answer is verbatim in its passage.
 * Visitor text is never logged or stored. Vector search happens in the browser, except for corpus
 * 'sfs-all', every Swedish law and ordinance in force: there the Worker asks Allegora's search
 * service on Cloud Run (platform/publish/allegora/search_service.py) for the passages, so they
 * need no check. With ANTHROPIC_API_KEY the answers come from Claude (claude.ts) instead of Gemma.
 * /api/jobs/* is the job assistant's owner records (worker/jobs.ts): public reads, token-protected
 * writes and CV files.
 */
import { ask, search, warm } from './ask.ts'
import { claude } from './claude.ts'
import { jobs, readJson, reply, type JobsEnv } from './jobs.ts'
import { take, type Kv } from './quota.ts'
import {
  ALLEGORY_SYSTEM,
  canonical,
  checkQuotes,
  sha256,
  SYSTEM,
  textHash,
  told,
  type Passage,
} from './quotes.ts'

export type Env = JobsEnv & {
  AI: { run: (model: string, input: unknown) => Promise<unknown> }
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  RATE_LIMITER?: {
    limit: (o: { key: string }) => Promise<{ success: boolean }>
  }
  /** wrangler.toml var and Cloudflare secret: the search service and the key it checks. */
  ALLEGORA_SEARCH_URL?: string
  ALLEGORA_SEARCH_KEY?: string
  /** Cloudflare secret: with it the answer and its fable come from Claude (claude.ts). */
  ANTHROPIC_API_KEY?: string
  /** Workers KV: Allegora's daily question counts (quota.ts). */
  QUOTA?: Kv
}

export const EMBED_MODEL = '@cf/baai/bge-m3'
export const ANSWER_MODEL = '@cf/google/gemma-4-26b-a4b-it'
/** The answer model's reasoning setting (docs/products/allegora/workers-ai.md): tokens here are the cost per answer. */
export const ANSWER_OPTIONS: Record<string, unknown> = {
  chat_template_kwargs: { enable_thinking: false },
}
export const MAX_TEXT = 500
export const MAX_PASSAGES = 8
export const MAX_PASSAGE = 5000
const CORPORA = ['sfs', 'ai-act-sv', 'ai-act-en', 'sfs-all']

const json = reply

/** An AI call that failed: the daily neuron allocation is spent, or something else broke. */
const unavailable = (error: unknown) =>
  json(
    {
      reason: /neuron|allocation|quota|4006/i.test(String(error))
        ? 'quota'
        : 'error',
    },
    503,
  )

const body = (request: Request) => readJson(request, 192_000)

const sentence = (value: unknown) =>
  typeof value === 'string' && value.trim() && value.length <= MAX_TEXT
    ? value.trim()
    : null

async function embed(request: Request, env: Env) {
  const text = sentence((await body(request))?.text)
  if (!text) return json({ error: `text: 1 to ${MAX_TEXT} characters` }, 400)
  try {
    const out = (await env.AI.run(EMBED_MODEL, { text: [text] })) as {
      data: number[][]
    }
    return json({ vector: out.data[0] })
  } catch (error) {
    return unavailable(error)
  }
}

/** Every passage must be one of the corpus's published passages, word for word. */
async function published(
  request: Request,
  env: Env,
  corpus: string,
  passages: Passage[],
) {
  const shards = new Map<string, Promise<Record<string, string> | null>>()
  const listOf = (shard: string) => {
    if (!shards.has(shard)) {
      const url = new URL(
        `/data/workers-ai/${corpus}/verify/${shard}.json`,
        request.url,
      )
      shards.set(
        shard,
        env.ASSETS.fetch(new Request(url)).then((r) =>
          r.ok ? r.json() : null,
        ),
      )
    }
    return shards.get(shard)!
  }
  const checks = await Promise.all(
    passages.map(async (p) => {
      const list = await listOf((await sha256(p.id)).slice(0, 2))
      return list?.[p.id] != null && list[p.id] === (await textHash(p.text))
    }),
  )
  return checks.every(Boolean)
}

async function answer(request: Request, env: Env) {
  const input = await body(request)
  const question = sentence(input?.question)
  const corpus = String(input?.corpus)
  if (corpus === 'sfs-all' && question) {
    // Every law in force is searched on Google Cloud and answered by Claude: a daily allowance.
    if (!env.QUOTA) return json({ error: 'quota is not configured' }, 503)
    const ip = request.headers.get('CF-Connecting-IP') ?? 'anonymous'
    const taken = await take(env.QUOTA, ip)
    if (!taken.ok) return json({ reason: taken.reason }, 429)
  }
  const hits =
    corpus === 'sfs-all' && question ? await search(env, question) : undefined
  if (hits === null) return json({ reason: 'error' }, 503)
  const passages = hits ?? input?.passages
  if (
    !question ||
    !CORPORA.includes(corpus) ||
    !Array.isArray(passages) ||
    !passages.length ||
    passages.length > MAX_PASSAGES ||
    !passages.every(
      (p) =>
        typeof p?.id === 'string' &&
        typeof p?.text === 'string' &&
        p.text.length <= MAX_PASSAGE,
    )
  )
    return json({ error: 'question, corpus and passages [{id, text}]' }, 400)
  const found = (passages as Passage[]).map(({ id, text }) => ({ id, text }))
  if (!hits && !(await published(request, env, corpus, found)))
    return json({ error: 'passages must be published text' }, 400)

  let text: string
  let usage: unknown
  let model: string
  try {
    ;({ text, usage, model } = await generate(
      env,
      SYSTEM,
      `${found.map((p) => `[[${p.id}]]\n${p.text}`).join('\n\n')}\n\nQuestion: ${question}`,
      { maxTokens: 2048, temperature: 0.1 },
    ))
  } catch (error) {
    return unavailable(error)
  }
  const quotes = checkQuotes(text, found)
  // A refusal, or an answer that quotes nothing, has nothing to check.
  if (/^NO_ANSWER\W*$/.test(text) || !quotes.length)
    return json({ status: 'no_answer', passages: found, hits })
  // Generated in full, then checked: an answer with a quote that is not in its source is dropped.
  if (!quotes.every((q) => q.verbatim))
    return json({ status: 'unverified', passages: found, hits })
  const checked = canonical(text)
  const allegory = await retell(env, question, checked)
  return json({
    status: 'verified',
    ...(allegory && { allegory }),
    answer: checked,
    quotes: quotes.map(({ id, quote }) => ({ id, quote })),
    model,
    usage,
    hits,
  })
}

/**
 * One generation: Claude when the Worker has its key, otherwise Gemma on Workers AI. Claude
 * takes no temperature.
 */
async function generate(
  env: Env,
  system: string,
  user: string,
  { maxTokens, temperature }: { maxTokens: number; temperature: number },
) {
  if (env.ANTHROPIC_API_KEY)
    return claude(env.ANTHROPIC_API_KEY, system, user, maxTokens)
  const out = (await env.AI.run(ANSWER_MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature,
    ...ANSWER_OPTIONS,
  })) as {
    response?: string
    choices?: { message?: { content?: string } }[]
    usage?: unknown
  }
  const text = (out.response ?? out.choices?.[0]?.message?.content ?? '').trim()
  return { text, usage: out.usage, model: ANSWER_MODEL }
}

/**
 * The checked answer, quotes kept as plain text, retold as a moral allegory. It is told from the
 * checked answer only, never from the passages; a failed or citing retelling leaves the answer.
 */
async function retell(env: Env, question: string, checked: string) {
  try {
    const { text: story } = await generate(
      env,
      ALLEGORY_SYSTEM,
      `Question: ${question}

Checked answer: ${told(checked)}`,
      { maxTokens: 600, temperature: 0.7 },
    )
    return story && !story.includes('[[') ? story : null
  } catch {
    return null
  }
}

/**
 * Static files, with the app shell for page addresses that are not files (wrangler.toml sets
 * not_found_handling = "none", so every miss reaches here). A missing file, anything under
 * /data/ or a last segment with an extension, answers 404 instead of index.html with 200.
 */
async function asset(request: Request, env: Env, pathname: string) {
  const found = await env.ASSETS.fetch(request)
  if (found.status !== 404) return found
  if (pathname.startsWith('/data/') || /\.[^/]*$/.test(pathname)) return found
  return env.ASSETS.fetch(new Request(new URL('/', request.url), request))
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/api/')) return asset(request, env, pathname)
    if (pathname.startsWith('/api/jobs/')) {
      // Owner records are never served unlimited; reads and writes count separately so public
      // reads cannot use up the owner's write budget.
      if (!env.RATE_LIMITER)
        return json({ error: 'rate limiter is not configured' }, 503)
      const ip = request.headers.get('CF-Connecting-IP') ?? 'anonymous'
      const key = `jobs-${request.method === 'GET' ? 'read' : 'write'}:${ip}`
      if (!(await env.RATE_LIMITER.limit({ key })).success)
        return json({ error: 'too many requests' }, 429)
      return jobs(request, env)
    }
    const route = {
      '/api/embed': embed,
      '/api/answer': answer,
      '/api/ask': ask,
      '/api/warm': warm,
    }[pathname]
    if (!route) return json({ error: 'not found' }, 404)
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
    // As for job writes: the site's own origin, or no browser at all.
    const origin = request.headers.get('Origin')
    if (origin && origin !== new URL(request.url).origin)
      return json({ error: 'forbidden origin' }, 403)
    // Workers AI spends the account's neurons, so it is never served unlimited.
    if (!env.RATE_LIMITER)
      return json({ error: 'rate limiter is not configured' }, 503)
    const key = request.headers.get('CF-Connecting-IP') ?? 'anonymous'
    if (!(await env.RATE_LIMITER.limit({ key })).success)
      return json({ error: 'too many requests' }, 429)
    return route(request, env)
  },
}
