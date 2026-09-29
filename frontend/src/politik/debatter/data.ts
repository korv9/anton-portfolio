/**
 * The debates: statistics per debate (politics/parliament/debate-stats/, written by
 * platform/publish/export_debates.py) and the speeches themselves, in order, from the shards.
 */
import { fetchData } from '../../dataSource'
import { load } from '../../parliament/data'

export type PartyCounts = Record<string, [speeches: number, replies: number]>

export type DecisionPoint = {
  id: string
  heading: string
  point: number | null
  positions: Record<string, string>
}

export type IssueDebate = {
  id: string
  path: string
  title: string
  date: string
  speeches: number
  replies: number
  parties: PartyCounts
  first: number
  last: number
  decision?: {
    designation: string
    committee: string
    date: string
    points: DecisionPoint[]
  }
  issues: string[]
  /** 'beslut': from the decision's committee; 'ord': from words in the title. */
  issues_via: 'beslut' | 'ord'
}

export type LeaderDebate = {
  id: string
  path: string
  title: string
  date: string
  session: string
  speeches: number
  replies: number
  parties: PartyCounts
  /** Replies and answers from one party (key) to another. */
  replied_to: Record<string, Record<string, number>>
}

export type Issue = {
  key: string
  sv: string
  en: string
  committees: string[]
  words: string[]
}

export type DebateIndex = {
  generated_at: string
  sessions: {
    session: string
    path: string
    debates: number
    speeches: number
    replies: number
    linked_to_decisions: number
  }[]
  leaders: LeaderDebate[]
  issues: Issue[]
}

export const loadDebateIndex = () =>
  load<DebateIndex>('politics/parliament/debate-stats/index.json')

export const loadSession = (path: string) =>
  load<{ session: string; debates: IssueDebate[] }>(path)

export type Speech = {
  speech_id: string
  speech_number: number
  speech_date: string
  debate_title: string
  speaker: string
  party: string | null
  is_reply: boolean
  speech_text: string
  source_url: string
}

const shards = new Map<string, Promise<Speech[]>>()

/** The speeches of a protocol, in speaking order. */
export function loadSpeeches(path: string): Promise<Speech[]> {
  if (!shards.has(path)) {
    const pending = fetchData(path)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<{ data: Speech[] }>
      })
      .then((s) =>
        [...(s.data ?? [])].sort((a, b) => a.speech_number - b.speech_number),
      )
    pending.catch(() => shards.delete(path))
    shards.set(path, pending)
  }
  return shards.get(path)!
}

/** One turn in a debate: who spoke, and to whom when it was a reply. */
export type Turn = {
  speech: Speech
  /** The speaker being replied to (a reply) or answered (the main speaker's answer). */
  to?: { speaker: string; party: string | null }
  kind: 'anförande' | 'replik' | 'svar'
}

/** A main speech and the replies that follow it, in order. */
export type Exchange = { opening: Turn; replies: Turn[] }

/**
 * Speeches in order grouped into exchanges. Others reply to the main speaker; the main speaker
 * answers each of them in turn. Replies before any main speech stand alone.
 */
export function exchanges(speeches: Speech[]): Exchange[] {
  const out: Exchange[] = []
  let current: Exchange | null = null
  let lastOther: Speech | null = null
  for (const speech of speeches) {
    if (!speech.is_reply || !current) {
      current = { opening: { speech, kind: 'anförande' }, replies: [] }
      out.push(current)
      lastOther = null
      continue
    }
    const main = current.opening.speech
    if (speech.speaker !== main.speaker) {
      current.replies.push({
        speech,
        kind: 'replik',
        to: { speaker: main.speaker, party: main.party },
      })
      lastOther = speech
    } else {
      current.replies.push({
        speech,
        kind: 'svar',
        to: lastOther
          ? { speaker: lastOther.speaker, party: lastOther.party }
          : undefined,
      })
    }
  }
  return out
}

/**
 * Issue areas whose keywords the text mentions, most mentioned first (word matches). A word
 * counts when it is the keyword or the keyword with a short ending ("polisen", "skolorna"), and
 * an area needs `minHits` mentions, so one passing word does not tag a speech.
 */
export function issuesIn(
  text: string,
  issues: Issue[],
  limit = 3,
  minHits = 1,
): string[] {
  const words = text.toLowerCase().match(/[a-zåäöéü-]+/g) ?? []
  const matches = (w: string, k: string) =>
    w === k || (w.startsWith(k) && w.length - k.length <= 4 && k.length >= 4)
  return issues
    .map((issue) => ({
      key: issue.key,
      hits: words.filter((w) => issue.words.some((k) => matches(w, k))).length,
    }))
    .filter((x) => x.hits >= minHits)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((x) => x.key)
}

/** The speaker without the party suffix the protocols add ("Anna Andersson (S)"). */
export const speakerName = (speaker: string) =>
  speaker.replace(/\s*\([^)]*\)\s*$/, '')

export const totalFor = (counts: PartyCounts, party: string) =>
  (counts[party]?.[0] ?? 0) + (counts[party]?.[1] ?? 0)
