/** Small shared pieces of the AI Act Observatory: labels, dates, badges and source links. */
import type { ReactNode } from 'react'
import { currentLocale, l } from '../i18n'
import type { Actor, Bi } from './types'

export const pick = (b: { en: string; sv: string } | Bi) =>
  currentLocale() === 'sv' ? b.sv : b.en

export function fmtDate(iso: string | null | undefined, short = false) {
  if (!iso) return '–'
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return d.toLocaleDateString(l('en-GB', 'sv-SE'), {
    day: 'numeric',
    month: short ? 'short' : 'long',
    year: 'numeric',
  })
}

export function monthName(month: string) {
  const d = new Date(`${month}-15T12:00:00`)
  return d.toLocaleDateString(l('en-GB', 'sv-SE'), {
    month: 'long',
    year: 'numeric',
  })
}

export const REQUIREMENT: Record<string, [string, string]> = {
  ai_literacy: ['AI literacy', 'AI-kunnighet'],
  prohibition: ['Prohibition', 'Förbud'],
  risk_management: ['Risk management', 'Riskhantering'],
  data_governance: ['Data governance', 'Datastyrning'],
  documentation: ['Documentation', 'Dokumentation'],
  record_keeping: ['Logs', 'Loggning'],
  transparency: ['Transparency', 'Transparens'],
  human_oversight: ['Human oversight', 'Mänsklig tillsyn'],
  accuracy_robustness: ['Accuracy & security', 'Noggrannhet & säkerhet'],
  quality_management: ['Quality management', 'Kvalitetsledning'],
  corrective_action: ['Corrective action', 'Korrigerande åtgärder'],
  cooperation: ['Cooperation', 'Samarbete'],
  representation: ['EU representative', 'Ombud i EU'],
  conformity: ['Conformity & CE', 'Överensstämmelse & CE'],
  registration: ['Registration', 'Registrering'],
  monitoring: ['Monitoring', 'Övervakning'],
  incident_reporting: ['Incident reporting', 'Incidentrapportering'],
  verification: ['Verification', 'Kontroll'],
  value_chain: ['Value chain', 'Värdekedjan'],
  use_instructions: ['Use as instructed', 'Användning enligt instruktion'],
  information: ['Informing people', 'Information'],
  impact_assessment: ['Rights impact assessment', 'Konsekvensbedömning'],
  copyright: ['Copyright', 'Upphovsrätt'],
  evaluation: ['Model evaluation', 'Modellutvärdering'],
}
export const requirementLabel = (id: string) =>
  REQUIREMENT[id] ? l(...REQUIREMENT[id]) : id

export function actorLabel(actors: Actor[], id: string) {
  const a = actors.find((x) => x.actor_id === id)
  return a ? l(a.label_en, a.label_sv) : id
}

const TYPE_LABEL: Record<string, [string, string, string]> = {
  source: ['Official text', 'Lagtext', 'Verbatim from the official source.'],
  derived: [
    'Derived',
    'Härlett',
    'Computed from the official text by a stated method.',
  ],
  interpretation: [
    'Interpretation',
    'Tolkning',
    'Written for this site; not legal text.',
  ],
}

/** Marks what kind of content a block is: official text, derived or interpretation. */
export function Kind({
  type,
  label,
}: {
  type: 'source' | 'derived' | 'interpretation'
  /** A more precise name for the source, e.g. a speech rather than legal text. */
  label?: [string, string]
}) {
  const [en, sv, hint] = TYPE_LABEL[type]
  return (
    <span className={`aa-kind aa-kind-${type}`} title={hint}>
      {l(...(label ?? [en, sv]))}
    </span>
  )
}

export const SPEECH: [string, string] = [
  'Speech, verbatim',
  'Anförande, ordagrant',
]

export function Source({
  href,
  children,
}: {
  href: string
  children?: ReactNode
}) {
  return (
    <a className="aa-source" href={href} target="_blank" rel="noreferrer">
      {children ?? l('Official source', 'Officiell källa')}
    </a>
  )
}

export function ArticleLink({
  n,
  children,
}: {
  n: string
  children?: ReactNode
}) {
  return (
    <a className="aa-article-link" href={`#ai-act-article?a=${n}`}>
      {children ?? `${l('Article', 'Artikel')} ${n}`}
    </a>
  )
}

export function Status({
  status,
}: {
  status: 'applies' | 'partly' | 'upcoming'
}) {
  const text = {
    applies: l('Applies', 'Gäller'),
    partly: l('Partly applies', 'Gäller delvis'),
    upcoming: l('Upcoming', 'Kommande'),
  }[status]
  return (
    <span className={`aa-status aa-status-${status}`}>
      <span aria-hidden="true" className="aa-status-mark" />
      {text}
    </span>
  )
}

export const DISCLAIMER: [string, string] = [
  'Navigation aid, not legal advice.',
  'Navigeringsstöd, inte juridisk rådgivning.',
]

/**
 * A short name for an official document, for lists: "Regulation (EU) 2026/1744 (Digital Omnibus
 * on AI)" instead of the full title. The full title stays available as the element's title.
 */
export function shortTitle(
  kind: string,
  id: string,
  title: string | null,
): string {
  const t = (title ?? '').replace(/\u00a0/g, ' ')
  const nickname = t.match(
    /\(([^()]*(?:Omnibus|Act)[^()]*)\)\s*(?:\(Text with EEA relevance\))?\s*$/,
  )?.[1]
  const number = t
    .match(
      /^((?:Commission )?(?:Implementing |Delegated )?(?:Regulation|Decision|Directive) \((?:EU|EC)\)(?: No)? \d{4}\/\d+)/i,
    )?.[1]
    ?.replace(/^REGULATION/, 'Regulation')
  // What an implementing act is about: the words after its date, up to "pursuant to".
  const subject =
    t.match(/ as regards (.*?)$/)?.[1] ??
    t.match(
      / of \d{1,2} \w+ \d{4} (?:on |laying down )(.*?)(?: pursuant to| of Regulation|$)/,
    )?.[1]
  if (kind === 'consolidated_version')
    return `${l('Consolidated text', 'Konsoliderad text')} ${id.split('-')[1]?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') ?? ''}`
  if (kind === 'corrigendum')
    return `${l('Corrigendum', 'Rättelse')} ${id.match(/R\(\d+\)$/)?.[0] ?? ''} ${l('to Regulation (EU) 2024/1689', 'till förordning (EU) 2024/1689')}`
  if (kind === 'provision') return t
  if (number && nickname) return `${number} (${nickname})`
  if (number && subject)
    return `${number}: ${subject.length > 90 ? `${subject.slice(0, 88)}…` : subject}`
  if (number) return number
  if (/^P\d+_TA/.test(t)) return t.split(' – ').slice(0, 2).join(' – ')
  if (/^Proposal for a REGULATION/i.test(t))
    return `${l('Proposal', 'Förslag')} ${id}${nickname ? ` (${nickname})` : t.includes('medical devices') ? l(' (medical devices)', ' (medicintekniska produkter)') : ''}`
  if (/^REPORT FROM THE COMMISSION/i.test(t))
    return l(
      'Commission report under Article 112(1)',
      'Kommissionens rapport enligt artikel 112.1',
    )
  return t.length > 150 ? `${t.slice(0, 147)}…` : t
}
