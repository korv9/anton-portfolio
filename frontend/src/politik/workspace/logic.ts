import type { Cohesion, Pair } from './data'

export type Context = {
  riksmote: string
  fran: string
  till: string
  omrade: string
  regering: string
}
export const CONTEXT_DEFAULTS: Context = {
  riksmote: '',
  fran: '1993',
  till: '',
  omrade: '',
  regering: '',
}

export function inContext(
  row: {
    session: string
    issue_key?: string | null
    government_key?: string | null
  },
  view: Context,
) {
  const year = Number(row.session.slice(0, 4))
  const from = /^\d{4}$/.test(view.fran) ? Number(view.fran) : 1993
  const to = /^\d{4}$/.test(view.till) ? Number(view.till) : Infinity
  return (
    year >= from &&
    year <= to &&
    (!view.riksmote || row.session === view.riksmote) &&
    (!view.omrade || row.issue_key === view.omrade) &&
    (!view.regering || row.government_key === view.regering)
  )
}

export function aggregatePairs(rows: Pair[]) {
  const grouped = new Map<string, Pair>()
  for (const row of rows) {
    const key = [row.party_a, row.party_b].sort().join('|')
    const before = grouped.get(key)
    grouped.set(key, {
      ...row,
      compared: (before?.compared ?? 0) + row.compared,
      same: (before?.same ?? 0) + row.same,
    })
  }
  return [...grouped.values()].map((row) => ({
    ...row,
    pct: row.compared ? (100 * row.same) / row.compared : null,
  }))
}

export function aggregateCohesion(rows: Cohesion[]) {
  const grouped = new Map<string, Cohesion>()
  const counts = [
    'roll_calls',
    'eligible',
    'present',
    'abstain_votes',
    'comparable_cast',
    'aligned_cast',
    'mixed_roll_calls',
    'pm_compared',
    'pm_same',
  ] as const
  for (const row of rows) {
    const previous = grouped.get(row.party)
    const next = { ...row }
    for (const key of counts) next[key] += previous?.[key] ?? 0
    grouped.set(row.party, next)
  }
  return [...grouped.values()]
}

/** Carry only compatible filters; a session filter must not imply a survey date. */
export function workspaceHref(
  path: string,
  params: URLSearchParams,
  changes: Record<string, string> = {},
) {
  const next = new URLSearchParams()
  for (const key of [
    'partier',
    'fran',
    'till',
    'riksmote',
    'omrade',
    'regering',
  ]) {
    const value = params.get(key)
    if (value) next.set(key, value)
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return `${path}${next.size ? '?' + next : ''}`
}
