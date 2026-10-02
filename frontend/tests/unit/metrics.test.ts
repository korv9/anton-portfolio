/**
 * The politics story's metrics on small hand-made roll calls, where the right answer can be
 * worked out by hand, and on the real 2025/26 roll calls for properties that must always hold.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  calculateAreaPolarisation,
  calculateMemberDeviation,
  calculatePartyCohesion,
  calculatePartySimilarity,
  calculatePolarisation,
  calculateTermGrowth,
  calculateVoteMargin,
  cleanVotes,
  partyDifferenceByArea,
  votesPerMonth,
  votingPCA,
} from '../../src/politik/analytics/metrics.ts'
import type { Vote } from '../../src/politik/analytics/types.ts'

const party = (
  p: string,
  pos: string | null,
  yes: number,
  no: number,
  abstain = 0,
  absent = 0,
) => ({
  party: p,
  party_position: pos,
  yes_votes: yes,
  no_votes: no,
  abstain_votes: abstain,
  absent_votes: absent,
})
const vote = (
  id: string,
  parties: Vote['parties'],
  committee = 'FiU',
  date = '2025-10-01',
): Vote => ({
  id,
  title: id,
  heading: '',
  designation: `${committee}1`,
  date,
  path: '',
  point: 1,
  committee,
  session: '2025/26',
  parties,
})

// A: all agree. B: A and B yes, C no. C: three positions.
const A = vote('a', [
  party('A', 'Ja', 60, 0),
  party('B', 'Ja', 30, 0),
  party('C', 'Ja', 10, 0),
])
const B = vote(
  'b',
  [party('A', 'Ja', 60, 0), party('B', 'Ja', 28, 2), party('C', 'Nej', 0, 10)],
  'JuU',
  '2025-11-03',
)
const C = vote(
  'c',
  [
    party('A', 'Ja', 60, 0),
    party('B', 'Nej', 0, 30),
    party('C', 'Avstår', 0, 0, 10),
  ],
  'JuU',
  '2025-11-20',
)

test('polarisation: zero when all agree, the minority share when not', () => {
  assert.equal(calculatePolarisation(A), 0)
  // 10 of 100 members with the other position; 40 of 100 outside the largest group.
  assert.ok(Math.abs(calculatePolarisation(B) - 0.1) < 1e-9)
  assert.ok(Math.abs(calculatePolarisation(C) - 0.4) < 1e-9)
})

test('similarity: the share of roll calls with the same position', () => {
  const sim = calculatePartySimilarity([A, B, C], ['A', 'B', 'C'])
  const get = (a: string, b: string) => sim.find((s) => s.a === a && s.b === b)!
  assert.equal(get('A', 'A').pct, 100)
  assert.equal(Math.round(get('A', 'B').pct), 67)
  assert.equal(Math.round(get('A', 'C').pct), 33)
  assert.equal(get('A', 'B').pct, get('B', 'A').pct)
})

test('cohesion: cast votes with the party position, of all cast votes', () => {
  const [, b] = calculatePartyCohesion([A, B, C], ['A', 'B'])
  assert.equal(b.cast, 90)
  assert.equal(Math.round(b.pct * 10) / 10, 97.8) // 88 of 90
})

test('margin, areas and months', () => {
  assert.equal(calculateVoteMargin(A), 100)
  assert.equal(Math.round(calculateVoteMargin(B)), 76) // (88−12)/100
  const areas = calculateAreaPolarisation([A, B, C])
  assert.equal(areas[0].committee, 'JuU')
  assert.equal(areas[0].contested, 100)
  assert.deepEqual(votesPerMonth([A, B, C]), [
    ['2025-10', 1],
    ['2025-11', 2],
  ])
})

test('cleaning drops duplicates, roll calls without positions and with few votes', () => {
  const none = vote('n', [party('A', null, 50, 50)])
  const few = vote('f', [party('A', 'Ja', 10, 0)])
  const { votes, quality } = cleanVotes([A, A, none, few, B])
  assert.deepEqual(
    votes.map((v) => v.id),
    ['a', 'b'],
  )
  assert.equal(quality.duplicates, 1)
  assert.equal(quality.withoutPositions, 1)
  assert.equal(quality.fewVotes, 1)
})

test('member deviation and term growth', () => {
  assert.equal(calculateMemberDeviation({ compared: 200, deviating: 3 }), 1.5)
  assert.equal(calculateMemberDeviation({ compared: 0, deviating: 0 }), 0)
  assert.equal(calculateTermGrowth(3, 1), 200)
  assert.equal(calculateTermGrowth(3, 0), null)
})

test('on the real roll calls: shares stay in range, the matrix is symmetric', () => {
  const rows = JSON.parse(
    readFileSync(
      new URL(
        '../../public/data/politics/decisions/2025-26/index.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).map((r: Omit<Vote, 'session'>) => ({ ...r, session: '2025/26' }))
  const { votes, quality } = cleanVotes(rows)
  assert.ok(quality.kept > 500)
  const parties = ['S', 'SD', 'M', 'V', 'C', 'KD', 'MP', 'L']
  const sim = calculatePartySimilarity(votes, parties)
  for (const s of sim) {
    assert.ok(s.pct >= 0 && s.pct <= 100)
    const back = sim.find((x) => x.a === s.b && x.b === s.a)!
    assert.equal(s.pct, back.pct)
  }
  for (const c of calculatePartyCohesion(votes, parties))
    assert.ok(c.pct > 50 && c.pct <= 100)
  const diff = partyDifferenceByArea(votes, 'V')
  assert.ok(diff.length > 3)
  const pca = votingPCA(votes, parties)
  assert.equal(pca.points.length, 8)
  assert.ok(pca.explained[0] >= pca.explained[1])
  assert.ok(pca.explained[0] + pca.explained[1] <= 100.0001)
})
