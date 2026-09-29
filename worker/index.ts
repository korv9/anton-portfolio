/**
 * The site's Worker. Static files are served as before (env.ASSETS); only /api/* reaches this
 * code (run_worker_first in wrangler.toml).
 *
 *   POST /api/tallman/ask       { question }  → Answer (engine/types.ts)
 *   GET  /api/tallman/status                  → which parts are connected
 *   POST /api/tallman/reindex?part=…&from=…   → embed passages into Vectorize (admin token)
 *
 * Everything optional degrades: without an LLM key the extractor makes the claims, without
 * Vectorize the lexical retriever finds the passages. Allegoria always checks.
 */
import { ask } from '../frontend/src/tallman/engine/pipeline.ts'
import {
  LexicalRetriever,
  fetchShards,
  type Retriever,
} from '../frontend/src/tallman/engine/retrieve.ts'
import type {
  Annotation,
  TallmanIndex,
} from '../frontend/src/tallman/engine/types.ts'
import { DEFAULT_MODEL, anthropicModel } from './llm.ts'
import {
  HybridRetriever,
  VectorRetriever,
  allDatapointPassages,
  debatePassages,
  upsertPassages,
  type Embedder,
} from './vector.ts'

export interface Env {
  ASSETS: Fetcher
  /** Where debate shards are served; the R2 public URL. */
  SHARD_BASE?: string
  /** Secret: the Anthropic API key. LLM_API_KEY is accepted as an alias. */
  ANTHROPIC_API_KEY?: string
  LLM_API_KEY?: string
  LLM_MODEL?: string
  LLM_EFFORT?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  /** Workers AI and Vectorize, when bound in wrangler.toml. */
  AI?: Embedder
  VECTORS?: Vectorize
  /** Secret: bearer token for /api/tallman/reindex. */
  ADMIN_TOKEN?: string
  /** A Workers rate-limit binding, when bound. */
  ASK_LIMITER?: RateLimit
}

const MAX_QUESTION = 500

let cached: Promise<{ index: TallmanIndex; annotations: Annotation[] }> | null =
  null

function loadData(env: Env, origin: string) {
  if (!cached)
    cached = Promise.all([
      env.ASSETS.fetch(`${origin}/data/tallman/index.json`).then((r) => {
        if (!r.ok) throw new Error(`index: ${r.status}`)
        return r.json() as Promise<TallmanIndex>
      }),
      env.ASSETS.fetch(`${origin}/data/tallman/annotations.json`)
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ annotations: Annotation[] }>)
            : { annotations: [] },
        )
        .then((a) =>
          a.annotations.filter((x) => x.reviewed_by && x.reviewed_at),
        ),
    ])
      .then(([index, annotations]) => ({ index, annotations }))
      .catch((error) => {
        cached = null
        throw error
      })
  return cached
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

// A key pasted into the dashboard often brings a space or a line break along.
const apiKey = (env: Env) =>
  (env.ANTHROPIC_API_KEY || env.LLM_API_KEY || '').trim() || undefined

function retrieverFor(env: Env, index: TallmanIndex): Retriever {
  const lexical = new LexicalRetriever(
    index,
    fetchShards(
      env.SHARD_BASE ?? 'https://pub-9867b18896ba49e4a0b4a3d2f39c0385.r2.dev/',
    ),
  )
  if (!env.AI || !env.VECTORS) return lexical
  return new HybridRetriever([
    lexical,
    new VectorRetriever(env.AI, env.VECTORS),
  ])
}

async function handleAsk(request: Request, env: Env, origin: string) {
  if (env.ASK_LIMITER) {
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const { success } = await env.ASK_LIMITER.limit({ key: ip })
    if (!success)
      return json({ error: 'För många frågor just nu. Vänta en stund.' }, 429)
  }
  const body = (await request.json().catch(() => ({}))) as {
    question?: unknown
  }
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question || question.length > MAX_QUESTION)
    return json({ error: `Frågan ska vara 1–${MAX_QUESTION} tecken.` }, 400)
  const { index, annotations } = await loadData(env, origin)
  const key = apiKey(env)
  const answer = await ask(question, {
    retriever: retrieverFor(env, index),
    model: key
      ? anthropicModel({
          apiKey: key,
          model: env.LLM_MODEL,
          effort: env.LLM_EFFORT,
        })
      : null,
    annotations,
    dataVersion: `index ${index.generated_at}`,
  })
  return json(answer)
}

/**
 * Embeds one slice of the corpus per call, so no call runs into the Worker's time limit:
 * part=datapoints embeds all facts; part=debates embeds `count` debates from `from`.
 * scripts/tallman-reindex.mjs calls it until `next` is null.
 */
async function handleReindex(
  request: Request,
  env: Env,
  origin: string,
  url: URL,
) {
  if (
    !env.ADMIN_TOKEN ||
    request.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`
  )
    return json({ error: 'unauthorized' }, 401)
  if (!env.AI || !env.VECTORS)
    return json({ error: 'AI and VECTORS are not bound' }, 400)
  const { index } = await loadData(env, origin)
  if (url.searchParams.get('part') === 'datapoints') {
    const count = await upsertPassages(
      env.AI,
      env.VECTORS,
      allDatapointPassages(index),
    )
    return json({ part: 'datapoints', upserted: count, next: 'debates:0' })
  }
  const from = Number(url.searchParams.get('from') ?? 0)
  const count = Math.min(Number(url.searchParams.get('count') ?? 5), 20)
  const debates = index.debates.slice(from, from + count)
  const load = fetchShards(
    env.SHARD_BASE ?? 'https://pub-9867b18896ba49e4a0b4a3d2f39c0385.r2.dev/',
  )
  let upserted = 0
  for (const debate of debates) {
    const passages = debatePassages(debate, await load(debate.path))
    upserted += await upsertPassages(env.AI, env.VECTORS, passages)
  }
  const next =
    from + count < index.debates.length ? `debates:${from + count}` : null
  return json({
    part: 'debates',
    from,
    debates: debates.length,
    upserted,
    next,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    try {
      if (url.pathname === '/api/tallman/ask' && request.method === 'POST')
        return await handleAsk(request, env, url.origin)
      if (url.pathname === '/api/tallman/status')
        return json({
          llm: Boolean(apiKey(env)),
          model: apiKey(env) ? env.LLM_MODEL || DEFAULT_MODEL : null,
          vectors: Boolean(env.AI && env.VECTORS),
        })
      if (url.pathname === '/api/tallman/reindex' && request.method === 'POST')
        return await handleReindex(request, env, url.origin, url)
      if (url.pathname.startsWith('/api/'))
        return json({ error: 'not found' }, 404)
    } catch (error) {
      return json({ error: (error as Error).message }, 500)
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
