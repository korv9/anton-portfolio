/**
 * Lexical retrieval over the index: BM25 with rules for party, period and intent. It needs no
 * service, so the chat works before any embeddings exist; vector.ts adds a vector retriever
 * and a hybrid of the two with the same interface.
 */
import { entities, sessionOfBudgetYear, sessionsOfYear } from './entities.ts'
import { BM25, paragraphs } from './text.ts'
import type {
  Datapoint,
  Debate,
  Entities,
  Intent,
  Passage,
  Speech,
  TallmanIndex,
} from './types.ts'

export type RetrieveOptions = {
  datapoints?: number
  debates?: number
  passages?: number
}

export interface Retriever {
  readonly name: string
  retrieve(question: string, options?: RetrieveOptions): Promise<Passage[]>
}

/** Reads one debate shard (its logical path) and returns its speeches. */
export type ShardLoader = (path: string) => Promise<Speech[]>

const KINDS: Partial<Record<Intent, Datapoint['kind'][]>> = {
  budget: ['budget_total', 'budget_area'],
  poll: ['poll'],
  election: ['election'],
  agreement: ['agreement'],
  record: ['record'],
}

const KIND_LABEL: Record<Datapoint['kind'], string> = {
  agreement: 'Voteringar, beräknat',
  record: 'Voteringar, beräknat',
  budget_total: 'Budgetmotioner, finansutskottet',
  budget_area: 'Budgetmotioner per utgiftsområde',
  poll: 'SCB:s partisympatiundersökning',
  election: 'Riksdagsvalet',
}

function periodOf(point: Datapoint): string {
  return point.session ?? point.month ?? String(point.year ?? '')
}

export function datapointPassage(point: Datapoint, score: number): Passage {
  return {
    id: `dp:${point.id}`,
    kind: 'datapoint',
    text: point.text,
    title: KIND_LABEL[point.kind],
    parties: point.parties,
    session: point.session,
    date: point.month ?? (point.year ? String(point.year) : undefined),
    values: point.values,
    factKind: point.kind,
    href: point.href,
    url: /^https?:/.test(point.source) ? point.source : undefined,
    sourceLabel: /^https?:/.test(point.source)
      ? KIND_LABEL[point.kind]
      : point.source,
    score,
    retriever: 'lexikal',
  }
}

export class LexicalRetriever implements Retriever {
  readonly name = 'lexikal (BM25)'
  private index: TallmanIndex
  private loadShard: ShardLoader
  private pointSearch: BM25
  private debateSearch: BM25
  private latestSession: string

  constructor(index: TallmanIndex, loadShard: ShardLoader) {
    this.index = index
    this.loadShard = loadShard
    this.pointSearch = new BM25(
      index.datapoints.map((p) => `${p.text} ${p.terms.join(' ')}`),
    )
    this.debateSearch = new BM25(
      index.debates.map((d) => `${d.title} ${d.title} ${d.words.join(' ')}`),
    )
    this.latestSession = index.debates.reduce(
      (max, d) => (d.session > max ? d.session : max),
      '',
    )
  }

  async retrieve(
    question: string,
    options: RetrieveOptions = {},
  ): Promise<Passage[]> {
    const found = entities(question)
    const points = this.points(found, options.datapoints ?? 6)
    const debates = this.debates(question, found, options.debates ?? 3)
    const speeches = await this.speeches(
      question,
      found,
      debates,
      options.passages ?? 8,
    )
    return [...points, ...speeches]
  }

  /** Datapoints that match the question's parties, period and intent, best first. */
  points(found: Entities, limit: number): Passage[] {
    // Facts about a party the index does not cover would answer another question.
    if (found.unknownParties.length && !found.parties.length) return []
    const kinds = new Set(found.intents.flatMap((i) => KINDS[i] ?? []))
    if (!kinds.size) {
      // A question about a party with no measure named gets its latest standing: survey,
      // election and budget. Without a party, facts only follow a named measure.
      if (!found.parties.length || found.intents.includes('debate')) return []
      for (const k of ['poll', 'election', 'budget_total'] as const)
        kinds.add(k)
    }
    const scored: { point: Datapoint; score: number }[] = []
    this.index.datapoints.forEach((point, i) => {
      if (kinds.size && !kinds.has(point.kind)) return
      if (!this.partyMatch(point, found)) return
      if (!this.periodMatch(point, found)) return
      let score = 2 + this.pointSearch.score(found.tokens, i)
      if (point.kind === 'budget_total') score += 1.5
      scored.push({ point, score })
    })
    const latest = this.latestPeriods(
      scored.map((s) => s.point),
      found,
    )
    const ranked = scored
      .filter((s) => latest.has(`${s.point.kind}:${periodOf(s.point)}`))
      .sort((a, b) => b.score - a.score)
    return balance(ranked, found.parties, limit).map((s) =>
      datapointPassage(s.point, Math.round(s.score * 100) / 100),
    )
  }

  private partyMatch(point: Datapoint, found: Entities): boolean {
    if (!found.parties.length) return true
    if (point.kind === 'agreement') {
      return found.parties.length === 1
        ? point.parties.includes(found.parties[0])
        : point.parties.every((p) => found.parties.includes(p))
    }
    return point.parties.some((p) => found.parties.includes(p))
  }

  private periodMatch(point: Datapoint, found: Entities): boolean {
    if (!found.sessions.length && !found.years.length) return true
    if (point.kind === 'budget_total' || point.kind === 'budget_area') {
      return (
        found.years.includes(point.year!) ||
        found.sessions.includes(sessionOfBudgetYear(point.year!))
      )
    }
    if (point.session) {
      return (
        found.sessions.includes(point.session) ||
        found.years.some((y) => sessionsOfYear(y).includes(point.session!))
      )
    }
    if (point.month)
      return found.years.includes(Number(point.month.slice(0, 4)))
    return found.years.includes(point.year!)
  }

  /** Without a period in the question, answer from the latest period of each kind. */
  private latestPeriods(points: Datapoint[], found: Entities): Set<string> {
    const keep = new Set<string>()
    if (
      found.sessions.length ||
      found.years.length ||
      found.intents.includes('change')
    ) {
      for (const p of points) keep.add(`${p.kind}:${periodOf(p)}`)
      return keep
    }
    const latest = new Map<string, string>()
    for (const p of points) {
      const period = periodOf(p)
      if (period > (latest.get(p.kind) ?? '')) latest.set(p.kind, period)
    }
    for (const [kind, period] of latest) keep.add(`${kind}:${period}`)
    return keep
  }

  debates(question: string, found: Entities, limit: number): Debate[] {
    if (found.unknownParties.length && !found.parties.length) return []
    const ranked = this.debateSearch.rank(question, 60)
    // Swedish compounds hide their parts ("friskolesektorn"), so also take titles with a word
    // that begins with a long question word.
    const seen = new Set(ranked.map((r) => r.index))
    this.index.debates.forEach((debate, index) => {
      if (!seen.has(index) && compoundHits(debate.title, found.tokens))
        ranked.push({ index, score: 0 })
    })
    const measured = found.intents.some((i) => KINDS[i])
    return (
      ranked
        .map(({ index, score }) => ({
          debate: this.index.debates[index],
          score,
        }))
        .filter(({ debate }) =>
          found.sessions.length
            ? found.sessions.includes(debate.session)
            : found.years.length
              ? found.years.some((y) =>
                  sessionsOfYear(y).includes(debate.session),
                )
              : true,
        )
        .filter(({ debate }) => found.parties.every((p) => debate.parties[p]))
        .map(({ debate, score }) => ({
          debate,
          // Newer debates first when the scores are close.
          score:
            score +
            (debate.session === this.latestSession ? 0.5 : 0) +
            compoundHits(debate.title, found.tokens) * 3,
        }))
        // Facts answer a question about a measure; debates then need a clear match to add to them.
        .filter(({ score }) => score > (measured ? 6 : 2))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ debate }) => debate)
    )
  }

  /** The best paragraphs of the chosen debates, at most two per speech. */
  async speeches(
    question: string,
    found: Entities,
    debates: Debate[],
    limit: number,
  ): Promise<Passage[]> {
    if (!debates.length || limit <= 0) return []
    const loaded = await Promise.all(
      debates.map((d) => this.loadShard(d.path).catch(() => [] as Speech[])),
    )
    const pieces: {
      speech: Speech
      debate: Debate
      text: string
      n: number
    }[] = []
    loaded.forEach((speeches, i) => {
      for (const speech of speeches) {
        const n = speech.speech_number
        if (n < debates[i].first || n > debates[i].last) continue
        if (!speech.party || !speech.speech_text) continue
        if (found.parties.length && !found.parties.includes(speech.party))
          continue
        paragraphs(speech.speech_text).forEach((text, n) =>
          pieces.push({ speech, debate: debates[i], text, n }),
        )
      }
    })
    if (!pieces.length) return []
    const search = new BM25(pieces.map((p) => p.text))
    const perSpeech = new Map<string, number>()
    const out: Passage[] = []
    for (const { index, score } of search.rank(question, limit * 6)) {
      const piece = pieces[index]
      const used = perSpeech.get(piece.speech.speech_id) ?? 0
      if (used >= 2) continue
      perSpeech.set(piece.speech.speech_id, used + 1)
      out.push({
        id: `tal:${piece.speech.speech_id}#${piece.n}`,
        kind: 'speech',
        text: piece.text,
        title: piece.debate.title,
        parties: [piece.speech.party!],
        speaker: piece.speech.speaker,
        date: piece.speech.speech_date,
        session: piece.speech.session,
        href: '#debates',
        url: piece.speech.source_url,
        sourceLabel: 'Riksdagens protokoll',
        score,
        retriever: 'lexikal',
      })
      if (out.length >= limit) break
    }
    return out
  }
}

/** Title words that begin with a long question word, e.g. friskol → friskolesektorn. */
function compoundHits(title: string, query: string[]): number {
  const words = title.toLowerCase().match(/[a-zåäöéü]+/g) ?? []
  const stems = query.filter((t) => t.length >= 6)
  return stems.filter((q) =>
    words.some((w) => w.length > q.length && w.startsWith(q)),
  ).length
}

/** Take the best facts in turns per named party, so two parties get an equal share. */
function balance<T extends { point: Datapoint }>(
  ranked: T[],
  parties: string[],
  limit: number,
): T[] {
  if (parties.length < 2) return ranked.slice(0, limit)
  const own = ranked.filter((s) => s.point.kind !== 'agreement')
  const queues = parties.map((p) => own.filter((s) => s.point.parties[0] === p))
  const shared = ranked.filter((s) => s.point.kind === 'agreement')
  const out: T[] = shared.slice(0, limit)
  for (
    let round = 0;
    out.length < limit && queues.some((q) => q.length > round);
    round++
  )
    for (const queue of queues)
      if (queue[round] && out.length < limit) out.push(queue[round])
  return out
}

/** A shard loader over fetch; `base` is where shards are served (R2 or /data/). */
export function fetchShards(
  base: string,
  fetcher: typeof fetch = fetch,
): ShardLoader {
  const cache = new Map<string, Promise<Speech[]>>()
  return (path) => {
    if (!cache.has(path))
      cache.set(
        path,
        fetcher(base + path)
          .then((r) => {
            if (!r.ok) throw new Error(`${r.status} ${path}`)
            return r.json() as Promise<{ data: Speech[] }>
          })
          .then((shard) => shard.data ?? []),
      )
    return cache.get(path)!
  }
}
