import { useEffect, useState } from 'react'

export const PARTIES = ['C', 'KD', 'L', 'M', 'MP', 'S', 'SD', 'V']
export const ROOT = '/data/politics/'
export type PartyVote = {
  party: string
  party_position: string
  yes_votes: number
  no_votes: number
  abstain_votes: number
  absent_votes: number
}
export type Decision = {
  id: string
  title: string
  heading: string
  designation: string
  point: number
  date: string
  committee: string
  path: string
  parties: PartyVote[]
}
export type Overview = {
  parliament: {
    imported_speeches: number
    issue_speeches: number
    sessions: number
    analyzed_segments: number
    committee_points: number
    proposition_committee_links: number
  }
  sessions: {
    id: string
    slug: string
    votes: number
    points: number
    citations: number
    reservations: number
    path: string
  }[]
  law_pools: Record<string, { documents: number; provisions: number }>
  meaning_tests: { passed: number; total: number }
  validated_vote_direction_pairs: number
}
export function useData<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({
    data: null,
    error: null,
  })
  useEffect(() => {
    const controller = new AbortController()
    setState({ data: null, error: null })
    if (path)
      fetch(ROOT + path, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Could not load ${path}`)
          return response.json() as Promise<T>
        })
        .then((data) => setState({ data, error: null }))
        .catch((error: Error) => {
          if (error.name !== 'AbortError')
            setState({ data: null, error: error.message })
        })
    return () => controller.abort()
  }, [path])
  return state
}
export const count = (n: number) => n.toLocaleString('en-GB')
export function partyStats(decisions: Decision[], party: string) {
  const rows = decisions.flatMap((d) =>
    d.parties.filter((p) => p.party === party),
  )
  const cast = rows.reduce(
    (n, p) => n + p.yes_votes + p.no_votes + p.abstain_votes,
    0,
  )
  return {
    rows: rows.length,
    yes: rows.filter((p) => p.party_position === 'Ja').length,
    no: rows.filter((p) => p.party_position === 'Nej').length,
    abstain: rows.filter((p) => p.party_position === 'Avstår').length,
    cohesion: cast
      ? (rows.reduce(
          (n, p) => n + Math.max(p.yes_votes, p.no_votes, p.abstain_votes),
          0,
        ) /
          cast) *
        100
      : null,
    attendance:
      cast + rows.reduce((n, p) => n + p.absent_votes, 0)
        ? (cast / (cast + rows.reduce((n, p) => n + p.absent_votes, 0))) * 100
        : null,
  }
}
