/**
 * How the page gets an answer. The Worker (/api/tallman/ask) is asked first: it holds the LLM
 * key and the vector index. Where it is not running (vite dev, a static preview) or fails, the
 * same engine runs here in the browser, lexical and without a model, so the page always works
 * and the labels are always Allegoria's.
 */
import { fetchData, resolveDataUrl } from '../dataSource'
import { ask } from './engine/pipeline.ts'
import { LexicalRetriever } from './engine/retrieve.ts'
import type {
  Annotation,
  Answer,
  Speech,
  TallmanIndex,
} from './engine/types.ts'

export type Status = {
  via: 'worker' | 'browser'
  llm: boolean
  model: string | null
  vectors: boolean
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(path, init)
    const type = response.headers.get('content-type') ?? ''
    // The static host answers unknown paths with the page itself; that is not the API.
    if (!type.includes('application/json')) return null
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
    return body as T
  } catch (error) {
    if (error instanceof TypeError) return null
    throw error
  }
}

export async function status(): Promise<Status> {
  const s = await apiJson<Omit<Status, 'via'>>('api/tallman/status').catch(
    () => null,
  )
  return s
    ? { via: 'worker', ...s }
    : { via: 'browser', llm: false, model: null, vectors: false }
}

let local: Promise<{
  retriever: LexicalRetriever
  annotations: Annotation[]
  version: string
}> | null = null

function localEngine() {
  if (!local)
    local = Promise.all([
      fetchData('tallman/index.json').then((r) => {
        if (!r.ok) throw new Error('Sökindexet kunde inte läsas.')
        return r.json() as Promise<TallmanIndex>
      }),
      fetchData('tallman/annotations.json')
        .then((r) => (r.ok ? r.json() : { annotations: [] }))
        .then((a: { annotations: Annotation[] }) =>
          a.annotations.filter((x) => x.reviewed_by && x.reviewed_at),
        )
        .catch(() => [] as Annotation[]),
    ])
      .then(([index, annotations]) => {
        const shards = new Map<string, Promise<Speech[]>>()
        const load = (path: string) => {
          if (!shards.has(path))
            shards.set(
              path,
              resolveDataUrl(path)
                .then((url) => fetch(url))
                .then((r) => (r.ok ? r.json() : { data: [] }))
                .then((s: { data?: Speech[] }) => s.data ?? []),
            )
          return shards.get(path)!
        }
        return {
          retriever: new LexicalRetriever(index, load),
          annotations,
          version: `index ${index.generated_at}`,
        }
      })
      .catch((error) => {
        local = null
        throw error
      })
  return local
}

export async function askQuestion(
  question: string,
  via: Status['via'],
): Promise<Answer> {
  if (via === 'worker') {
    const answer = await apiJson<Answer>('api/tallman/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    if (answer) return answer
  }
  const engine = await localEngine()
  return ask(question, {
    retriever: engine.retriever,
    annotations: engine.annotations,
    dataVersion: engine.version,
  })
}
