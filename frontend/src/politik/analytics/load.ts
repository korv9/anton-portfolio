/**
 * Loading for the politics story: the roll calls of every session with decision details
 * (cleaned once, with what was left out), the precomputed text and member figures, and the
 * derived metrics, memoised so no chart recomputes them on render.
 */
import { useEffect, useMemo, useState } from 'react'
import { load } from '../../parliament/data'
import { RIKSDAG_PARTIES } from '../../parties/identity'
import {
  calculateAreaPolarisation,
  calculatePartyCohesion,
  calculatePartySimilarity,
  cleanVotes,
  mostPolarised,
  votesPerMonth,
  votingPCA,
} from './metrics'
import type { DataQuality, StoryData, Vote, VotingEvent } from './types'

/** The sessions with one row per decision point and party (politics/decisions/). */
export const VOTE_SESSIONS = ['2024-25', '2025-26']

export function loadVotes(): Promise<{ votes: Vote[]; quality: DataQuality }> {
  return Promise.all(
    VOTE_SESSIONS.map((s) =>
      load<VotingEvent[]>(`politics/decisions/${s}/index.json`).then((rows) =>
        rows.map((r) => ({ ...r, session: s.replace('-', '/') })),
      ),
    ),
  ).then((all) => cleanVotes(all.flat()))
}

export const loadStory = () => load<StoryData>('politics/parliament/story.json')

export type Analytics = ReturnType<typeof derive>

function derive(votes: Vote[]) {
  const parties = RIKSDAG_PARTIES
  const pca = votingPCA(votes, parties)
  // Order the parties along the first component, so similar parties sit together.
  const order = [...pca.points].sort((a, b) => a.x - b.x).map((p) => p.party)
  return {
    votes,
    parties,
    order,
    pca,
    cohesion: calculatePartyCohesion(votes, parties),
    similarity: calculatePartySimilarity(votes, parties),
    areas: calculateAreaPolarisation(votes),
    polarised: mostPolarised(votes, 12),
    months: votesPerMonth(votes),
  }
}

/** Everything the story's vote sections need, computed once. */
export function useVoteAnalytics() {
  const [state, setState] = useState<{
    votes: Vote[]
    quality: DataQuality
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadVotes()
      .then(setState)
      .catch((e: Error) => setError(e.message))
  }, [])
  const analytics = useMemo(() => (state ? derive(state.votes) : null), [state])
  return { analytics, quality: state?.quality ?? null, error }
}

export function useStory() {
  const [story, setStory] = useState<StoryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadStory()
      .then(setStory)
      .catch((e: Error) => setError(e.message))
  }, [])
  return { story, error }
}
