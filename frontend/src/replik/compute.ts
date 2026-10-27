/**
 * Replik's numbers, read from the committed files at load time. Nothing on the page is typed in
 * by hand: every finding is one of these functions over the JSON it names.
 */

/** The eight parties of today's Riksdag, in alphabetical order, so no party leads. */
export const PARTIES = ['C', 'KD', 'L', 'M', 'MP', 'S', 'SD', 'V'] as const

// ---------------------------------------------------------------- clusters/debate-topics.json

/** [clustering, period, segment, cluster, share, low, high, passages] */
type ShareRow = [string, string, string, number, number, number, number, number]
export type DebateTopics = {
  clusters: { id: number; name: [string | null, string | null]; size: number }[]
  diagnostics: { n: number; noise_share: number; seed_ari: { mean: number } }
  bge_m3: { topics: { cluster: number; jaccard: number; rho_yearly: number }[] }
  shares: { rows: ShareRow[] }
}
export type Share = {
  period: string
  value: number
  low: number
  high: number
  passages: number
}

const share = (r: ShareRow): Share => ({
  period: r[1],
  value: r[4],
  low: r[5],
  high: r[6],
  passages: r[7],
})

/** The topic ids with no model-made name: they get neutral labels, never a number. */
export const unnamed = (d: DebateTopics) =>
  d.clusters.filter((c) => !c.name[0]).map((c) => c.id)

/** A topic's [en, sv] name; an unnamed group is described, not numbered. */
export function topicName(d: DebateTopics, id: number): [string, string] {
  const c = d.clusters.find((x) => x.id === id)
  if (c?.name[0]) return [c.name[0], c.name[1] ?? c.name[0]]
  return unnamed(d).indexOf(id) === 0
    ? [
        'Broad exchanges, no single theme',
        'Breda replikskiften, inget enskilt tema',
      ]
    : ['Other passages, no single theme', 'Övriga inlägg, inget enskilt tema']
}

export const topicId = (d: DebateTopics, en: string) =>
  d.clusters.find((c) => c.name[0] === en)?.id ?? -1

/** All-party share of one topic per calendar year. */
export const yearly = (d: DebateTopics, id: number) =>
  d.shares.rows
    .filter((r) => r[0] === 'debate-topics' && r[2] === 'all' && r[3] === id)
    .map(share)
    .sort((a, b) => a.period.localeCompare(b.period))

/** One party's share of one topic per decade ('1990', '2000', …). */
export const byDecade = (d: DebateTopics, party: string, id: number) =>
  d.shares.rows
    .filter(
      (r) => r[0] === 'debate-topics-party' && r[2] === party && r[3] === id,
    )
    .map(share)
    .sort((a, b) => a.period.localeCompare(b.period))

export const decades = (d: DebateTopics) =>
  [
    ...new Set(
      d.shares.rows
        .filter((r) => r[0] === 'debate-topics-party')
        .map((r) => r[1]),
    ),
  ].sort()

/** A year with under 60 % of the median year's passages is partial (the running year). */
export function partialYears(series: Share[]) {
  const sorted = series.map((s) => s.passages).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  return new Set(
    series.filter((s) => s.passages < 0.6 * median).map((s) => s.period),
  )
}

/** R1: the topic's peak year, its range in the years before, and the last full year. */
export function peak(series: Share[]) {
  const partial = partialYears(series)
  const full = series.filter((s) => !partial.has(s.period))
  if (full.length < 3) return null
  const top = full.reduce((a, b) => (b.value > a.value ? b : a))
  const before = full.filter((s) => s.period < top.period)
  if (!before.length) return null
  const values = before.map((s) => s.value)
  return {
    top,
    from: before[0].period,
    to: before.at(-1)!.period,
    min: Math.min(...values),
    max: Math.max(...values),
    last: full.at(-1)!,
  }
}

/** One party's topic profile in a decade: the five largest topics and its most distinctive one. */
export function profile(d: DebateTopics, decade: string, party: string) {
  const rows = d.shares.rows.filter(
    (r) => r[0] === 'debate-topics-party' && r[1] === decade,
  )
  const mine = rows.filter((r) => r[2] === party)
  if (!mine.length) return null
  const top = [...mine]
    .sort((a, b) => b[4] - a[4])
    .slice(0, 5)
    .map((r) => ({ id: r[3], ...share(r) }))
  // Distinctive: the named topic of at least 3 % with the largest ratio to the other
  // parties' mean share in the same decade (half a point added to both, against noise).
  const none = new Set(unnamed(d))
  let best: { id: number; value: number; ratio: number } | null = null
  for (const r of mine) {
    if (none.has(r[3]) || r[4] < 0.03) continue
    const others = rows.filter((o) => o[2] !== party && o[3] === r[3])
    if (!others.length) continue
    const mean = others.reduce((a, o) => a + o[4], 0) / others.length
    const ratio = (r[4] + 0.005) / (mean + 0.005)
    if (!best || ratio > best.ratio) best = { id: r[3], value: r[4], ratio }
  }
  return { top, distinctive: best, passages: mine[0][7] }
}

/** R2: the party that led a topic in one decade, against every other party's range. */
export function decadeLead(d: DebateTopics, decade: string, id: number) {
  const rows = PARTIES.flatMap((p) => {
    const s = byDecade(d, p, id).find((x) => x.period === decade)
    return s ? [{ party: p, ...s }] : []
  }).sort((a, b) => b.value - a.value)
  if (rows.length < 3) return null
  const rest = rows.slice(1).map((r) => r.value)
  return {
    rows,
    lead: rows[0],
    second: rows[1],
    min: Math.min(...rest),
    max: Math.max(...rest),
    overlap: rows[1].high >= rows[0].low,
  }
}

// ---------------------------------------------------------------- clusters/riksdag-eras.json

export type Eras = {
  clusters: {
    sessions: string[]
    top_topics: [number, string, number, number][]
  }[]
  breaks: number[]
  diagnostics: {
    bootstrap_ari: { mean: number }
    null: { p: number }
    ami_reference: { government: number }
  }
  topic_shares: {
    sessions: string[]
    topics: [number, string][]
    rows: number[][]
  }
}

/** Each era's most over-represented topic, as rows of a topic × era grid of mean shares. */
export function eraGrid(d: Eras) {
  const { sessions, topics, rows } = d.topic_shares
  const col = new Map(topics.map(([id], i) => [id, i]))
  const eras = d.clusters
    .map((c) => ({
      name: `${c.sessions[0]?.slice(0, 4)}–${c.sessions.at(-1)?.slice(-2)}`,
      rows: c.sessions.map((s) => rows[sessions.indexOf(s)]).filter(Boolean),
    }))
    .filter((e) => e.rows.length)
  const ids = [...new Set(d.clusters.map((c) => c.top_topics[0]?.[0]))].filter(
    (id) => col.has(id),
  )
  const label = new Map(topics.map(([id, words]) => [id, words]))
  const cells = ids.map((id) =>
    eras.map(
      (e) => e.rows.reduce((a, r) => a + r[col.get(id)!], 0) / e.rows.length,
    ),
  )
  return { eras, ids, label, cells }
}

// ---------------------------------------------------------------- parliament/sessions.json

export type Sessions = {
  sessions: { session: string; roll_calls: number; last_vote: string }[]
  party_record: {
    session: string
    party: string
    role: string
    roll_calls: number
    with_government_pct: number
    abstained_pct: number
  }[]
}

export const record = (d: Sessions, party: string) =>
  d.party_record.filter((r) => r.party === party)

/** R5: the party outside government that voted with it most in the latest session. */
export function closestOutsider(d: Sessions) {
  const last = d.sessions.at(-1)?.session
  const outside = d.party_record.filter(
    (r) => r.session === last && r.role !== 'government',
  )
  if (!outside.length) return null
  const now = outside.reduce((a, b) =>
    b.with_government_pct > a.with_government_pct ? b : a,
  )
  const rows = record(d, now.party)
  const before = rows[rows.indexOf(now) - 1]
  const opposition = rows.filter((r) => r.role === 'opposition')
  if (!before || !opposition.length) return null
  const values = opposition.map((r) => r.with_government_pct)
  return {
    now,
    before,
    from: opposition[0].session,
    to: opposition.at(-1)!.session,
    min: Math.min(...values),
    max: Math.max(...values),
    lastVote: d.sessions.at(-1)!.last_vote,
  }
}

// ---------------------------------------------------------------- clusters/talk-vote.json

export type TalkVote = {
  sessions: unknown[]
  diagnostics: { null: { observed: number; p: number } }
}

// ---------------------------------------------------------------- ml/polarization.json

export type Polar = {
  sessions: {
    session: string
    within_debate_auc: number
    governing_parties: string[]
    permutation_p: number
  }[]
}

/** Consecutive sessions with the same governing parties, with the same-debate AUC of each. */
export function governments(d: Polar) {
  const blocks: {
    parties: string
    from: number
    to: number
    values: number[]
  }[] = []
  d.sessions.forEach((s, i) => {
    const parties = [...s.governing_parties].sort().join(', ')
    const last = blocks.at(-1)
    if (last && last.parties === parties) {
      last.to = i
      last.values.push(s.within_debate_auc)
    } else
      blocks.push({ parties, from: i, to: i, values: [s.within_debate_auc] })
  })
  return blocks.map((b) => ({
    ...b,
    first: d.sessions[b.from].session,
    last: d.sessions[b.to].session,
    mean: b.values.reduce((a, v) => a + v, 0) / b.values.length,
    min: Math.min(...b.values),
    max: Math.max(...b.values),
  }))
}

/** R4: the change of government after which the same-debate AUC rose the most. */
export function biggestStep(d: Polar) {
  const blocks = governments(d).filter((b) => b.values.length >= 3)
  let best: [(typeof blocks)[number], (typeof blocks)[number]] | null = null
  for (let i = 1; i < blocks.length; i++)
    if (
      !best ||
      blocks[i].mean - blocks[i - 1].mean > best[1].mean - best[0].mean
    )
      best = [blocks[i - 1], blocks[i]]
  return best
}

// ---------------------------------------------------------------- ai-act/politics/*

export type PartyYear = {
  party: string
  year: number
  speeches: number
  ai_speeches: number
}[]

/** Share of speeches (in percent) that mention AI, per year, over the given parties. */
export function aiByYear(d: PartyYear, party?: string) {
  const by = new Map<number, [number, number]>()
  for (const r of d) {
    if (party && r.party !== party) continue
    const t = by.get(r.year) ?? [0, 0]
    by.set(r.year, [t[0] + r.ai_speeches, t[1] + r.speeches])
  }
  return [...by]
    .sort((a, b) => a[0] - b[0])
    .map(([year, [ai, n]]) => ({ year, value: n ? (100 * ai) / n : 0, n }))
}

/** Each party's AI share (in percent) over the years from `from` on. */
export function aiSince(d: PartyYear, from: number) {
  return PARTIES.map((party) => {
    const rows = d.filter((r) => r.party === party && r.year >= from)
    const ai = rows.reduce((a, r) => a + r.ai_speeches, 0)
    const n = rows.reduce((a, r) => a + r.speeches, 0)
    return { party, value: n ? (100 * ai) / n : 0 }
  })
}

// ---------------------------------------------------------------- politics/parliament/story.json

type Term = { stem: string; word: string; now: number; before: number }
export type Story = {
  leader_debates: { date: string }[]
  terms: {
    rising: Term[]
    falling: Term[]
    now: string
    before: string[]
    words_now: number
    words_before: number
  }
}

/** Word-processor field codes that survive in some protocols (politics_story.py ARTIFACTS). */
const ARTIFACTS = [
  'mergeformat',
  'styleref',
  'kantrubrik',
  'charformat',
  'pageref',
  'hyperlink',
]
export const clean = (terms: Term[]) =>
  terms.filter(
    (t) => !ARTIFACTS.some((a) => t.stem.includes(a) || t.word.includes(a)),
  )
