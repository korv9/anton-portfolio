/** Display names for the job assistant's fit, marks and evidence levels, and its dates. */
import { currentLocale, l } from '../i18n'
import { ROLE_NAMES, type Match, type Mine } from './data'

const FIT: Record<Match['class'], [string, string]> = {
  strong: ['Good', 'Bra'],
  possible: ['Possible', 'Möjlig'],
  stretch: ['A stretch', 'En utmaning'],
  outside: ['Outside my search', 'Utanför min sökning'],
}
const MARK: Record<Mine, [string, string]> = {
  saved: ['Saved', 'Sparad'],
  applied: ['Applied', 'Sökt'],
  closed: ['Closed', 'Stängd'],
}
const LEVEL: Record<string, [string, string]> = {
  practical: ['In practical work', 'I praktiskt arbete'],
  education_or_project: [
    'In education or a project',
    'I utbildning eller projekt',
  ],
  listed: ['Listed only', 'Bara listad'],
  interest: ['Interest, no documented use', 'Intresse, inget dokumenterat'],
}

export const markLabel = (m: Mine) => l(...MARK[m])
export const roleName = (role: string) =>
  l(...(ROLE_NAMES[role] ?? ROLE_NAMES.other))
/** The fit in words: "Good, data engineering role"; unmatched ads say so. */
export function fitLabel(match?: Match) {
  if (!match) return l('Not matched', 'Inte matchad')
  const role = roleName(match.role).toLocaleLowerCase()
  return l(
    `${FIT[match.class][0]}, ${role} role`,
    `${FIT[match.class][1]}, roll inom ${role}`,
  )
}
export const cvLevelLabel = (level: string | null) =>
  level
    ? l(...(LEVEL[level] ?? [level, level]))
    : l('Not in the CV', 'Finns inte i cv:t')

const locale = () => (currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')
/** A source time (Stockholm local already) as "12 Oct". */
export function day(value: string | null | undefined) {
  if (!value) return '–'
  const d = new Date(value.slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(d.getTime())
    ? value.slice(0, 10)
    : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}
/** A sync time as "14:07" today, else "27 Oct, 14:07", in Stockholm time. */
export function clock(iso: string, today: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  const sameDay =
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(
      d,
    ) === today
  return d.toLocaleString(locale(), {
    timeZone: 'Europe/Stockholm',
    ...(sameDay ? {} : { day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  })
}
/** The days left to apply, or that the deadline has passed. */
export function left(days: number | null) {
  if (days == null) return ''
  if (days < 0) return l('Deadline passed', 'Sista dagen har passerat')
  if (days === 0) return l('Last day today', 'Sista dagen i dag')
  return days === 1 ? l('1 day', '1 dag') : l(`${days} days`, `${days} dagar`)
}
