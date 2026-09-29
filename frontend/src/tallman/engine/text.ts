/**
 * Swedish text handling for retrieval and checking: tokens, a light stemmer, BM25, sentences
 * and numbers written the Swedish way ("1 000,5", "−5 035", "41,3 %").
 */

const STOP = new Set(
  `herr fru talman talmannen och att i det som en på är för av med till den har de inte om
ett vi jag så men kan ska var från eller också vara när vill detta här nu måste mer då dem
man hur alla sin sitt sina där hade blir bli blivit ju just mycket många finns utan efter
under över även bara vad vilket vilka vilken både genom mot inom helt redan dessutom kommer
skulle kunna får fick ta gör göra gjort sagt säger tror tycker menar vår våra vårt er era
ert oss du ni hon han honom henne deras dess denna dessa sådan sådana annat andra hur varför
vem vilka när något några någon mellan sedan än the`.split(/\s+/),
)

const WORD = /[a-zåäöéü0-9]+/g

/** Longest suffixes first; keep a stem of at least four letters. */
const SUFFIXES = [
  'arnas',
  'ernas',
  'ornas',
  'heten',
  'ingen',
  'ingar',
  'arna',
  'erna',
  'orna',
  'ande',
  'ende',
  'ning',
  'erat',
  'ade',
  'are',
  'ast',
  'het',
  'ens',
  'ets',
  'ars',
  'ers',
  'ens',
  'na',
  'en',
  'et',
  'ar',
  'er',
  'or',
  'as',
  'es',
  'at',
  'a',
  'e',
  's',
  't',
]

export function stem(word: string): string {
  if (/^\d/.test(word)) return word
  for (const suffix of SUFFIXES) {
    if (word.length - suffix.length >= 4 && word.endsWith(suffix))
      return word.slice(0, -suffix.length)
  }
  return word
}

/** Lower-case content words, stemmed. */
export function tokens(text: string): string[] {
  const out: string[] = []
  for (const word of text.toLowerCase().match(WORD) ?? []) {
    if (word.length < 2 || STOP.has(word)) continue
    out.push(stem(word))
  }
  return out
}

/** Okapi BM25 over a fixed set of documents. */
export class BM25 {
  private docs: Map<string, number>[] = []
  private lengths: number[] = []
  private df = new Map<string, number>()
  private avg = 0
  private k1: number
  private b: number

  constructor(texts: string[], k1 = 1.2, b = 0.75) {
    this.k1 = k1
    this.b = b
    for (const text of texts) {
      const counts = new Map<string, number>()
      const toks = tokens(text)
      for (const t of toks) counts.set(t, (counts.get(t) ?? 0) + 1)
      for (const t of counts.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1)
      this.docs.push(counts)
      this.lengths.push(toks.length)
    }
    this.avg =
      this.lengths.reduce((s, n) => s + n, 0) / Math.max(1, texts.length)
  }

  score(query: string[] | string, index: number): number {
    const terms = typeof query === 'string' ? tokens(query) : query
    const doc = this.docs[index]
    const n = this.docs.length
    let score = 0
    for (const term of new Set(terms)) {
      const f = doc.get(term)
      if (!f) continue
      const df = this.df.get(term) ?? 0
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
      const norm = 1 - this.b + (this.b * this.lengths[index]) / (this.avg || 1)
      score += (idf * f * (this.k1 + 1)) / (f + this.k1 * norm)
    }
    return score
  }

  /** Indices with a positive score, best first. */
  rank(query: string, limit = 10): { index: number; score: number }[] {
    const terms = tokens(query)
    const out: { index: number; score: number }[] = []
    for (let i = 0; i < this.docs.length; i++) {
      const score = this.score(terms, i)
      if (score > 0) out.push({ index: i, score })
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit)
  }
}

/** Share of the claim's content words that appear in the evidence, 0–1. */
export function overlap(claim: string, evidence: string): number {
  const want = new Set(tokens(claim).filter((t) => !/^\d/.test(t)))
  if (!want.size) return 1
  const have = new Set(tokens(evidence))
  let hit = 0
  for (const t of want) if (have.has(t)) hit++
  return hit / want.size
}

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ”"])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Paragraphs of a speech; long ones are cut at sentence ends near 700 characters. */
export function paragraphs(text: string, max = 700): string[] {
  const out: string[] = []
  for (const block of text.split(/\r?\n/)) {
    let current = ''
    for (const sentence of sentences(block)) {
      if (current && current.length + sentence.length > max) {
        out.push(current)
        current = ''
      }
      current = current ? `${current} ${sentence}` : sentence
    }
    if (current) out.push(current)
  }
  return out.filter((p) => p.length > 40)
}

/** Whitespace, quote marks and dashes made uniform, so a verbatim check ignores typography. */
export function normalizeQuote(text: string): string {
  return text
    .toLowerCase()
    .replace(/[”“"„'’‘«»]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*([.,;:!?])\s*/g, '$1 ')
    .trim()
    .replace(/[.,;:!?]+$/, '')
}

/**
 * Numbers in a Swedish text, as values: "1 000,5" → 1000.5, "−5 035" → -5035, "41,3 %" → 41.3.
 * Years, dates and session labels (2023/24) are skipped: they identify, they do not measure.
 */
export function numbers(text: string): number[] {
  const out: number[] = []
  const pattern =
    /([−–-]|\+)?\d{1,3}(?:[  ]\d{3})+(?:,\d+)?|([−–-]|\+)?\d+(?:,\d+)?/g
  const cleaned = text
    .replace(/\b\d{4}\/\d{2}\b/g, ' ')
    .replace(/\b\d{4}-\d{2}(-\d{2})?\b/g, ' ')
  for (const match of cleaned.matchAll(pattern)) {
    const raw = match[0]
    const before = cleaned[match.index! - 1] ?? ' '
    // A hyphen between words ("S-regeringen") or a range ("2018-2022") is not a sign.
    const signed =
      /^[−–-]/.test(raw) && /[\w]/.test(before) ? raw.slice(1) : raw
    const value = Number(
      signed
        .replace(/[  ]/g, '')
        .replace(/^[−–]/, '-')
        .replace('+', '')
        .replace(',', '.'),
    )
    if (!Number.isFinite(value)) continue
    if (
      Number.isInteger(value) &&
      value >= 1900 &&
      value <= 2100 &&
      !/[  ]/.test(signed)
    )
      continue
    out.push(value)
  }
  return out
}

/** True when a stated number matches a value, allowing for the rounding used in the text. */
export function sameNumber(stated: number, value: number): boolean {
  if (stated === value) return true
  const diff = Math.abs(stated - value)
  if (Math.abs(value) < 1000)
    return diff <= 0.051 || (Number.isInteger(stated) && diff < 0.5)
  // Large sums may be given in billions or rounded to the nearest hundred.
  return diff / Math.abs(value) < 0.005
}
