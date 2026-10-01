/**
 * The politics story's metrics, computed in one place so every chart and sentence agrees.
 * Pure functions over typed data; the unit tests (tests/unit/metrics.test.ts) pin each one.
 * Every metric is descriptive: how often parties vote alike, how far they split, what they
 * talk about. None of them grades a party.
 *
 * Definitions (also in the README and the tooltips):
 * - Party position: the vote most of the party's members cast in a roll call (from Riksdagen).
 * - Cohesion: cast votes (yes, no, abstain) matching the party's position, of all its cast votes.
 * - Similarity: of the roll calls where both parties had a position, the share where it was the same.
 * - Polarisation of a roll call: 1 − (the size of the largest group of members whose party took
 *   the same position) / (all members of parties with a position). 0 when all parties agree.
 * - Area polarisation: the mean polarisation of a committee's roll calls.
 * - Member deviation: cast votes that differ from the party's position, of the cast votes compared.
 */
import type {
  AreaStats,
  DataQuality,
  PartyCohesion,
  PartySimilarity,
  PartyVote,
  PolarisedVote,
  Position,
  Vote,
} from './types.ts'

const POSITIONS: Position[] = ['Ja', 'Nej', 'Avstår']
export const isPosition = (p: string | null | undefined): p is Position =>
  !!p && (POSITIONS as string[]).includes(p)

const members = (p: PartyVote) =>
  p.yes_votes + p.no_votes + p.abstain_votes + p.absent_votes
const cast = (p: PartyVote) => p.yes_votes + p.no_votes + p.abstain_votes

/** A roll call is close when yes and no are within this many percentage points. */
export const CLOSE_MARGIN = 10

/** Fewer cast votes than this in a roll call and it is left out of the metrics. */
export const MIN_CAST = 100

/**
 * The roll calls the metrics use, and what was left out: duplicate rows (the same decision
 * point twice), roll calls where no party had a position, and roll calls with so few cast votes
 * that they say little (fewer than MIN_CAST).
 */
export function cleanVotes(rows: Vote[]): {
  votes: Vote[]
  quality: DataQuality
} {
  const seen = new Set<string>()
  const quality: DataQuality = {
    rows: rows.length,
    kept: 0,
    duplicates: 0,
    withoutPositions: 0,
    fewVotes: 0,
    missingPositions: 0,
  }
  const votes: Vote[] = []
  for (const v of rows) {
    const key = `${v.id}|${v.point}`
    if (seen.has(key)) {
      quality.duplicates++
      continue
    }
    seen.add(key)
    const withPosition = v.parties.filter((p) => isPosition(p.party_position))
    quality.missingPositions += v.parties.length - withPosition.length
    if (!withPosition.length) {
      quality.withoutPositions++
      continue
    }
    if (v.parties.reduce((s, p) => s + cast(p), 0) < MIN_CAST) {
      quality.fewVotes++
      continue
    }
    votes.push(v)
  }
  quality.kept = votes.length
  return { votes, quality }
}

const positionOf = (v: Vote, party: string) => {
  const p = v.parties.find((x) => x.party === party)?.party_position
  return isPosition(p) ? p : null
}

export function calculatePartyCohesion(
  votes: Vote[],
  parties: string[],
): PartyCohesion[] {
  return parties.map((party) => {
    let match = 0
    let all = 0
    for (const v of votes) {
      const p = v.parties.find((x) => x.party === party)
      if (!p || !isPosition(p.party_position)) continue
      all += cast(p)
      match +=
        p.party_position === 'Ja'
          ? p.yes_votes
          : p.party_position === 'Nej'
            ? p.no_votes
            : p.abstain_votes
    }
    return { party, pct: all ? (match / all) * 100 : 0, cast: all }
  })
}

export function calculatePartySimilarity(
  votes: Vote[],
  parties: string[],
): PartySimilarity[] {
  const out: PartySimilarity[] = []
  for (const a of parties)
    for (const b of parties) {
      let compared = 0
      let same = 0
      for (const v of votes) {
        const pa = positionOf(v, a)
        const pb = positionOf(v, b)
        if (!pa || !pb) continue
        compared++
        same += pa === pb ? 1 : 0
      }
      out.push({ a, b, compared, pct: compared ? (same / compared) * 100 : 0 })
    }
  return out
}

export function calculatePolarisation(v: Vote): number {
  const groups = new Map<string, number>()
  let total = 0
  for (const p of v.parties) {
    if (!isPosition(p.party_position)) continue
    const n = members(p)
    total += n
    groups.set(p.party_position, (groups.get(p.party_position) ?? 0) + n)
  }
  if (!total) return 0
  return 1 - Math.max(...groups.values()) / total
}

/** Yes minus no, as a share of yes and no votes: 0 is a dead heat, 100 unanimous. */
export function calculateVoteMargin(v: Vote): number {
  const yes = v.parties.reduce((s, p) => s + p.yes_votes, 0)
  const no = v.parties.reduce((s, p) => s + p.no_votes, 0)
  return yes + no ? (Math.abs(yes - no) / (yes + no)) * 100 : 0
}

export function mostPolarised(votes: Vote[], n = 10): PolarisedVote[] {
  return votes
    .map((vote) => ({
      vote,
      polarisation: calculatePolarisation(vote),
      yes: vote.parties.reduce((s, p) => s + p.yes_votes, 0),
      no: vote.parties.reduce((s, p) => s + p.no_votes, 0),
      abstain: vote.parties.reduce((s, p) => s + p.abstain_votes, 0),
      absent: vote.parties.reduce((s, p) => s + p.absent_votes, 0),
    }))
    .sort(
      (a, b) =>
        b.polarisation - a.polarisation ||
        calculateVoteMargin(a.vote) - calculateVoteMargin(b.vote) ||
        a.vote.date.localeCompare(b.vote.date),
    )
    .slice(0, n)
}

export function calculateAreaPolarisation(votes: Vote[]): AreaStats[] {
  const by = new Map<string, Vote[]>()
  for (const v of votes)
    by.set(v.committee, [...(by.get(v.committee) ?? []), v])
  return [...by]
    .map(([committee, vs]) => {
      const pol = vs.map(calculatePolarisation)
      return {
        committee,
        votes: vs.length,
        polarisation: pol.reduce((s, x) => s + x, 0) / vs.length,
        contested: (pol.filter((x) => x > 0).length / vs.length) * 100,
        close:
          (vs.filter((v) => calculateVoteMargin(v) < CLOSE_MARGIN).length /
            vs.length) *
          100,
      }
    })
    .sort((a, b) => b.polarisation - a.polarisation)
}

/** Roll calls per calendar month, oldest first. */
export function votesPerMonth(votes: Vote[]): [string, number][] {
  const by = new Map<string, number>()
  for (const v of votes) {
    const m = v.date.slice(0, 7)
    by.set(m, (by.get(m) ?? 0) + 1)
  }
  return [...by].sort((a, b) => a[0].localeCompare(b[0]))
}

/** A party's member votes in all: yes, no, abstain, absent. */
export function partyVoteDistribution(votes: Vote[], party: string) {
  const out = { yes: 0, no: 0, abstain: 0, absent: 0 }
  for (const v of votes) {
    const p = v.parties.find((x) => x.party === party)
    if (!p) continue
    out.yes += p.yes_votes
    out.no += p.no_votes
    out.abstain += p.abstain_votes
    out.absent += p.absent_votes
  }
  return out
}

/**
 * Per committee, how often the party's position differed from the position most members of
 * the other parties' took (their seats-weighted plurality). Only areas with enough roll calls.
 */
export function partyDifferenceByArea(
  votes: Vote[],
  party: string,
  minVotes = 15,
) {
  const by = new Map<string, { n: number; differ: number }>()
  for (const v of votes) {
    const own = positionOf(v, party)
    if (!own) continue
    const others = new Map<string, number>()
    for (const p of v.parties)
      if (p.party !== party && isPosition(p.party_position))
        others.set(
          p.party_position,
          (others.get(p.party_position) ?? 0) + members(p),
        )
    if (!others.size) continue
    const rest = [...others].sort((a, b) => b[1] - a[1])[0][0]
    const row = by.get(v.committee) ?? { n: 0, differ: 0 }
    row.n++
    row.differ += own !== rest ? 1 : 0
    by.set(v.committee, row)
  }
  return [...by]
    .filter(([, r]) => r.n >= minVotes)
    .map(([committee, r]) => ({
      committee,
      votes: r.n,
      pct: (r.differ / r.n) * 100,
    }))
    .sort((a, b) => b.pct - a.pct)
}

/** Share of a debate (or a party's part of it) per topic, largest first, in per cent. */
export function calculateTopicShare(scores: Record<string, number>) {
  const total = Object.values(scores).reduce((s, x) => s + x, 0)
  return Object.entries(scores)
    .map(([key, v]) => ({ key, pct: total ? (v / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)
}

/** Each party's share of the words spoken in a debate, in per cent. */
export function calculateDebateWordShare(
  parties: Record<string, { words: number }>,
) {
  const total = Object.values(parties).reduce((s, p) => s + p.words, 0)
  return Object.entries(parties)
    .map(([party, p]) => ({
      party,
      words: p.words,
      pct: total ? (p.words / total) * 100 : 0,
    }))
    .sort((a, b) => b.words - a.words)
}

export function calculateMemberDeviation(m: {
  compared: number
  deviating: number
}): number {
  return m.compared ? (m.deviating / m.compared) * 100 : 0
}

/** Change in use between two periods, per 10,000 words, as a percentage. */
export function calculateTermGrowth(
  now: number,
  before: number,
): number | null {
  return before > 0 ? ((now - before) / before) * 100 : null
}

/**
 * The parties' voting as a map: each party a vector over the roll calls (yes 1, no −1, abstain
 * or no position 0), centred per roll call, reduced to two principal components. Returns the
 * coordinates and the share of the variance each component explains.
 */
export function votingPCA(votes: Vote[], parties: string[]) {
  const code = (p: Position | null): number =>
    p === 'Ja' ? 1 : p === 'Nej' ? -1 : 0
  const X = parties.map((party) => votes.map((v) => code(positionOf(v, party))))
  const n = parties.length
  const m = votes.length
  for (let j = 0; j < m; j++) {
    let mean = 0
    for (let i = 0; i < n; i++) mean += X[i][j]
    mean /= n
    for (let i = 0; i < n; i++) X[i][j] -= mean
  }
  // The parties' Gram matrix (n × n) has the same non-zero eigenvalues as the covariance.
  const G = X.map((r) => X.map((s) => r.reduce((t, x, k) => t + x * s[k], 0)))
  const total = G.reduce((s, r, i) => s + r[i], 0)
  const components: { vector: number[]; value: number }[] = []
  let A = G.map((r) => [...r])
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: n }, (_, i) => 1 + i * 0.1)
    let value = 0
    for (let it = 0; it < 500; it++) {
      const w = A.map((r) => r.reduce((s, x, k) => s + x * v[k], 0))
      const norm = Math.hypot(...w) || 1
      v = w.map((x) => x / norm)
      value = norm
    }
    components.push({ vector: v, value })
    A = A.map((r, i) => r.map((x, k) => x - value * v[i] * v[k]))
  }
  // A party's score on a component: the eigenvector scaled by the square root of the eigenvalue.
  const points = parties.map((party, i) => ({
    party,
    x: components[0].vector[i] * Math.sqrt(components[0].value),
    y: components[1].vector[i] * Math.sqrt(components[1].value),
  }))
  return {
    points,
    explained: components.map((c) => (total ? (c.value / total) * 100 : 0)),
  }
}
