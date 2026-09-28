import { fetchJson } from '../welfare/data'

export type PartyResult = {
  party: string
  name: string
  votes: number | null
  share_pct: number | null
  seats: number
  previous_share_pct: number | null
  previous_seats: number | null
}
export type Government = {
  government_key: string
  government_name: string
  prime_minister: string
  prime_minister_party: string
  government_parties: string[]
  start_date: string
  end_date: string | null
  agreement_name: string | null
  agreement_parties: string[] | null
  status_note: string | null
  source_url: string
  is_current: boolean
}
export type Poll = {
  survey_month: string
  party: string
  share_pct: number
  margin_of_error_pp: number | null
  change_since_last_survey_pp?: number | null
}
export type Decision = {
  session: string
  roll_call_id: string
  vote_date: string
  designation: string
  point: string
  committee_code?: string | null
  committee_name?: string | null
  issue_key?: string | null
  title: string | null
  report_url: string | null
  yes: number
  no: number
  abstain?: number
  absent?: number
  outcome: 'yes' | 'no' | 'tie'
  government_won: boolean | null
  party_positions?: Record<string, string>
  /** The studies the bill behind the decision rests on. */
  studies?: StudyLink[]
}
/** A government study (SOU, Ds, Riksrevisionen) or ministry memorandum, as a link. */
export type StudyLink = {
  kind: 'sou' | 'ds' | 'rir' | 'pm'
  designation: string
  title: string | null
  url: string
}
export type Now = {
  generated_at: string
  election: {
    year: number
    election_date: string
    count_status: string
    majority: number
    source: string
    parties: PartyResult[]
  }
  government: Government
  formation_news: { date: string; title: string; summary: string | null }[]
  poll: { survey_month: string; parties: Poll[] }
  latest_session: string
  latest_decisions: Decision[]
}
export type Elections = {
  years: number[]
  majority: number
  party_names: Record<string, string>
  results: {
    election_year: number
    party: string
    votes: number | null
    share_pct: number | null
    seats: number
    source: string
  }[]
  note: string
}
export type SessionRecord = {
  session: string
  party: string
  roll_calls: number
  role: 'government' | 'agreement' | 'opposition'
  attendance_pct: number
  cohesion_pct: number
  on_winning_side_pct: number | null
  with_government_pct: number | null
  abstained_pct: number
}
export type Sessions = {
  sessions: {
    session: string
    start_year: number
    roll_calls: number
    election_year: number
    government_name: string
    government_parties: string[]
    agreement_parties?: string[] | null
  }[]
  party_record: SessionRecord[]
  party_pairs: {
    session: string
    party_a: string
    party_b: string
    comparable_roll_calls: number
    agreement_pct: number
  }[]
  government_record: {
    session: string
    decisions: number
    government_won_pct: number
  }[]
}
export type Issue = {
  issue_key: string
  issue_name_sv: string
  issue_name_en: string
  summary_sv: string
  expenditure_areas: number[]
  committees: string[]
  per_session: {
    session: string
    decisions: number
    government_won_pct: number | null
  }[]
  parties: {
    party: string
    role: 'government' | 'agreement' | 'opposition'
    decisions: number
    with_government_pct: number | null
    on_winning_side_pct: number | null
  }[]
  recent_decisions: Decision[]
  speeches: { session: string; party: string; speeches: number }[]
  budget_outturn_msek: { year: number; outturn_msek: number }[]
  welfare: {
    indicator_key: string
    indicator_name: string
    unit: string | null
    higher_is_better: boolean | null
    series: { year: number; value: number }[]
  }[]
}
export type Issues = {
  issues: Issue[]
  speech_link_coverage: number
  notes: Record<string, string>
}

export const PARTY_ORDER = [
  'S',
  'M',
  'SD',
  'V',
  'C',
  'KD',
  'MP',
  'L',
  'NYD',
  'OTHER',
]
export const PARTY_NAMES: Record<string, string> = {
  S: 'Socialdemokraterna',
  M: 'Moderaterna',
  SD: 'Sverigedemokraterna',
  V: 'Vänsterpartiet',
  C: 'Centerpartiet',
  KD: 'Kristdemokraterna',
  MP: 'Miljöpartiet',
  L: 'Liberalerna',
  NYD: 'Ny demokrati',
  OTHER: 'Övriga',
}
export const partyLabel = (party: string) =>
  party === 'OTHER' ? 'Övr.' : party

const cache = new Map<string, Promise<unknown>>()
export function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const pending = fetchJson<T>(path)
    cache.set(path, pending)
    pending.catch(() => cache.delete(path))
  }
  return cache.get(path) as Promise<T>
}

/** '2025/26' -> an ISO date in the session's first autumn, for a time axis. */
export const sessionDate = (session: string) => `${session.slice(0, 4)}-10-01`

export function percent(value: number | null | undefined, digits = 1) {
  if (value == null) return '–'
  return `${value.toLocaleString('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`
}
