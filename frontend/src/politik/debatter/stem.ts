/**
 * The Snowball stemmer for Swedish, ported from the code Snowball 3.1 generates
 * (snowballstemmer's swedish_stemmer.py), the same algorithm platform/nlp/issue_lexicon.py
 * learns the lexicon with, so a word stems the same way on the site. A unit test checks the
 * two agree word for word on real speeches.
 */
const VOWEL = new Set('aeiouyäåö')
const S_ENDING = new Set('bcdfghjklmnoprtvy')
const OST_ENDING = new Set('iklnprtuv')

// Main suffixes: 1 delete, 2 the s rule, 3 the et rule.
const MAIN: [string, 1 | 2 | 3][] = (
  [
    ['a', 1],
    ['arna', 1],
    ['erna', 1],
    ['heterna', 1],
    ['orna', 1],
    ['ad', 1],
    ['e', 1],
    ['ade', 1],
    ['ande', 1],
    ['arne', 1],
    ['are', 1],
    ['aste', 1],
    ['en', 1],
    ['anden', 1],
    ['aren', 1],
    ['heten', 1],
    ['ern', 1],
    ['ar', 1],
    ['er', 1],
    ['heter', 1],
    ['or', 1],
    ['s', 2],
    ['as', 1],
    ['arnas', 1],
    ['ernas', 1],
    ['ornas', 1],
    ['es', 1],
    ['ades', 1],
    ['andes', 1],
    ['ens', 1],
    ['arens', 1],
    ['hetens', 1],
    ['erns', 1],
    ['at', 1],
    ['et', 3],
    ['andet', 1],
    ['het', 1],
    ['ast', 1],
  ] as [string, 1 | 2 | 3][]
).sort((a, b) => b[0].length - a[0].length)

// Endings before "et" that keep it: kvalitet, paket, frihet …
const ET_KEEP = [
  'fab',
  'h',
  'pak',
  'rak',
  'stak',
  'kom',
  'iet',
  'cit',
  'dit',
  'alit',
  'ilit',
  'mit',
  'nit',
  'pit',
  'rit',
  'sit',
  'tit',
  'uit',
  'ivit',
  'kvit',
  'xit',
]
const PAIRS = ['dd', 'gd', 'nn', 'dt', 'gt', 'kt', 'tt']
const OTHER: [string, 1 | 2 | 3][] = [
  ['fullt', 3],
  ['lig', 1],
  ['els', 1],
  ['öst', 2],
  ['ig', 1],
]

/** Start of R1: after the first non-vowel that follows a vowel, but at least 3. */
function region1(word: string) {
  for (let i = 1; i < word.length; i++)
    if (!VOWEL.has(word[i]) && VOWEL.has(word[i - 1])) return Math.max(3, i + 1)
  return word.length
}

/** "et" may go when it follows a consonant after a vowel, with something before that, and the
 * word does not end in one of the kept endings. `end` is where "et" starts. */
function etCondition(word: string, end: number) {
  if (end < 3) return false
  if (VOWEL.has(word[end - 1]) || !VOWEL.has(word[end - 2])) return false
  const before = word.slice(0, end)
  return !ET_KEEP.some((k) => before.endsWith(k))
}

/** The longest suffix from a list that ends the word and starts inside R1. */
function longest<T>(word: string, p1: number, list: [string, T][]) {
  return list.find(([s]) => word.endsWith(s) && word.length - s.length >= p1)
}

export function stem(input: string): string {
  let word = input
  const p1 = region1(word)

  const main = longest(word, p1, MAIN)
  if (main) {
    const [suffix, rule] = main
    const at = word.length - suffix.length
    if (rule === 1) word = word.slice(0, at)
    else if (rule === 3) {
      if (etCondition(word, at)) word = word.slice(0, at)
    } else if (word.endsWith('ets') && etCondition(word, word.length - 3)) {
      word = word.slice(0, -3)
    } else if (at > 0 && S_ENDING.has(word[at - 1])) {
      word = word.slice(0, at)
    }
  }

  if (PAIRS.some((s) => word.endsWith(s) && word.length - s.length >= p1))
    word = word.slice(0, -1)

  const other = longest(word, p1, OTHER)
  if (other) {
    const [suffix, rule] = other
    const at = word.length - suffix.length
    if (rule === 1) word = word.slice(0, at)
    else if (rule === 2) {
      if (at > 0 && OST_ENDING.has(word[at - 1]))
        word = `${word.slice(0, at)}ös`
    } else word = `${word.slice(0, at)}full`
  }
  return word
}
