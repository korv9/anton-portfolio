/** Pure helpers for the Concept Constellation and the concept pages (unit-tested). */
import type { Concept, ConceptRelation, Profile } from './types'

export const FAMILIES = [
  'moral',
  'political',
  'regulatory',
  'social',
  'epistemic',
  'symbolic',
] as const

/** The corpora in the order of the chain: stories, ideas, contestation, codification. */
export const CORPUS_ORDER = ['myth', 'philosophy', 'politics', 'law']

/** `#concept-autonomy` -> 'autonomy'; the constellation and its sections -> null. */
export function conceptFromPath(path: string): string | null {
  if (!path.startsWith('#concept-') || path === '#concept-constellation')
    return null
  return path.slice('#concept-'.length) || null
}

export type Placed = {
  id: string
  family: string
  angle: number
  x: number
  y: number
}

/**
 * Concepts on a circle, grouped by family with a gap between families, in the seed's order
 * within a family. Coordinates in a 0–100 box centred on 50,50.
 */
export function radialLayout(
  concepts: Concept[],
  radius = 38,
  gap = 1,
): Placed[] {
  const ordered = FAMILIES.flatMap((f) =>
    concepts.filter((c) => c.family === f),
  ).concat(
    concepts.filter((c) => !(FAMILIES as readonly string[]).includes(c.family)),
  )
  const families = new Set(ordered.map((c) => c.family)).size
  const slots = ordered.length + families * gap
  const out: Placed[] = []
  let slot = 0
  let previous: string | null = null
  for (const c of ordered) {
    if (previous !== null && c.family !== previous) slot += gap
    previous = c.family
    const angle = (slot / slots) * 2 * Math.PI - Math.PI / 2
    out.push({
      id: c.concept_id,
      family: c.family,
      angle,
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    })
    slot += 1
  }
  return out
}

/** The corpora on a small inner square, in chain order clockwise from the top left. */
export function corpusPositions(
  corpora: string[],
  radius = 13,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {}
  corpora.forEach((c, i) => {
    const angle = -Math.PI * 0.75 + (i * Math.PI) / 2
    out[c] = {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    }
  })
  return out
}

/** A concept's profile across the corpora, in chain order. */
export function profileOf(profiles: Profile[], concept: string): Profile[] {
  return CORPUS_ORDER.map((c) =>
    profiles.find((p) => p.concept_id === concept && p.corpus_id === c),
  ).filter((p): p is Profile => p != null)
}

/** Concept–corpus links where the concept is a chunk's closest at least `lift` times chance. */
export function prominent(profiles: Profile[], lift = 2): Profile[] {
  return profiles.filter((p) => p.rank1_lift >= lift)
}

/** The relations touching a concept, with the other concept first. */
export function relationsOf(
  relations: ConceptRelation[],
  concept: string,
): { other: string; relation: ConceptRelation }[] {
  return relations
    .filter((r) => r.concept_a === concept || r.concept_b === concept)
    .map((r) => ({
      other: r.concept_a === concept ? r.concept_b : r.concept_a,
      relation: r,
    }))
}

export const pct = (v: number, digits = 0) =>
  `${(v * 100).toFixed(digits).replace('.', ',')} %`
