import { swedishReports } from './sv-extra'

export type Locale = 'en' | 'sv'

const storageKey = 'anton-portfolio-language'

/** English unless the address (?lang=sv) or the reader's last choice says Swedish. */
export function initialLocale(): Locale {
  if (typeof location === 'undefined') return 'en'
  let saved: string | null = new URLSearchParams(location.search).get('lang')
  try {
    saved ??= localStorage.getItem(storageKey)
  } catch {
    /* Private browsing can block storage. */
  }
  return saved === 'sv' ? 'sv' : 'en'
}

let locale: Locale = initialLocale()

export function setLocale(next: Locale) {
  locale = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(storageKey, next)
  } catch {
    /* Private browsing can block storage. */
  }
  // The address carries the choice, so a shared link opens in the same language.
  const url = new URL(location.href)
  url.searchParams.set('lang', next)
  history.replaceState(history.state, '', url)
  window.dispatchEvent(new Event('localechange'))
}

export function currentLocale() {
  return locale
}
export function l(en: string, sv: string) {
  return locale === 'sv' ? sv : en
}

// English is the source copy. The dictionary keeps translations next to the
// original wording, while source quotations and dataset identifiers stay intact.
const swedish: Record<string, string> = {
  'Skip to content': 'Hoppa till innehåll',
  'Main navigation': 'Huvudnavigering',
  About: 'Om mig',
  Projects: 'Projekt',
  Politics: 'Politik',
  'Download CV': 'Ladda ned CV',
  Experience: 'Erfarenhet',
  Data: 'Data',
  Delivery: 'Utveckling',
  'Data Engineer': 'Dataingenjör',
  'Analytics Engineer': 'Analytics Engineer',
  Education: 'Utbildning',
  Source: 'Källa',
  Period: 'Period',
  Unit: 'Mått',
  Decisions: 'Beslut',
  Speeches: 'Tal',
  Party: 'Parti',
  All: 'Alla',
  'How to read the map': 'Så läser du kartan',
  'Homie API, work in progress': 'Homie API, pågående projekt',
}

export function t(original: string): string {
  if (locale === 'en') return original
  const key = original.replace(/\s+/g, ' ').trim()
  const translated = swedish[key] ?? swedishReports[key]
  if (!translated) return original
  return `${/^\s/.test(original) ? ' ' : ''}${translated}${/\s$/.test(original) ? ' ' : ''}`
}
