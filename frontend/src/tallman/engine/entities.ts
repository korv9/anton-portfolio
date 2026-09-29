/**
 * What a question is about: parties, riksmöten, years and the kind of answer it wants.
 * Deliberately simple rules; anything they miss still reaches the retriever as words.
 */
import { tokens } from './text.ts'
import type { Entities, Intent } from './types.ts'

export const PARTIES = ['S', 'SD', 'M', 'V', 'C', 'KD', 'MP', 'L'] as const

export const PARTY_NAMES: Record<string, string> = {
  S: 'Socialdemokraterna',
  SD: 'Sverigedemokraterna',
  M: 'Moderaterna',
  V: 'Vänsterpartiet',
  C: 'Centerpartiet',
  KD: 'Kristdemokraterna',
  MP: 'Miljöpartiet',
  L: 'Liberalerna',
}

/** Names and common forms, lower case, matched as whole words. */
const ALIASES: [RegExp, string][] = [
  [/\bsocialdemokrat\w*|\bsossarna\b|\bsossen\b/, 'S'],
  [/\bsverigedemokrat\w*/, 'SD'],
  [/\bmoderat\w*/, 'M'],
  [/\bvänsterpartiet\w*|\bvänsterpartist\w*/, 'V'],
  [/\bcenterpartiet\w*|\bcenterpartist\w*/, 'C'],
  [/\bkristdemokrat\w*/, 'KD'],
  [/\bmiljöpartiet\w*|\bmiljöpartist\w*/, 'MP'],
  [/\bliberalerna\w*|\bliberal\b/, 'L'],
]

const INTENTS: [RegExp, Intent][] = [
  [
    /budget|pengar|miljard|mnkr|kronor|satsa|anslag|utgiftsområde|spara|skatt/,
    'budget',
  ],
  [
    /opinion|mätning|undersökning|psu|scb|väljarstöd|sympati|stöd bland/,
    'poll',
  ],
  [/\bval(et)?\b|mandat|riksdagsval|röster(na)?\b|valresultat/, 'election'],
  [
    /röstade|röstar|lika|överens|samarbet|votering|ståndpunkt|samma sida/,
    'agreement',
  ],
  [/närvaro|enighet|sammanhållning|med regeringen|regeringens linje/, 'record'],
  [
    /debatt|sa\b|sade|sagt|säger|talade|anförande|argument|tycker|kritik|kritiser/,
    'debate',
  ],
  [
    /skärp|lätta|lättnad|strängare|mildare|mildra|hårdare|mjukare|förändr|ändrat|över tid|utveckl/,
    'change',
  ],
]

/** Words that say who or how to answer, not what about. */
const GENERIC = new Set(
  tokens(
    'sa sade sagt säger tycker tyckte tycka tyckt tänker anser ansett parti partiet partierna regeringen riksdagen debatten debatt vad hur mycket ofta stöd ville vill går gick står stod läget',
  ),
)

/** The question's topic words: its tokens without parties and generic words. */
export function topicTokens(question: string): string[] {
  const lower = question.toLowerCase()
  const partyWords = new Set<string>()
  for (const [pattern] of ALIASES) {
    const match = lower.match(pattern)
    if (match) for (const t of tokens(match[0])) partyWords.add(t)
  }
  return tokens(question).filter(
    (t) =>
      !partyWords.has(t) && !GENERIC.has(t) && !/^\d/.test(t) && t.length > 2,
  )
}

export function entities(question: string): Entities {
  const lower = question.toLowerCase()
  const parties = new Set<string>()
  // Abbreviations only in upper case, so "m" in running text is not Moderaterna.
  for (const word of question.match(/\b[A-ZÅÄÖ]{1,2}\b/g) ?? []) {
    if ((PARTIES as readonly string[]).includes(word)) parties.add(word)
  }
  for (const [pattern, party] of ALIASES)
    if (pattern.test(lower)) parties.add(party)

  // "-partiet" names that are not one of the eight: the index has nothing on them.
  const unknownParties = [
    ...new Set(
      (lower.match(/\b[a-zåäö]+partiet\b/g) ?? []).filter(
        (name) => !ALIASES.some(([pattern]) => pattern.test(name)),
      ),
    ),
  ]
  const sessions = new Set<string>()
  for (const match of question.matchAll(/\b(20\d{2})\s*\/\s*(\d{2})\b/g))
    sessions.add(`${match[1]}/${match[2]}`)
  const years = new Set<number>()
  for (const match of question
    .replace(/\b20\d{2}\s*\/\s*\d{2}\b/g, '')
    .matchAll(/\b(19[7-9]\d|20\d{2})\b/g))
    years.add(Number(match[1]))

  const intents = INTENTS.filter(([p]) => p.test(lower)).map(([, i]) => i)
  return {
    parties: PARTIES.filter((p) => parties.has(p)),
    unknownParties,
    sessions: [...sessions],
    years: [...years].sort(),
    government: /regering/.test(lower),
    intents,
    tokens: tokens(question),
  }
}

/** The riksmöte a budget year is decided in: the 2025 budget in riksmötet 2024/25. */
export function sessionOfBudgetYear(year: number): string {
  return `${year - 1}/${String(year).slice(2)}`
}

/** The riksmöten a calendar year touches. */
export function sessionsOfYear(year: number): string[] {
  const a = `${year - 1}/${String(year).slice(2)}`
  const b = `${year}/${String(year + 1).slice(2)}`
  return [a, b]
}
