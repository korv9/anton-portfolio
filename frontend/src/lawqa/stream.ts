/**
 * Allegora's streamed answer (worker/ask.ts): POST /api/ask, read as server-sent events. A failure
 * before the stream throws Unavailable as the other endpoints do; an error event inside the stream
 * reaches the handler like any other event.
 */
import { refuse, Unavailable, type Found } from '../workersAi/corpus'
import type { Turn } from './Thread'

type Checked = {
  status: 'verified'
  answer: string
  quotes: { id: string; quote: string }[]
  model: string
}
type AskEvent =
  | { name: 'hits'; data: { query: string; hits: Found[] } }
  | { name: 'delta'; data: { text: string } }
  | { name: 'result'; data: Checked | { status: 'unverified' | 'no_answer' } }
  | { name: 'fable'; data: { allegory: string | null } }
  | { name: 'error'; data: { reason: string } }
  | { name: 'done'; data: Record<string, never> }

/** One earlier turn, sent so a follow-up is read in its context. */
export type Said = { question: string; answer: string }

async function askStream(
  question: string,
  history: Said[],
  on: (event: AskEvent) => void,
) {
  let response: Response
  try {
    response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    })
  } catch {
    throw new Unavailable('offline')
  }
  if (!response.ok || !response.body) return refuse(response)
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const name = /^event: (.+)$/m.exec(block)?.[1]
      const data = /^data: (.+)$/m.exec(block)?.[1]
      if (name && data) on({ name, data: JSON.parse(data) } as AskEvent)
    }
  }
}

/** A streamed turn: each event becomes a change to the turn Thread.tsx shows. */
export async function streamTurn(
  question: string,
  history: Said[],
  update: (patch: Partial<Turn>) => void,
) {
  let draft = ''
  let fable: Turn['fable']
  await askStream(question, history, ({ name, data }) => {
    if (name === 'hits')
      update({ hits: data.hits.map(({ score, ...item }) => ({ item, score })) })
    else if (name === 'delta') update({ draft: (draft += data.text) })
    else if (name === 'result') {
      fable = data.status === 'verified' ? 'waiting' : null
      update({
        reply: data.status === 'verified' ? data : { ...data, passages: [] },
        draft: undefined,
        fable,
      })
    } else if (name === 'fable') update({ fable: (fable = data.allegory) })
    else if (name === 'error') throw new Unavailable('error')
  })
  // A stream that ended without its fable leaves none waiting.
  if (fable === 'waiting') update({ fable: null })
}
