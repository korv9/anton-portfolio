/**
 * Vector retrieval: passages embedded with Workers AI (bge-m3, multilingual, 1024 dimensions)
 * and stored in Vectorize with their text as metadata, so a match is a passage without a second
 * lookup. The hybrid retriever merges it with the lexical one by reciprocal rank fusion, so
 * exact names and numbers (lexical) and paraphrases (vectors) both count.
 */
import {
  datapointPassage,
  type Retriever,
  type RetrieveOptions,
} from '../frontend/src/tallman/engine/retrieve.ts'
import { paragraphs } from '../frontend/src/tallman/engine/text.ts'
import type {
  Debate,
  Passage,
  Speech,
  TallmanIndex,
} from '../frontend/src/tallman/engine/types.ts'

export const EMBEDDING_MODEL = '@cf/baai/bge-m3'

/** The part of Workers AI used here. */
export type Embedder = {
  run(model: string, input: { text: string[] }): Promise<unknown>
}

export async function embed(
  ai: Embedder,
  texts: string[],
): Promise<number[][]> {
  const out = (await ai.run(EMBEDDING_MODEL, { text: texts })) as {
    data?: number[][]
  }
  if (!out.data || out.data.length !== texts.length)
    throw new Error('embedding failed')
  return out.data
}

// Vectorize keeps at most 10 KiB of metadata per vector; passages are cut well below that.
const MAX_TEXT = 1500

function toMetadata(p: Passage): Record<string, VectorizeVectorMetadata> {
  return {
    kind: p.kind,
    text: p.text.slice(0, MAX_TEXT),
    title: p.title,
    parties: p.parties.join(','),
    speaker: p.speaker ?? '',
    date: p.date ?? '',
    session: p.session ?? '',
    href: p.href ?? '',
    url: p.url ?? '',
    sourceLabel: p.sourceLabel,
    factKind: p.factKind ?? '',
    values: JSON.stringify(p.values ?? {}),
  }
}

function fromMatch(match: VectorizeMatch): Passage {
  const m = (match.metadata ?? {}) as Record<string, string>
  const values = m.values
    ? (JSON.parse(m.values) as Record<string, number>)
    : {}
  return {
    id: match.id,
    kind: m.kind === 'datapoint' ? 'datapoint' : 'speech',
    text: m.text ?? '',
    title: m.title ?? '',
    parties: m.parties ? m.parties.split(',') : [],
    ...(m.speaker ? { speaker: m.speaker } : {}),
    ...(m.date ? { date: m.date } : {}),
    ...(m.session ? { session: m.session } : {}),
    ...(m.href ? { href: m.href } : {}),
    ...(m.url ? { url: m.url } : {}),
    ...(m.factKind
      ? { factKind: m.factKind as Passage['factKind'], values }
      : {}),
    sourceLabel: m.sourceLabel ?? '',
    score: match.score,
    retriever: 'vektor',
  }
}

export class VectorRetriever implements Retriever {
  readonly name = `vektor (${EMBEDDING_MODEL} + Vectorize)`
  private ai: Embedder
  private index: Vectorize

  constructor(ai: Embedder, index: Vectorize) {
    this.ai = ai
    this.index = index
  }

  async retrieve(
    question: string,
    options: RetrieveOptions = {},
  ): Promise<Passage[]> {
    const [vector] = await embed(this.ai, [question])
    const topK = (options.datapoints ?? 6) + (options.passages ?? 8)
    const result = await this.index.query(vector, {
      topK,
      returnMetadata: 'all',
    })
    return result.matches.map(fromMatch)
  }
}

/** Reciprocal rank fusion of several retrievers; a passage found by both ranks highest. */
export class HybridRetriever implements Retriever {
  readonly name: string
  private parts: Retriever[]
  private limit: number

  constructor(parts: Retriever[], limit = 14) {
    this.parts = parts
    this.limit = limit
    this.name = `hybrid (${parts.map((p) => p.name).join(' + ')})`
  }

  async retrieve(
    question: string,
    options?: RetrieveOptions,
  ): Promise<Passage[]> {
    const lists = await Promise.all(
      this.parts.map((p) =>
        p.retrieve(question, options).catch(() => [] as Passage[]),
      ),
    )
    const fused = new Map<string, { passage: Passage; score: number }>()
    for (const list of lists)
      list.forEach((passage, rank) => {
        const entry = fused.get(passage.id) ?? { passage, score: 0 }
        entry.score += 1 / (60 + rank)
        if (entry.passage !== passage)
          entry.passage = { ...entry.passage, retriever: 'hybrid' }
        fused.set(passage.id, entry)
      })
    return [...fused.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, this.limit)
      .map(({ passage, score }) => ({
        ...passage,
        score: Math.round(score * 1e4) / 1e4,
      }))
  }
}

/** Every passage of one debate, as the lexical retriever would cut them. */
export function debatePassages(debate: Debate, speeches: Speech[]): Passage[] {
  const out: Passage[] = []
  for (const speech of speeches) {
    const n = speech.speech_number
    if (
      n < debate.first ||
      n > debate.last ||
      !speech.party ||
      !speech.speech_text
    )
      continue
    paragraphs(speech.speech_text).forEach((text, i) =>
      out.push({
        id: `tal:${speech.speech_id}#${i}`,
        kind: 'speech',
        text,
        title: debate.title,
        parties: [speech.party!],
        speaker: speech.speaker,
        date: speech.speech_date,
        session: speech.session,
        href: '#debates',
        url: speech.source_url,
        sourceLabel: 'Riksdagens protokoll',
        score: 0,
        retriever: 'vektor',
      }),
    )
  }
  return out
}

/** Embed and upsert passages, in batches Workers AI accepts. */
export async function upsertPassages(
  ai: Embedder,
  index: Vectorize,
  passages: Passage[],
  batch = 50,
): Promise<number> {
  let count = 0
  for (let i = 0; i < passages.length; i += batch) {
    const part = passages.slice(i, i + batch)
    const vectors = await embed(
      ai,
      part.map((p) => `${p.title}\n${p.text}`),
    )
    await index.upsert(
      part.map((p, j) => ({
        id: p.id,
        values: vectors[j],
        metadata: toMetadata(p),
      })),
    )
    count += part.length
  }
  return count
}

export function allDatapointPassages(index: TallmanIndex): Passage[] {
  return index.datapoints.map((d) => ({
    ...datapointPassage(d, 0),
    retriever: 'vektor' as const,
  }))
}
