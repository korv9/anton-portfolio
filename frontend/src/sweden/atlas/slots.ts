/**
 * The atlas's data slots: every file an atlas scene reads, with the shape it expects.
 *
 * A slot is either filled (the file was published and read) or empty. An empty slot is drawn
 * as a ghost (a dashed outline) and listed in the page's DATA drawer with what it needs, never
 * filled with sample values. To fill one, publish the file at `path` with the `shape` below;
 * the scene picks it up on the next load. docs/sweden-atlas.md has the same list.
 */
import { useEffect, useState } from 'react'
import { fetchJson } from '../../dataSource'

export type SlotDef = {
  path: string
  /** What the scene draws from it. */
  role: string
  /** The JSON shape, as the scene reads it. */
  shape: string
  /** Planned source for a slot not yet published. */
  source?: string
}

export const SLOTS = {
  geometry: {
    path: 'sweden/similarity/geometry.json',
    role: 'Municipality boundaries, SWEREF99 TM in 100 m units',
    shape: '{ municipalities: [{ code, rings: [[[x, y], …]] }] }',
  },
  similarity: {
    path: 'sweden/similarity/municipalities.json',
    role: 'Similarity groups, principal components and nearest neighbours',
    shape:
      '{ summary, municipalities: [{ code, name, population, finer, pc: [x, y], neighbours: [[code, distance, km]] }] }',
  },
  similarityGroups: {
    path: 'sweden/similarity/groups.json',
    role: 'C: names of the similarity groups',
    shape: "{ splits: [{ role: 'finer split', names: { '0': [en, sv] } }] }",
  },
  similarityAlternatives: {
    path: 'sweden/similarity/alternatives.json',
    role: 'C, top floor: the same municipalities under another model specification',
    shape:
      '{ specs: [{ id, label, municipalities: [{ code, pc: [x, y], group }] }] }',
    source:
      'A second feature set or scaling run through the same PCA and clustering',
  },
  measurementSummary: {
    path: 'sweden/measurement/summary.json',
    role: 'A: the thirteen domains and their table counts',
    shape:
      '{ domains: [{ id, label_en, scb_tables, kolada_kpis, first_year }] }',
  },
  measurementCoverage: {
    path: 'sweden/measurement/coverage.json',
    role: 'A: tables per domain, year and geography',
    shape: '{ columns: [domain, year, geo, tables], rows: [[…]] }',
  },
  measurementOther: {
    path: 'sweden/measurement/other_catalogues.json',
    role: 'A: rows for catalogues beyond SCB',
    shape:
      '{ catalogues: [{ id, label, domains: [{ domain, decade, items }] }] }',
    source:
      'Socialstyrelsen, Brå, Folkhälsomyndigheten, Myndigheten för kulturanalys',
  },
  languageTrends: {
    path: 'sweden/language/trends.json',
    role: 'B: matches per 1,000 words by category and year',
    shape:
      '{ categories: [{ id, family, label_en, rows: [[year, …, per_1000_words, per_1000_words_standardised]] }] }',
  },
  belonging: {
    path: 'sweden/belonging/municipalities.json',
    role: 'D: availability and participation per municipality and year',
    shape:
      '{ years, rows: [{ code, year, service_points_rate, visits_rate, km2_per_service_point }] }',
  },
  libraries: {
    path: 'sweden/belonging/libraries.json',
    role: 'D: public libraries with coordinates',
    shape: '{ libraries: [{ code, x, y }] }',
  },
  travelTime: {
    path: 'sweden/belonging/travel_time.json',
    role: 'D, accessibility floor: travel time instead of area per service point',
    shape: '{ year, unit: "minutes", rows: [{ code, minutes }] }',
    source:
      'Travel time to the nearest staffed library, from a routing dataset',
  },
  belongingSurvey: {
    path: 'sweden/belonging/belonging.json',
    role: 'D, belonging floor: a measure of experienced belonging',
    shape: '{ source, measure, year, rows: [{ code, value }] }',
    source:
      'A survey with municipal estimates (e.g. SOM-institutet, Folkhälsomyndigheten)',
  },
  futures: {
    path: 'sweden/futures/trends.json',
    role: 'E: theme shares for the Riksdag and DiVA',
    shape:
      '{ themes: [{ id, label_en, rows: [[year, …, future_share_using, …]] }], academic: { themes: { id: [[year, share]] } } }',
  },
  futuresSou: {
    path: 'sweden/futures/sou.json',
    role: 'E: a third corpus, Swedish Government Official Reports',
    shape: '{ label, period, themes: { id: [[year, share]] } }',
    source: 'SOU reports, counted with the same dictionary',
  },
  connections: {
    path: 'sweden/connections/connections.json',
    role: 'Connections: tested and rejected relationships',
    shape:
      '{ relationships: [{ id, products, question, assessment, result: { rho, ci95 } }], rejected: [{ id, products, reason }] }',
  },
} satisfies Record<string, SlotDef>

export type SlotKey = keyof typeof SLOTS
export type SlotState = {
  key: SlotKey
  status: 'loading' | 'filled' | 'empty'
  data: unknown
}

/** Reads the given slots once. A file that is missing or unreadable leaves its slot empty. */
export function useSlots(keys: SlotKey[]) {
  const id = keys.join(',')
  const [states, setStates] = useState<Record<string, SlotState>>(() =>
    Object.fromEntries(
      keys.map((key) => [key, { key, status: 'loading', data: null }]),
    ),
  )
  useEffect(() => {
    let live = true
    for (const key of id.split(',') as SlotKey[])
      fetchJson<unknown>(SLOTS[key].path).then(
        (data) =>
          live &&
          setStates((s) => ({ ...s, [key]: { key, status: 'filled', data } })),
        () =>
          live &&
          setStates((s) => ({
            ...s,
            [key]: { key, status: 'empty', data: null },
          })),
      )
    return () => {
      live = false
    }
  }, [id])
  const loading = Object.values(states).some((s) => s.status === 'loading')
  return { states, loading }
}

/** The data of a filled slot, typed by the reader. */
export function slot<T>(
  states: Record<string, SlotState>,
  key: SlotKey,
): T | null {
  const s = states[key]
  return s?.status === 'filled' ? (s.data as T) : null
}
