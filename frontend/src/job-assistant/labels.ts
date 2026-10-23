/** Display names for the job assistant's classes, statuses and evidence levels. */
import { l } from '../i18n'
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
  interesting: ['Interesting', 'Intressant'],
  pass: ['Pass', 'Avstår'],
  applied: ['Applied', 'Sökt'],
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

export const classLabel = (c: MatchClass) => l(...CLASS[c])
export const statusLabel = (s: Status) => l(...STATUS[s])
export const cvLevelLabel = (level: Judgement['cv_level'] | string | null) =>
  level
    ? l(...(LEVEL[level] ?? [level, level]))
    : l('Not in the CV', 'Finns inte i cv:t')

/** A source time as a short date; JobTech's times are Stockholm local already. */
export const day = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : '–'
