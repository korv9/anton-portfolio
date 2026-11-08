/**
 * Allegora's rules for an answer about law (index.ts, ask.ts): the system prompts, and the check
 * that every quote in an answer is verbatim in the passage it names. The folding matches
 * platform/legal/parse.py, so a passage's hash here equals the one published with it.
 */
import { hex } from './jobs.ts'

export type Passage = { id: string; text: string }

// Python's str.isspace() set, so the folding matches platform/legal/parse.py exactly.
const SPACE =
  /[\t-\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g

/** platform/legal/parse.py text_hash() folding: NFKC, one kind of space, straight quotes. */
export function fold(text: string) {
  const normal = text
    .normalize('NFKC')
    .replaceAll('\u00a0', ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ ([,.;:)])/g, '$1')
    .trim()
  return normal
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(SPACE, ' ')
    .trim()
}

export const sha256 = (text: string) => hex(new TextEncoder().encode(text))

/** The same hex digest as platform/legal/parse.py text_hash(). */
export const textHash = (text: string) => sha256(fold(text))

const RULES = [
  'Answer in the language of the question, in at most five sentences.',
  'Support every claim with a verbatim quote from a passage, written as [[id]]"quote", where id is the passage id and the quote is copied character for character from that passage.',
  'Never quote anything that is not in the passage with that id, and never use outside knowledge.',
  'If the passages do not answer the question, reply with exactly NO_ANSWER and nothing else.',
]
export const SYSTEM = [
  'You answer questions about law using only the numbered passages you are given.',
  ...RULES,
  'Example of the format: Lagen omfattar anställda [[sfs-1982-80-1]]"Lagen gäller arbetstagare i allmän och enskild tjänst".',
].join(' ')
/** Allegora's second step: the checked answer retold as a fable with a moral. */
export const ALLEGORY_SYSTEM = [
  'You are Allegora. You are given a question and an answer about the law that has been checked against the legal text.',
  "Tell one small fable that shows the answer's main point: one named animal or craftsperson, one thing that happens in their village, and how it turns out. Three or four sentences.",
  'The reader should grasp the rule from what happens. Turn legal roles into the world of the story, and do not use words such as law, employee, employer, contract, damages or their Swedish equivalents.',
  'End with one line that starts with "Moral:" ("Sensmoral:" in Swedish): one short, plain sentence, like a proverb.',
  'Write in the language of the question. You may leave out details of the answer, but add no rule, exception, number or consequence it does not state, and do not change what it says.',
  'Do not cite, quote or name paragraphs, and write no [[ ]] marks.',
].join(' ')

// [[id]] followed by its quote; a colon or white space between them is tolerated, and curly
// quotes are already straight after fold(). An [[id]] without a quote is matched too, and fails.
export const QUOTE = /\[\[([^\]]+)\]\](?:\s*:?\s*"([^"]+)")?/g
// A quote written just before an [[id]] that has no quote of its own is the same citation turned
// around, "quote" [[id]]; it is rewritten as [[id]]"quote" and then checked like any other.
const TURNED = /"([^"]+)"\s*\[\[([^\]]+)\]\](?!\s*:?\s*")/g

/** The answer folded, with every citation in the [[id]]"quote" order. */
export const canonical = (answer: string) =>
  fold(answer).replace(TURNED, '[[$2]]"$1"')

// Markdown marks (code ticks, bold, table bars) and line breaks are dropped on both sides before
// the compare, so a quote that leaves out a table's | still matches; its words must not change.
const plain = (text: string) =>
  fold(text)
    .replace(/[`*|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:)])/g, '$1')
    .trim()

/** Every citation in the answer, and whether its quote is verbatim in the passage it names. */
export function checkQuotes(answer: string, passages: Passage[]) {
  const texts = new Map(passages.map((p) => [p.id, plain(p.text)]))
  return [...canonical(answer).matchAll(QUOTE)].map(([, id, quote]) => ({
    id,
    quote: quote ?? '',
    verbatim:
      quote != null &&
      /\p{L}|\p{N}/u.test(plain(quote)) &&
      (texts.get(id)?.includes(plain(quote)) ?? false),
  }))
}

/** The checked answer with its quotes kept as plain text: what a fable is told from. */
export const told = (checked: string) =>
  checked.replace(QUOTE, (_, _id, quote) => (quote ? `"${quote}"` : ''))
