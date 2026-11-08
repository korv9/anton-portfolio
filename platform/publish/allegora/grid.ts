/**
 * Allegora's table: laws as rows, questions as columns. The pure parts of vertex_grid.ts: which
 * cells exist, what is sent for each, and which answers survive. An answer passes through the same
 * prompt and quote check as /api/answer (worker/index.ts), so a batch model cannot publish a quote
 * that is not in its source.
 */
import {
  ALLEGORY_SYSTEM,
  QUOTE,
  SYSTEM,
  canonical,
  checkQuotes,
} from '../../../worker/quotes.ts'

export type Item = { id: string; title: string; url: string; text: string }
export type Law = { sfs: string; title: string }

export const LAWS: Law[] = [
  { sfs: '1982:80', title: 'Lagen om anställningsskydd' },
  { sfs: '1977:480', title: 'Semesterlagen' },
  { sfs: '2008:567', title: 'Diskrimineringslagen' },
  { sfs: '2022:260', title: 'Konsumentköplagen' },
  { sfs: '2005:59', title: 'Distansavtalslagen' },
  { sfs: '2018:218', title: 'Dataskyddslagen' },
  { sfs: '1977:1160', title: 'Arbetsmiljölagen' },
  { sfs: '2018:1200', title: 'Kamerabevakningslagen' },
  { sfs: '2014:821', title: 'Patientlagen' },
  { sfs: '1960:729', title: 'Upphovsrättslagen' },
]
export const QUESTIONS = [
  { id: 'who', sv: 'Vilka gäller lagen för?', en: 'Who does it apply to?' },
  {
    id: 'duty',
    sv: 'Vilka skyldigheter ställer lagen upp?',
    en: 'What duties does it set?',
    // Passages word a duty as "ska" and rarely say "skyldighet", so the question alone misses them.
    search: 'ska, är skyldig att',
  },
  { id: 'right', sv: 'Vilka rättigheter ger lagen den enskilde?', en: 'What rights does it give?' },
  { id: 'breach', sv: 'Vad händer om lagen inte följs?', en: 'What happens if it is broken?' },
  {
    id: 'except',
    sv: 'Vilka undantag finns i lagen?',
    en: 'What exceptions does it have?',
    search: 'gäller inte, undantas, får avvika från lagen',
  },
]

/** 'sfs-1982-80-11' belongs to '1982:80'; '1982-8' or '1982-800' does not. */
export const inLaw = (id: string, sfs: string) =>
  id.startsWith(`sfs-${sfs.replace(':', '-')}-`)

export const cellQuestion = (law: Law, question: string) =>
  `${law.title}: ${question}`

/** Gemini counts its thinking as output, so the Worker's limits alone could cut an answer short. */
const THINKING = 6000

/** Multi-region locations have their own hostnames; a single region is a prefix. */
export function vertexHost(location: string) {
  if (location === 'global') return 'https://aiplatform.googleapis.com'
  if (location === 'eu' || location === 'us')
    return `https://aiplatform.${location}.rep.googleapis.com`
  if (/^[a-z]+-[a-z]+\d+$/.test(location))
    return `https://${location}-aiplatform.googleapis.com`
  throw new Error(`unknown location: ${location}`)
}

type Sent = { system: string; user: string; temperature: number; maxTokens: number }

/** The same message as /api/answer sends its model. */
export function answerPrompt(question: string, passages: Item[]): Sent {
  const context = passages.map((p) => `[[${p.id}]]\n${p.text}`).join('\n\n')
  return {
    // A cell asks for a whole law, of which eight passages show only a part.
    system: `${SYSTEM} If the passages answer the question in part, answer that part.`,
    user: `${context}\n\nQuestion: ${question}`,
    temperature: 0.1,
    maxTokens: THINKING + 2048,
  }
}

export function allegoryPrompt(question: string, checked: string): Sent {
  const plain = checked.replace(QUOTE, (_, _id, quote) => (quote ? `"${quote}"` : ''))
  return {
    system: ALLEGORY_SYSTEM,
    user: `Question: ${question}\n\nChecked answer: ${plain}`,
    temperature: 0.7,
    maxTokens: THINKING + 600,
  }
}

/** One line of a Vertex AI batch input file. */
export const batchLine = ({ system, user, temperature, maxTokens }: Sent) =>
  JSON.stringify({
    request: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    },
  })

export type Usage = { tokens_in: number; tokens_out: number }
export type Output = { text: string | null; usage: Usage }

/**
 * A batch output file, keyed by the prompt each line echoes back: lines come in no fixed order.
 * A line that failed has no candidates, and counts as no text.
 */
export function parseOutputs(jsonl: string) {
  const out = new Map<string, Output>()
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    const row = JSON.parse(line)
    const user = row.request?.contents?.[0]?.parts?.[0]?.text
    if (typeof user !== 'string') continue
    const parts = row.response?.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p: { text?: string }) => p.text ?? '').join('').trim()
    const meta = row.response?.usageMetadata ?? {}
    out.set(user, {
      text: text || null,
      usage: {
        tokens_in: meta.promptTokenCount ?? 0,
        tokens_out: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
      },
    })
  }
  return out
}

export type Judged =
  | { status: 'failed' }
  | { status: 'no_answer' | 'unverified'; reply: string }
  | { status: 'verified'; answer: string; quotes: { id: string; quote: string }[] }

/** The verdict /api/answer gives: every quote verbatim in the passage it names, or no answer. */
export function judge(text: string | null, passages: Item[]): Judged {
  if (text === null) return { status: 'failed' }
  const quotes = checkQuotes(text, passages)
  // The reply is kept to tell a refusal from a format error; it is never shown as an answer.
  if (/^NO_ANSWER\W*$/.test(text) || !quotes.length) return { status: 'no_answer', reply: text }
  if (!quotes.every((q) => q.verbatim)) return { status: 'unverified', reply: text }
  return {
    status: 'verified',
    answer: canonical(text),
    quotes: quotes.map(({ id, quote }) => ({ id, quote })),
  }
}

/** A retelling that cites anything is dropped, as retell() in the Worker does; the answer stands. */
export const usableAllegory = (text: string | null | undefined) =>
  text && !text.includes('[[') ? text : null
