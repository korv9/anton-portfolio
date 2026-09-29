/**
 * The learned issue lexicon on the site: scoring a text by the stems that set each issue area
 * apart (platform/nlp/issue_lexicon.py). No imports but the stemmer, so the unit tests can run
 * it directly.
 */
import { stem } from './stem.ts'

export type Lexicon = {
  stop: string[]
  stop_stems: string[]
  min_length: number
  areas: Record<string, Record<string, number>>
}
let lexicon: {
  stop: Set<string>
  stopStems: Set<string>
  min: number
  areas: [string, Record<string, number>][]
  known: Set<string>
  heads: string[]
} | null = null

export const lexiconReady = () => lexicon !== null

/** Use a lexicon already in hand (the unit tests read it from disk). */
export function setIssueLexicon(l: Lexicon) {
  const areas = Object.entries(l.areas)
  const known = new Set(areas.flatMap(([, w]) => Object.keys(w)))
  lexicon = {
    stop: new Set(l.stop),
    stopStems: new Set(l.stop_stems),
    min: l.min_length,
    areas,
    known,
    heads: [...known]
      .filter((s) => s.length >= 4)
      .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0)),
  }
}

/** Area scores for a text: each stem's weight (or its compound head's), times 1 + log count. */
export function issueScores(text: string): Map<string, number> {
  const scores = new Map<string, number>()
  if (!lexicon) return scores
  const counts = new Map<string, number>()
  for (const word of text.toLowerCase().match(/[a-zåäöéü]+/g) ?? []) {
    if (word.length < lexicon.min || lexicon.stop.has(word)) continue
    const s = stem(word)
    if (s.length < 3 || lexicon.stopStems.has(s)) continue
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  for (const [s, n] of counts) {
    let hit: string | undefined = lexicon.known.has(s) ? s : undefined
    if (!hit && s.length >= 7)
      hit = lexicon.heads.find((h) => s.endsWith(h) && s.length - h.length >= 3)
    if (!hit) continue
    const factor = 1 + Math.log(n)
    for (const [area, weights] of lexicon.areas) {
      const w = weights[hit]
      if (w) scores.set(area, (scores.get(area) ?? 0) + w * factor)
    }
  }
  return scores
}
