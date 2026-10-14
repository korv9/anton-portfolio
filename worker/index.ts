/**
 * The site's Worker: static assets as before, plus two endpoints on Workers AI (docs/workers-ai.md).
 * POST /api/embed embeds a visitor's sentence with bge-m3; POST /api/answer answers a question
 * from passages the browser found, after checking that every passage is verbatim published law
 * text and that every quote in the answer is verbatim in its passage. Visitor text is never logged
 * or stored. All vector search happens in the browser.
 */

export type Env = {
  AI: { run: (model: string, input: unknown) => Promise<unknown> }
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  RATE_LIMITER?: {
    limit: (o: { key: string }) => Promise<{ success: boolean }>
  }
}

export const EMBED_MODEL = '@cf/baai/bge-m3'
export const ANSWER_MODEL = '@cf/google/gemma-4-26b-a4b-it'
export const MAX_TEXT = 500
export const MAX_PASSAGES = 8
const MAX_PASSAGE = 4000
const CORPORA = ['sfs', 'ai-act-sv', 'ai-act-en']

// Python's str.isspace() set, so the folding matches platform/legal/parse.py exactly.
const SPACE =
  /[\t-\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g

/** platform/legal/parse.py text_hash() folding: NFKC, one kind of space, straight quotes. */
export function fold(text: string) {
  const normal = text
    .normalize('NFKC')
    .replaceAll('\u00a0', ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ ([,.;:)])/g, '$1')
    .trim()
  return normal
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(SPACE, ' ')
    .trim()
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** The same hex digest as platform/legal/parse.py text_hash(). */
export const textHash = (text: string) => sha256(fold(text))

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })

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

async function body(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text()
  if (raw.length > 64_000) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

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

type Passage = { id: string; text: string }

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

export const SYSTEM = [
  'You answer questions about law using only the numbered passages you are given.',
  'Answer in the language of the question, in at most five sentences.',
  'Support every claim with a verbatim quote from a passage, written as [[id]]"quote", where id is the passage id and the quote is copied character for character from that passage.',
  'Never quote anything that is not in the passage with that id, and never use outside knowledge.',
  'If the passages do not answer the question, reply with exactly NO_ANSWER and nothing else.',
].join(' ')

const QUOTE = /\[\[([^\]]+)\]\]\s*"([^"]+)"/g

/** Every quote in the answer, and whether each is verbatim in the passage it names. */
export function checkQuotes(answer: string, passages: Passage[]) {
  const texts = new Map(passages.map((p) => [p.id, fold(p.text)]))
  return [...fold(answer).matchAll(QUOTE)].map(([, id, quote]) => ({
    id,
    quote,
    verbatim: texts.get(id)?.includes(fold(quote)) ?? false,
  }))
}

async function answer(request: Request, env: Env) {
  const input = await body(request)
  const question = sentence(input?.question)
  const corpus = String(input?.corpus)
  const passages = input?.passages
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
  if (!(await published(request, env, corpus, found)))
    return json({ error: 'passages must be published text' }, 400)

  let text: string
  let usage: unknown
  try {
    const out = (await env.AI.run(ANSWER_MODEL, {
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `${found.map((p) => `[[${p.id}]]\n${p.text}`).join('\n\n')}\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 700,
      temperature: 0.1,
    })) as {
      response?: string
      choices?: { message?: { content?: string } }[]
      usage?: unknown
    }
    text = (out.response ?? out.choices?.[0]?.message?.content ?? '').trim()
    usage = out.usage
  } catch (error) {
    return unavailable(error)
  }
  if (text === 'NO_ANSWER')
    return json({ status: 'no_answer', passages: found })
  const quotes = checkQuotes(text, found)
  // Generated in full, then checked: an answer with a quote that is not in its source is dropped.
  if (!quotes.length || !quotes.every((q) => q.verbatim))
    return json({ status: 'unverified', passages: found })
  return json({
    status: 'verified',
    answer: fold(text),
    quotes: quotes.map(({ id, quote }) => ({ id, quote })),
    model: ANSWER_MODEL,
    usage,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    const route = { '/api/embed': embed, '/api/answer': answer }[pathname]
    if (!route) return json({ error: 'not found' }, 404)
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (env.RATE_LIMITER) {
      const key = request.headers.get('CF-Connecting-IP') ?? 'anonymous'
      if (!(await env.RATE_LIMITER.limit({ key })).success)
        return json({ error: 'too many requests' }, 429)
    }
    return route(request, env)
  },
}
