/**
 * The Workers AI demos' data and endpoints: a corpus export (pca.json, vectors.bin, meta.json under
 * data/workers-ai/<corpus>/, docs/workers-ai.md) loaded once per page, and the Worker's
 * /api/embed and /api/answer. A failed call says why, so the page can fall back on its examples.
 */
import { fetchData } from '../dataSource'
import { l } from '../i18n'
import { knn, project, type Pca } from './search'

export type Meta<Item> = {
  corpus: string
  model: string
  created: string
  n: number
  dims: number
  recall_at_10?: number
  items: Item[]
} & Record<string, unknown>
export type Corpus<Item> = { pca: Pca; vectors: Int8Array; meta: Meta<Item> }

const dir = (corpus: string) => `workers-ai/${corpus}`
const loaded = new Map<string, Promise<Corpus<unknown>>>()

/** A large export lists its items and vectors as parts, in order, each its own file. */
type Part = { path: string; start: number; count: number }
const isParts = (list: unknown): list is Part[] =>
  Array.isArray(list) && typeof list[0]?.path === 'string'

export function loadCorpus<Item>(corpus: string): Promise<Corpus<Item>> {
  if (!loaded.has(corpus)) {
    const at = (file: string) => fetchData(`${dir(corpus)}/${file}`)
    const pending = Promise.all([
      at('pca.json').then((r) => r.json()),
      at('meta.json').then((r) => r.json()),
    ]).then(async ([pca, meta]) => {
      const [items, bins] = await Promise.all([
        isParts(meta.items)
          ? Promise.all(
              meta.items.map((p: Part) =>
                fetchData(p.path).then((r) => r.json()),
              ),
            ).then((parts) => parts.flat())
          : meta.items,
        Promise.all(
          isParts(meta.vectors)
            ? meta.vectors.map((p: Part) =>
                fetchData(p.path).then((r) => r.arrayBuffer()),
              )
            : [at('vectors.bin').then((r) => r.arrayBuffer())],
        ),
      ])
      const vectors = new Int8Array(bins.reduce((n, b) => n + b.byteLength, 0))
      let offset = 0
      for (const b of bins) {
        vectors.set(new Int8Array(b), offset)
        offset += b.byteLength
      }
      return { pca, vectors, meta: { ...meta, items } }
    })
    // A failed load may be retried on the next attempt.
    pending.catch(() => loaded.delete(corpus))
    loaded.set(corpus, pending)
  }
  return loaded.get(corpus) as Promise<Corpus<Item>>
}

/** The k passages nearest to a full bge-m3 vector, closest first. */
export function nearest<Item>(c: Corpus<Item>, vector: number[], k: number) {
  return knn(project(vector, c.pca), c.vectors, c.pca.scale, k).map((h) => ({
    item: c.meta.items[h.index],
    score: h.score,
  }))
}

/** Why the Worker gave no answer: the day's AI quota, a failed call, too many requests, or no Worker. */
export type Reason = 'quota' | 'error' | 'busy' | 'offline'
export class Unavailable extends Error {
  reason: Reason
  constructor(reason: Reason) {
    super(reason)
    this.reason = reason
  }
}

/**
 * One line that says why the Worker gave nothing; it points to the examples only when the page
 * has some.
 */
export const fallback = (reason: Reason, examples = true) =>
  ({
    quota: examples
      ? l(
          "Today's Workers AI allocation is used up, so only the examples work until midnight UTC.",
          'Dagens kvot hos Workers AI är slut, så bara exemplen fungerar fram till midnatt UTC.',
        )
      : l(
          "Today's Workers AI allocation is used up. Try again after midnight UTC.",
          'Dagens kvot hos Workers AI är slut. Försök igen efter midnatt UTC.',
        ),
    busy: l(
      'Too many requests in a short time. Wait a minute and try again.',
      'För många förfrågningar på kort tid. Vänta en minut och försök igen.',
    ),
    error: examples
      ? l(
          'The model did not answer, so only the examples work right now.',
          'Modellen svarade inte, så bara exemplen fungerar just nu.',
        )
      : l(
          'The model did not answer. Try again in a moment.',
          'Modellen svarade inte. Försök igen om en stund.',
        ),
    offline: examples
      ? l(
          'The AI service is not reachable here, so only the examples work.',
          'AI-tjänsten nås inte här, så bara exemplen fungerar.',
        )
      : l('The AI service is not reachable here.', 'AI-tjänsten nås inte här.'),
  })[reason]

async function call<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Unavailable('offline')
  }
  if (response.ok) return response.json()
  if (response.status === 503) {
    const { reason } = await response.json().catch(() => ({}))
    throw new Unavailable(reason === 'quota' ? 'quota' : 'error')
  }
  throw new Unavailable(
    response.status === 429
      ? 'busy'
      : response.status === 404
        ? 'offline'
        : 'error',
  )
}

export const embed = (text: string) =>
  call<{ vector: number[] }>('embed', { text }).then((r) => r.vector)

export type Passage = { id: string; text: string }
export type Answer =
  | {
      status: 'verified'
      answer: string
      quotes: { id: string; quote: string }[]
      model: string
    }
  | { status: 'unverified' | 'no_answer'; passages: Passage[] }

export const answer = (question: string, corpus: string, passages: Passage[]) =>
  call<Answer>('answer', { question, corpus, passages })
