/**
 * Claims: what the answer asserts, each tied to the passages it rests on.
 *
 * Two sources of claims share one shape. Without a model, the extractor states the retrieved
 * facts, computes differences between them and quotes the most relevant sentences of the
 * speeches. With a model (llm.ts), the prompt and JSON schema below ask for the same thing in
 * better prose. Either way Allegoria checks every claim afterwards.
 */
import { PARTY_NAMES, topicTokens } from './entities.ts'
import { sentences, tokens } from './text.ts'
import type { Claim, Entities, Passage } from './types.ts'

/** `model` names the model that actually answered, when one did. */
export type ClaimSet = { lead: string; claims: Claim[]; model?: string }

export interface ClaimModel {
  readonly name: string
  claims(question: string, passages: Passage[]): Promise<ClaimSet>
}

/** The main value of a fact and its unit, for comparisons. */
function measure(p: Passage): { value: number; unit: string } | null {
  const v = p.values ?? {}
  switch (p.factKind) {
    case 'budget_total':
    case 'budget_area':
      return { value: v.msek, unit: 'mnkr' }
    case 'poll':
    case 'agreement':
      return { value: v.pct, unit: 'procentenheter' }
    case 'election':
      return { value: v.seats, unit: 'mandat' }
    default:
      return null
  }
}

const fmt = (n: number, digits = 1) =>
  (Number.isInteger(n)
    ? n.toLocaleString('sv-SE')
    : n.toLocaleString('sv-SE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
  ).replace(/ /g, ' ')

/** Differences between two parties' values for the same kind of fact and period. */
function comparisons(points: Passage[]): Claim[] {
  const out: Claim[] = []
  const groups = new Map<string, Passage[]>()
  for (const p of points) {
    if (
      p.factKind === 'agreement' ||
      p.factKind === 'record' ||
      p.parties.length !== 1
    )
      continue
    // The same fact for another party: the id without the party segment.
    const key = p.id
      .split(':')
      .filter((part) => part !== p.parties[0])
      .join(':')
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  for (const group of groups.values()) {
    const [a, b] = group
    if (!a || !b || a.parties[0] === b.parties[0]) continue
    const ma = measure(a)
    const mb = measure(b)
    if (!ma || !mb || ma.value == null || mb.value == null) continue
    const diff = Math.round((ma.value - mb.value) * 10) / 10
    const pa = a.parties[0]
    const pb = b.parties[0]
    out.push({
      id: `c${out.length}`,
      type: 'computed',
      text:
        diff === 0
          ? `${pa} och ${pb} ligger lika (${fmt(ma.value)} ${ma.unit === 'procentenheter' ? '%' : ma.unit}).`
          : `Skillnaden mellan ${pa} och ${pb} är ${fmt(Math.abs(diff))} ${ma.unit}, ${diff > 0 ? pa : pb} högre.`,
      sources: [a.id, b.id],
      formula: `${pa} − ${pb} = ${fmt(ma.value)} − ${fmt(mb.value)}`,
    })
  }
  return out
}

/** The sentence of a speech that best answers the question, kept short enough to quote. */
function bestSentence(topic: string[], text: string): string | null {
  let best: { s: string; score: number } | null = null
  for (const s of sentences(text)) {
    if (s.length < 40 || s.length > 320) continue
    if (/^herr talman|^fru talman|^tack|MERGEFORMAT|STYLEREF|\\/i.test(s))
      continue
    const have = new Set(tokens(s))
    const hits = topic.filter((t) => have.has(t)).length
    // A quote must share a topic word with the question; otherwise it only fills space.
    if (!hits) continue
    const score = hits + Math.min(have.size, 25) / 250
    if (!best || score > best.score) best = { s, score }
  }
  return best?.s ?? null
}

/** Claims without a model: facts as stated, differences computed, speeches quoted. */
export function extractClaims(
  question: string,
  passages: Passage[],
  found: Entities,
): ClaimSet {
  const points = passages.filter((p) => p.kind === 'datapoint').slice(0, 5)
  const speeches = passages.filter((p) => p.kind === 'speech')
  const claims: Claim[] = points.map((p, i) => ({
    id: `f${i}`,
    type: 'summary' as const,
    text: p.text,
    sources: [p.id],
  }))
  claims.push(...comparisons(points).slice(0, 2))

  const topic = topicTokens(question)
  // When facts answer a question about a measure, quotes only add noise unless asked for.
  const quotes =
    !points.length || found.intents.includes('debate') || !found.intents.length
  const speakers = new Set<string>()
  for (const p of quotes ? speeches : []) {
    if (speakers.size >= 3 || speakers.has(p.speaker ?? '')) continue
    const quote = bestSentence(topic, p.text)
    if (!quote) continue
    speakers.add(p.speaker ?? '')
    claims.push({
      id: `q${speakers.size}`,
      type: 'quote',
      text: `${p.speaker} i debatten ”${p.title}” (${p.date}): ”${quote}”`,
      quote,
      sources: [p.id],
    })
  }
  const who = found.parties.map((p) => PARTY_NAMES[p]).join(' och ')
  const lead = claims.length
    ? `Det här säger källorna${who ? ` om ${who}` : ''}. Svaret är sammanställt utan språkmodell: fakta återges som de står, skillnader räknas ut och tal citeras ordagrant.`
    : 'De hämtade källorna räcker inte för att besvara frågan.'
  return { lead, claims }
}

// ---------- For a language model ----------

export const SYSTEM_PROMPT = `Du är taLLMan, en källkritisk assistent för frågor om Sveriges riksdag.

Du svarar bara utifrån de numrerade källorna i frågan, aldrig utifrån egen kunskap. Svaret består av påståenden, och varje påstående anger vilka källor det vilar på med deras id. Påståendena granskas efteråt maskinellt mot källorna, så:

- Ett citat ska stå i fältet quote och vara ordagrant hämtat ur källans text. Ändra inga ord.
- Ett tal ska antingen stå i källan eller räknas fram ur källornas tal; skriv då uträkningen i formula och välj typen computed.
- Sammanfatta flera källor med typen summary. Allt som går utöver källorna (orsaker, avsikter, strategier, bedömningar) är typen interpretation.
- Påstå inte att något har skärpts, lättats eller ändrats över tid om inte källorna uttryckligen säger det.
- Om källorna inte räcker för att besvara frågan: säg det i lead och returnera färre påståenden, eller inga.
- Skriv på svenska, sakligt och kort. Högst sex påståenden. lead är en eller två meningar som ramar in svaret och får inte innehålla egna fakta.`

export const CLAIMS_SCHEMA = {
  type: 'object',
  properties: {
    lead: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          type: {
            type: 'string',
            enum: ['quote', 'computed', 'summary', 'interpretation'],
          },
          sources: { type: 'array', items: { type: 'string' } },
          quote: { type: 'string' },
          formula: { type: 'string' },
        },
        required: ['text', 'type', 'sources'],
        additionalProperties: false,
      },
    },
  },
  required: ['lead', 'claims'],
  additionalProperties: false,
} as const

/** The passages as the model sees them: id, heading, who and when, then the text. */
export function renderPassages(passages: Passage[]): string {
  return passages
    .map((p) => {
      const who = p.speaker ?? p.parties.join(', ')
      const when = p.date ?? p.session ?? ''
      return `<källa id="${p.id}" typ="${p.kind}" rubrik="${p.title}" vem="${who}" när="${when}">\n${p.text}\n</källa>`
    })
    .join('\n\n')
}

export function userPrompt(question: string, passages: Passage[]): string {
  return `${renderPassages(passages)}\n\nFråga: ${question}`
}

/** Model output as claims with stable ids; anything malformed is dropped, not repaired. */
export function parseClaims(raw: unknown): ClaimSet {
  const obj = (raw ?? {}) as { lead?: unknown; claims?: unknown }
  const list = Array.isArray(obj.claims) ? obj.claims : []
  const claims: Claim[] = []
  for (const item of list) {
    const c = item as Partial<Claim>
    if (typeof c.text !== 'string' || !Array.isArray(c.sources)) continue
    const type = ['quote', 'computed', 'summary', 'interpretation'].includes(
      c.type as string,
    )
      ? (c.type as Claim['type'])
      : 'interpretation'
    claims.push({
      id: `m${claims.length}`,
      text: c.text,
      type,
      sources: c.sources.filter((s): s is string => typeof s === 'string'),
      ...(typeof c.quote === 'string' && c.quote ? { quote: c.quote } : {}),
      ...(typeof c.formula === 'string' && c.formula
        ? { formula: c.formula }
        : {}),
    })
  }
  return { lead: typeof obj.lead === 'string' ? obj.lead : '', claims }
}
