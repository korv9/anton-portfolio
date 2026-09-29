/**
 * The shapes Herr taLLMan passes around: the index built by platform/tallman/build_index.py,
 * the passages a retriever returns, the claims a model (or the offline extractor) makes and
 * the verdict the Allegoria layer gives each claim.
 *
 * Pure types, no runtime code, so the browser, the Worker and node --test share them.
 */

/** A recomputable fact from the site's published data. */
export type Datapoint = {
  id: string
  kind:
    | 'agreement'
    | 'record'
    | 'budget_total'
    | 'budget_area'
    | 'poll'
    | 'election'
  parties: string[]
  session?: string
  year?: number
  month?: string
  text: string
  values: Record<string, number>
  terms: string[]
  /** Where on this site the fact is shown. */
  href: string
  /** The original source: a URL or the name of the publisher. */
  source: string
}

/** One Riksdag debate; its speeches live in a shard that is read at answer time. */
export type Debate = {
  id: string
  /** The shard holding the whole protocol. */
  path: string
  /** This debate's speeches within the protocol, by speech number. */
  first: number
  last: number
  title: string
  session: string
  date: string
  kind: string
  parties: Record<string, number>
  speeches: number
  words: string[]
}

export type TallmanIndex = {
  schema_version: number
  generated_at: string
  counts: { datapoints: number; debates: number }
  datapoints: Datapoint[]
  debates: Debate[]
}

/** One speech as stored in a debate shard. */
export type Speech = {
  speech_id: string
  speech_number: number
  session: string
  speech_date: string
  debate_title: string
  speaker: string
  party: string | null
  speech_text: string
  source_url: string
}

/** A piece of evidence handed to the model and to Allegoria. */
export type Passage = {
  /** Stable id: `dp:<datapoint id>` or `tal:<speech id>#<paragraph>`. */
  id: string
  kind: 'datapoint' | 'speech'
  text: string
  /** A short heading: the debate title, or the kind of fact. */
  title: string
  parties: string[]
  speaker?: string
  date?: string
  session?: string
  /** Numbers the passage states, for datapoints. */
  values?: Record<string, number>
  /** The datapoint kind, so conflicting values for the same fact can be found. */
  factKind?: Datapoint['kind']
  /** A link on this site, if the fact is shown here. */
  href?: string
  /** The original source: a URL where one exists. */
  url?: string
  sourceLabel: string
  score: number
  retriever: 'lexikal' | 'vektor' | 'hybrid'
}

/**
 * What a claim says it is. The model (or the extractor) proposes this; Allegoria decides the
 * label from the evidence, so a claim cannot promote itself.
 */
export type ClaimType = 'quote' | 'computed' | 'summary' | 'interpretation'

export type Claim = {
  id: string
  text: string
  type: ClaimType
  /** Passage ids the claim rests on. */
  sources: string[]
  /** For a quote: the words taken from the source, verbatim. */
  quote?: string
  /** For a computed claim: how the number was derived, e.g. `a - b`. */
  formula?: string
}

export type Label =
  | 'direct'
  | 'summary'
  | 'computed'
  | 'interpretation'
  | 'insufficient'
  | 'conflict'

export const LABEL_SV: Record<Label, string> = {
  direct: 'Direkt belagt',
  summary: 'Sammanfattning',
  computed: 'Beräknat',
  interpretation: 'Tolkning',
  insufficient: 'Otillräckligt underlag',
  conflict: 'Motstridiga källor',
}

export type CheckedClaim = Claim & {
  label: Label
  /** Share of the claim's content words found in its sources, 0–1. */
  support: number
  /** Human-readable reasons for the label, in Swedish. */
  notes: string[]
}

export type Certainty = 'Hög' | 'Medel' | 'Låg'

export type Stats = {
  retrieved: number
  checked: number
  direct: number
  computed: number
  summary: number
  interpretation: number
  insufficient: number
  conflict: number
}

export type Trace = {
  question: string
  entities: Entities
  retriever: string
  passages: Passage[]
  claims: CheckedClaim[]
  conflicts: string[]
  model: string
  dataVersion: string
  timingsMs: Record<string, number>
}

export type Answer = {
  question: string
  /** One or two sentences that frame the claims; never carries facts of its own. */
  lead: string
  claims: CheckedClaim[]
  certainty: Certainty
  stats: Stats
  /** Plain-language version of the stats, e.g. "12 källor hämtade · 5 påståenden …". */
  statsLine: string
  trace: Trace
}

export type Entities = {
  parties: string[]
  /** Party names the index does not cover, e.g. "Piratpartiet". */
  unknownParties: string[]
  sessions: string[]
  years: number[]
  government: boolean
  intents: Intent[]
  tokens: string[]
}

export type Intent =
  'budget' | 'poll' | 'election' | 'agreement' | 'record' | 'debate' | 'change'

/** Reviewed notes on how a rule changed over time. Only these may back a claim of change. */
export type Annotation = {
  id: string
  /** Passage or datapoint ids the annotation is about. */
  about: string[]
  direction: 'skärpning' | 'lättnad' | 'oförändrat'
  text: string
  reviewed_by: string
  reviewed_at: string
  source: string
}
