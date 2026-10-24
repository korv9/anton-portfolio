/** Display names for the job assistant's classes, statuses and evidence levels. */
import { currentLocale, l } from '../i18n'
import type { Judgement, MatchClass, Status } from './data'

const CLASS: Record<MatchClass, [string, string]> = {
  strong: ['Strong', 'Stark'],
  possible: ['Possible', 'Möjlig'],
  stretch: ['Stretch', 'Utmaning'],
  outside: ['Outside', 'Utanför'],
}
const STATUS: Record<Status, [string, string]> = {
  new: ['New', 'Ny'],
  review: ['To review', 'Att läsa'],
  interesting: ['Saved', 'Sparad'],
  pass: ['Pass', 'Avstår'],
  applied: ['Applied', 'Sökt'],
  interview: ['Interview', 'Intervju'],
  offer: ['Offer', 'Erbjudande'],
  rejected: ['Rejected', 'Avslag'],
  closed: ['Closed', 'Stängd'],
}
const LEVEL: Record<string, [string, string]> = {
  practical: ['In work (LIA, employment)', 'I arbete (LIA, anställning)'],
  education_or_project: [
    'In education or a project',
    'I utbildning eller projekt',
  ],
  listed: ['Listed only', 'Bara listad'],
  interest: ['Interest, no documented use', 'Intresse, inget dokumenterat'],
}

// The CV section a quote's ref points at, as in REFS of platform/job_assistant/cv_profile.py.
const SECTION: Record<string, [string, string]> = {
  experience: ['Experience', 'Erfarenhet'],
  other: ['Other experience', 'Annan erfarenhet'],
  project: ['Projects', 'Projekt'],
  education: ['Education', 'Utbildning'],
  skills: ['Skills', 'Kompetenser'],
  summary: ['Summary', 'Sammanfattning'],
}
/** "experience-2" as "CV: Experience, entry 2". */
export function cvSection(ref: string) {
  const [, key, n] = /^([a-z_]+)(?:-(\d+))?$/.exec(ref) ?? []
  const name = SECTION[key ?? '']
  if (!name) return ref
  return `${l('CV', 'Cv')}: ${l(...name)}${n ? `, ${l('entry', 'post')} ${n}` : ''}`
}

export const classLabel = (c: MatchClass) => l(...CLASS[c])
export const statusLabel = (s: Status) => l(...STATUS[s])
export const cvLevelLabel = (level: Judgement['cv_level'] | string | null) =>
  level
    ? l(...(LEVEL[level] ?? [level, level]))
    : l('Not in the CV', 'Finns inte i cv:t')

/** A source time as a short date; JobTech's times are Stockholm local already. */
export const day = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : '–'

const rtf = () =>
  new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' })
/** "today", "yesterday", "3 days ago" from the days since publication. */
export const ago = (days: number | null) =>
  days == null ? '–' : rtf().format(-Math.max(days, 0), 'day')
/** The time left to apply, or that the deadline has passed. */
export function left(days: number | null) {
  if (days == null) return ''
  if (days < 0) return l('Deadline passed', 'Sista dagen har passerat')
  if (days === 0) return l('Last day today', 'Sista dagen i dag')
  return days === 1
    ? l('1 day left', '1 dag kvar')
    : l(`${days} days left`, `${days} dagar kvar`)
}
