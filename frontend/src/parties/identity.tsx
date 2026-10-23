/**
 * PARTY_IDENTITY: each party's colour, logo and chart style, the one place a party's look is set.
 *
 * `color` is the party colour as Swedish media and Valmyndigheten draw it (checked against the
 * parties' current logos in public/logos/parties/). `line` is the same hue, darkened where
 * needed to reach 3:1 against the page, for lines and small marks; for V it is darker still so
 * it does not read as S. `textColor` is the text to put on `color` (dark on SD's yellow).
 *
 * Colour is never the only cue: every party also has a `marker` and a `lineStyle`, chosen so
 * the parties that share a hue differ in both (S/V red, M/KD/L blue, C/MP green), and SD's
 * yellow line gets a dark `casing` so it stays visible on a light page. Charts put the party's
 * letters at the end of each line; logos go in pickers, table headers and summaries, never
 * on data points.
 *
 * The logos are the parties' current marks as Riksdagen shows them on "Ledamöter och
 * partier" (media.riksdagen.se), stored locally as WebP.
 */
import { l } from '../i18n'
import './parties.css'

export type Marker =
  'circle' | 'square' | 'diamond' | 'triangle' | 'triangle-down'
export type LineStyle = 'solid' | 'dashed' | 'dotted'

export type PartyIdentity = {
  code: string
  name: string
  nameEn: string
  color: string
  line: string
  /** Text colour on `color`. */
  ink: string
  logo: string | null
  website: string | null
  founded: number | null
  marker: Marker
  lineStyle: LineStyle
  /** A dark outline under the line, for light colours (SD). */
  casing?: string
}

const logo = (code: string) => `logos/parties/${code}.webp`

export const PARTY_IDENTITY: Record<string, PartyIdentity> = {
  S: {
    code: 'S',
    name: 'Socialdemokraterna',
    nameEn: 'Social Democrats',
    color: '#E8112D',
    line: '#E8112D',
    ink: '#ffffff',
    logo: logo('S'),
    website: 'https://www.socialdemokraterna.se',
    founded: 1889,
    marker: 'circle',
    lineStyle: 'solid',
  },
  M: {
    code: 'M',
    name: 'Moderaterna',
    nameEn: 'Moderates',
    color: '#52BDEC',
    line: '#357b9a',
    ink: '#16201f',
    logo: logo('M'),
    website: 'https://moderaterna.se',
    founded: 1904,
    marker: 'diamond',
    lineStyle: 'solid',
  },
  SD: {
    code: 'SD',
    name: 'Sverigedemokraterna',
    nameEn: 'Sweden Democrats',
    color: '#DDDD00',
    line: '#D4C600',
    ink: '#16201f',
    logo: logo('SD'),
    website: 'https://sd.se',
    founded: 1988,
    marker: 'triangle',
    lineStyle: 'solid',
    casing: '#5c5200',
  },
  V: {
    code: 'V',
    name: 'Vänsterpartiet',
    nameEn: 'Left Party',
    color: '#DA291C',
    line: '#9E1B12',
    ink: '#ffffff',
    logo: logo('V'),
    website: 'https://www.vansterpartiet.se',
    founded: 1917,
    marker: 'square',
    lineStyle: 'dashed',
  },
  C: {
    code: 'C',
    name: 'Centerpartiet',
    nameEn: 'Centre Party',
    color: '#009933',
    line: '#00852c',
    ink: '#16201f',
    logo: logo('C'),
    website: 'https://www.centerpartiet.se',
    founded: 1913,
    marker: 'circle',
    lineStyle: 'solid',
  },
  KD: {
    code: 'KD',
    name: 'Kristdemokraterna',
    nameEn: 'Christian Democrats',
    color: '#000077',
    line: '#000077',
    ink: '#ffffff',
    logo: logo('KD'),
    website: 'https://kristdemokraterna.se',
    founded: 1964,
    marker: 'triangle-down',
    lineStyle: 'dashed',
  },
  MP: {
    code: 'MP',
    name: 'Miljöpartiet',
    nameEn: 'Green Party',
    color: '#83CF39',
    line: '#518023',
    ink: '#16201f',
    logo: logo('MP'),
    website: 'https://www.mp.se',
    founded: 1981,
    marker: 'triangle',
    lineStyle: 'dashed',
  },
  L: {
    code: 'L',
    name: 'Liberalerna',
    nameEn: 'Liberals',
    color: '#006AB3',
    line: '#006AB3',
    ink: '#ffffff',
    logo: logo('L'),
    website: 'https://www.liberalerna.se',
    founded: 1934,
    marker: 'square',
    lineStyle: 'dotted',
  },
  NYD: {
    code: 'NYD',
    name: 'Ny demokrati',
    nameEn: 'New Democracy',
    color: '#8a8f8c',
    line: '#6b706d',
    ink: '#ffffff',
    logo: null,
    website: null,
    founded: 1991,
    marker: 'circle',
    lineStyle: 'dotted',
  },
  OTHER: {
    code: 'OTHER',
    name: 'Övriga',
    nameEn: 'Others',
    color: '#b8b5ab',
    line: '#6b7572',
    ink: '#16201f',
    logo: null,
    website: null,
    founded: null,
    marker: 'circle',
    lineStyle: 'dotted',
  },
}

const FALLBACK = PARTY_IDENTITY.OTHER
export const identity = (code: string) => PARTY_IDENTITY[code] ?? FALLBACK
/** The colour for a party's line, text or small mark on the page. */
export const partyLine = (code: string) => identity(code).line
/** SVG stroke-dasharray for a party's line style. */
export const partyDash = (code: string) =>
  ({ solid: undefined, dashed: '7 4', dotted: '2 4' })[identity(code).lineStyle]
export const partyName = (code: string) => {
  const p = identity(code)
  return l(p.nameEn, p.name)
}
