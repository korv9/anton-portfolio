import { useEffect, useState } from 'react'
import { load, type Government, type Sessions } from '../../parliament/data'

export type Counts = {
  yes: number
  no: number
  abstain: number
  absent: number
}
export type BallotParty = Counts & {
  party: string
  source_party: string
  members: number
  position: string
}
export type Ballot = {
  vote_key: string
  date: string
  session: string
  candidate: string
  candidate_party: string
  kind: 'appointment' | 'incumbent_check'
  approved: boolean
  totals: Counts
  parties: BallotParty[]
  source_url: string
  source_sha256: string
  extraction: string
  formed_government: Government | null
  note: string
}
export type Pair = {
  session: string
  government_key: string | null
  issue_key: string | null
  party_a: string
  party_b: string
  compared: number
  same: number
}
export type Cohesion = {
  session: string
  government_key: string | null
  issue_key: string | null
  party: string
  roll_calls: number
  eligible: number
  present: number
  abstain_votes: number
  comparable_cast: number
  aligned_cast: number
  mixed_roll_calls: number
  pm_compared: number
  pm_same: number
}
export type Workspace = Omit<Sessions, 'party_pairs'> & {
  schema_version: number
  as_of: string
  governments: Government[]
  ballots: Ballot[]
  pairs: Pair[]
  cohesion: Cohesion[]
  context_sessions: string[]
  decision_coverage: {
    session: string
    government_key: string | null
    issue_key: string | null
    roll_calls: number
  }[]
  party_pairs: (Sessions['party_pairs'][number] & { same_position: number })[]
  debate_activity: {
    session: string
    party: string
    speeches: number
    replies: number
    debates: number
  }[]
  issues: {
    issue_key: string
    issue_name_en: string
    issue_name_sv: string
    committees: string[]
    expenditure_areas: number[]
  }[]
  coverage: {
    ballots_from: string
    ballots_to: string
    ballots_note: string
    context_note: string
    government_note: string
  }
}
export type RollCall = Counts & {
  source_complete: boolean
  session: string
  roll_call_id: string
  vote_date: string
  designation: string
  point: string
  committee_code: string | null
  issue_key: string | null
  title: string | null
  report_url: string | null
  government_key: string | null
  government_position: string | null
  government_won: boolean | null
  parties?: (Counts & { party: string; position: string | null })[]
  links: {
    bills: { reference: string; title: string; url: string; evidence: string }[]
    studies: { designation: string; title: string | null; url: string }[]
    speech_candidates: {
      speech_id: string
      url: string
      similarity: number
      evidence: string
    }[]
  }
}

export function useDataset<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string | null
    data: T | null
    error: string | null
  }>({ path, data: null, error: null })
  useEffect(() => {
    let live = true
    setState({ path, data: null, error: null })
    if (path)
      load<T>(path).then(
        (data) => live && setState({ path, data, error: null }),
        (error) => live && setState({ path, data: null, error: String(error) }),
      )
    return () => {
      live = false
    }
  }, [path])
  return state.path === path ? state : { path, data: null, error: null }
}

export const workspacePath = 'parliament/workspace/index.json'
