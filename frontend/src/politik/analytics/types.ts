/**
 * The data objects of the politics story, typed once. Decisions come from
 * politics/decisions/<session>/index.json (one row per decision point, each party's position and
 * vote counts); the text and member figures from politics/parliament/story.json, written by
 * platform/publish/politics_story.py.
 */

export type Position = 'Ja' | 'Nej' | 'Avstår'

/** One party in one roll call: its position (the members' most common vote) and the counts. */
export type PartyVote = {
  party: string
  party_position: string | null
  yes_votes: number
  no_votes: number
  abstain_votes: number
  absent_votes: number
}

/** One decision point put to a roll call. */
export type VotingEvent = {
  id: string
  title: string
  heading: string
  designation: string
  date: string
  path: string
  point: number
  committee: string
  parties: PartyVote[]
}

export type Vote = VotingEvent & { session: string }

export type PartySimilarity = {
  a: string
  b: string
  /** Roll calls where both parties had a position. */
  compared: number
  /** Of those, the share where the positions were the same, 0–100. */
  pct: number
}

export type PartyCohesion = {
  party: string
  /** Cast votes matching the party's position, of all cast votes, 0–100. */
  pct: number
  cast: number
}

export type PolarisedVote = {
  vote: Vote
  /** 0 when every party took the same position; higher the more the parties split. */
  polarisation: number
  yes: number
  no: number
  abstain: number
  absent: number
}

export type PoliticalTopic = {
  key: string
  sv: string
  en: string
}

export type AreaStats = {
  committee: string
  votes: number
  /** Mean polarisation of the area's roll calls. */
  polarisation: number
  /** Share of the area's roll calls where the parties did not all agree, 0–100. */
  contested: number
  /** Share of the area's roll calls decided by a close margin (CLOSE_MARGIN), 0–100. */
  close: number
}

export type MemberStats = {
  id: string
  name: string
  parties: string[]
  constituency: string | null
  yes: number
  no: number
  abstain: number
  absent: number
  /** Cast votes compared with the party's position. */
  compared: number
  deviating: number
}

export type Keyword = {
  stem: string
  word: string
  per_10k: number
  score: number
}

export type DebateSpeaker = {
  speeches: number
  replies: number
  words: number
  speakers: string[]
  topics: Record<string, number>
  keywords: Keyword[]
}

export type Debate = {
  id: string
  date: string
  session: string
  parties: Record<string, DebateSpeaker>
  topics: Record<string, number>
}

export type Term = {
  stem: string
  word: string
  now: number
  before: number
  ratio: number
}

export type StoryData = {
  method: Record<string, string>
  sessions: string[]
  quality: Record<string, number>
  members: MemberStats[]
  leader_debates: Debate[]
  agenda: { session: string; shares: Record<string, number> }[]
  terms: {
    rising: Term[]
    falling: Term[]
    words_now: number
    words_before: number
    now: string
    before: string[]
  }
}

/** What the cleaning step found and left out, for the "Om datan" section. */
export type DataQuality = {
  rows: number
  kept: number
  duplicates: number
  withoutPositions: number
  fewVotes: number
  missingPositions: number
}
