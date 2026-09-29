/**
 * Allegoria, the evidence layer: every claim is checked against the passages it cites and gets
 * one of six labels. The model proposes, this code decides; nothing here calls a model, so the
 * same answer always gets the same labels.
 *
 * - Direkt belagt: a quote found word for word in its source, or numbers stated by a source.
 * - Beräknat: a number derived from source values (a difference, a sum), or a figure the site
 *   computed from the votes.
 * - Sammanfattning: the claim's content words are in its sources, but not word for word.
 * - Tolkning: the claim goes beyond the sources (analytic wording, or low overlap).
 * - Otillräckligt underlag: no source, a quote or number the sources do not hold, or a claim of
 *   change over time without a reviewed annotation.
 * - Motstridiga källor: two sources give different values for the same fact.
 */
import { normalizeQuote, numbers, overlap, sameNumber } from './text.ts'
import type {
  Annotation,
  Certainty,
  CheckedClaim,
  Claim,
  Label,
  Passage,
  Stats,
} from './types.ts'

const ANALYTIC =
  /tyder på|visar att|innebär att|sannolikt|troligen|verkar|förmodligen|pekar på|kan tolkas|strategi|syftar till|i praktiken|framstår/i

const CHANGE =
  /skärp|lättade|lättat|lättnad|strängare|mildare|mildra|hårdare|mjukare|försvag|förstärk|svängt|omsväng|ändrat (sin|hållning|linje)/i

/** Figures the site computes from individual votes, not stated by any one document. */
const COMPUTED_KINDS = new Set(['agreement', 'record'])

type NumberCheck = { stated: number; found: boolean; derived: boolean }

function valuesOf(passage: Passage): number[] {
  // The heading counts too: a claim may name the debate, and its title can hold numbers.
  return [
    ...Object.values(passage.values ?? {}),
    ...numbers(passage.text),
    ...numbers(passage.title),
  ]
}

function statedIn(n: number, values: number[]): boolean {
  return values.some(
    (v) =>
      sameNumber(n, v) ||
      sameNumber(Math.abs(n), Math.abs(v)) ||
      // "5 miljarder" for 5 035 mnkr.
      (Math.abs(n) < 10_000 &&
        Math.abs(v) >= 1000 &&
        sameNumber(Math.abs(n) * 1000, Math.abs(v))),
  )
}

function derivable(n: number, values: number[]): boolean {
  for (let i = 0; i < values.length; i++)
    for (let j = 0; j < values.length; j++) {
      if (i === j) continue
      const a = values[i]
      const b = values[j]
      if (statedIn(n, [a - b, a + b])) return true
    }
  return false
}

/** The same fact about the same party in the same period. */
function factKey(p: Passage): string | null {
  if (p.kind !== 'datapoint' || !p.factKind) return null
  const id = p.id.replace(/^dp:/, '')
  return `${p.factKind}:${id}`
}

/** Facts that two retrieved passages state with different values. */
export function conflicts(passages: Passage[]): Map<string, string[]> {
  const seen = new Map<string, Passage[]>()
  for (const p of passages) {
    const key = factKey(p)
    if (!key) continue
    seen.set(key, [...(seen.get(key) ?? []), p])
  }
  const out = new Map<string, string[]>()
  for (const [key, group] of seen) {
    const variants = new Set(group.map((p) => JSON.stringify(p.values ?? {})))
    if (variants.size > 1)
      out.set(
        key,
        group.map((p) => p.id),
      )
  }
  return out
}

export function checkClaim(
  claim: Claim,
  passages: Map<string, Passage>,
  conflicting: Map<string, string[]>,
  annotations: Annotation[] = [],
): CheckedClaim {
  const notes: string[] = []
  const unknown = claim.sources.filter((id) => !passages.has(id))
  if (unknown.length) notes.push(`Okänd källa: ${unknown.join(', ')}`)
  const sources = claim.sources
    .map((id) => passages.get(id))
    .filter((p): p is Passage => !!p)
  const done = (label: Label, support: number): CheckedClaim => ({
    ...claim,
    label,
    support: Math.round(support * 100) / 100,
    notes,
  })
  if (!sources.length) {
    notes.push('Påståendet vilar inte på någon hämtad källa.')
    return done('insufficient', 0)
  }

  const evidence = sources
    .map((p) =>
      [p.text, p.title, p.speaker ?? '', p.date ?? '', p.session ?? ''].join(
        ' ',
      ),
    )
    .join(' ')
  // The quote is checked word for word below; the rest of the claim by overlap.
  const prose = claim.quote ? claim.text.replace(claim.quote, ' ') : claim.text
  const support = overlap(prose, evidence)

  const clash = sources.filter((p) => {
    const key = factKey(p)
    return key && conflicting.has(key)
  })
  if (clash.length) {
    notes.push(
      `Källorna ger olika värden för ${clash.map((p) => p.id).join(', ')}.`,
    )
    return done('conflict', support)
  }

  if (claim.quote) {
    const quote = normalizeQuote(claim.quote)
    const holder = sources.find((p) => normalizeQuote(p.text).includes(quote))
    if (!holder) {
      notes.push('Citatet finns inte ordagrant i den angivna källan.')
      return done('insufficient', support)
    }
    notes.push(`Citatet finns ordagrant i ${holder.id}.`)
  }

  if (!claim.quote && CHANGE.test(claim.text)) {
    const reviewed = annotations.some((a) =>
      a.about.some((id) => claim.sources.includes(id)),
    )
    if (!reviewed) {
      notes.push(
        'Påståendet beskriver en förändring över tid; sådana visas bara med en granskad annotering, och ingen finns för dessa källor.',
      )
      return done('insufficient', support)
    }
    notes.push('Förändringen stöds av en granskad annotering.')
  }

  const values = sources.flatMap(valuesOf)
  const checks: NumberCheck[] = numbers(prose).map((stated) => {
    const found = statedIn(stated, values)
    return { stated, found, derived: !found && derivable(stated, values) }
  })
  const missing = checks.filter((c) => !c.found && !c.derived)
  if (missing.length) {
    notes.push(
      `Talet ${missing.map((c) => String(c.stated).replace('.', ',')).join(', ')} finns inte i källorna och kan inte räknas fram ur dem.`,
    )
    return done('insufficient', support)
  }
  if (claim.quote && !checks.length) return done('direct', 1)
  if (checks.some((c) => c.derived)) {
    notes.push(
      'Talet räknas fram ur källornas värden' +
        (claim.formula ? ` (${claim.formula}).` : '.'),
    )
    return done('computed', support)
  }

  if (claim.type === 'interpretation' || ANALYTIC.test(prose)) {
    if (support < 0.2) {
      notes.push('Tolkningen har för lite stöd i källorna.')
      return done('insufficient', support)
    }
    notes.push(
      'Formulerat som en tolkning av källorna, inte som ett faktum i dem.',
    )
    return done('interpretation', support)
  }

  if (checks.length) {
    if (support < 0.4) {
      notes.push(
        'Siffrorna finns i källan men resten av påståendet stöds svagt.',
      )
      return done('interpretation', support)
    }
    if (sources.every((p) => p.factKind && COMPUTED_KINDS.has(p.factKind))) {
      notes.push(
        'Andelen är beräknad ur enskilda voteringar av webbplatsens pipeline.',
      )
      return done('computed', support)
    }
    notes.push('Siffrorna står i källan.')
    return done('direct', support)
  }

  if (support >= 0.5) {
    notes.push(
      sources.length > 1
        ? `Sammanfattar ${sources.length} källor.`
        : 'Återger källan med andra ord.',
    )
    return done('summary', support)
  }
  if (support >= 0.2) {
    notes.push('Går utöver vad källan säger.')
    return done('interpretation', support)
  }
  notes.push('Källan stöder inte påståendet.')
  return done('insufficient', support)
}

export function checkAll(
  claims: Claim[],
  passages: Passage[],
  annotations: Annotation[] = [],
): { claims: CheckedClaim[]; conflicts: string[] } {
  const byId = new Map(passages.map((p) => [p.id, p]))
  const conflicting = conflicts(passages)
  return {
    claims: claims.map((c) => checkClaim(c, byId, conflicting, annotations)),
    conflicts: [...conflicting.entries()].map(
      ([key, ids]) => `${key}: ${ids.join(' mot ')}`,
    ),
  }
}

export function stats(retrieved: number, claims: CheckedClaim[]): Stats {
  const count = (label: Label) => claims.filter((c) => c.label === label).length
  return {
    retrieved,
    checked: claims.length,
    direct: count('direct'),
    computed: count('computed'),
    summary: count('summary'),
    interpretation: count('interpretation'),
    insufficient: count('insufficient'),
    conflict: count('conflict'),
  }
}

export function certainty(s: Stats): Certainty {
  if (!s.checked) return 'Låg'
  const weak = s.insufficient + s.conflict
  if (s.conflict || weak / s.checked >= 0.5) return 'Låg'
  if (!weak && (s.direct + s.computed) / s.checked >= 0.6) return 'Hög'
  return 'Medel'
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

export function statsLine(s: Stats): string {
  const parts = [
    plural(s.retrieved, 'källa hämtad', 'källor hämtade'),
    plural(s.checked, 'påstående kontrollerat', 'påståenden kontrollerade'),
  ]
  if (s.direct)
    parts.push(`${s.direct} direkt ${s.direct === 1 ? 'stött' : 'stödda'}`)
  if (s.computed) parts.push(plural(s.computed, 'beräknat', 'beräknade'))
  if (s.summary)
    parts.push(plural(s.summary, 'sammanfattning', 'sammanfattningar'))
  if (s.interpretation)
    parts.push(
      plural(s.interpretation, 'analytisk tolkning', 'analytiska tolkningar'),
    )
  if (s.insufficient) parts.push(`${s.insufficient} utan tillräckligt underlag`)
  if (s.conflict) parts.push(plural(s.conflict, 'motstridigt', 'motstridiga'))
  return parts.join(' · ')
}
