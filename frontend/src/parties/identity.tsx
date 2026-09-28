/**
 * Each party's colour and logo, used everywhere a party is shown.
 *
 * `color` is the party colour as Swedish media and Wikipedia draw it. `line` is the same hue,
 * darkened where needed to reach 3:1 against the page, for lines, text and small marks (and
 * for V, darker still so it does not read as S). `ink` is the text colour to put on `color`.
 * The logos are the parties' current marks as Riksdagen shows them on "Ledamöter och
 * partier" (media.riksdagen.se), saved under public/logos/parties/.
 */
import { l } from '../i18n'
import './parties.css'

export type PartyIdentity = {
  code: string
  name: string
  nameEn: string
  color: string
  line: string
  ink: string
  logo: string | null
  website: string | null
  founded: number | null
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
  },
  M: {
    code: 'M',
    name: 'Moderaterna',
    nameEn: 'Moderates',
    color: '#52BDEC',
    line: '#3E8FB3',
    ink: '#16201f',
    logo: logo('M'),
    website: 'https://moderaterna.se',
    founded: 1904,
  },
  SD: {
    code: 'SD',
    name: 'Sverigedemokraterna',
    nameEn: 'Sweden Democrats',
    color: '#DDDD00',
    line: '#898900',
    ink: '#16201f',
    logo: logo('SD'),
    website: 'https://sd.se',
    founded: 1988,
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
  },
  C: {
    code: 'C',
    name: 'Centerpartiet',
    nameEn: 'Centre Party',
    color: '#009933',
    line: '#009933',
    ink: '#16201f',
    logo: logo('C'),
    website: 'https://www.centerpartiet.se',
    founded: 1913,
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
  },
  MP: {
    code: 'MP',
    name: 'Miljöpartiet',
    nameEn: 'Green Party',
    color: '#83CF39',
    line: '#5B9027',
    ink: '#16201f',
    logo: logo('MP'),
    website: 'https://www.mp.se',
    founded: 1981,
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
  },
  OTHER: {
    code: 'OTHER',
    name: 'Övriga',
    nameEn: 'Others',
    color: '#b8b5ab',
    line: '#76817e',
    ink: '#16201f',
    logo: null,
    website: null,
    founded: null,
  },
}

/** The eight parties in the Riksdag. */
export const RIKSDAG_PARTIES = ['S', 'SD', 'M', 'V', 'C', 'KD', 'MP', 'L']

const FALLBACK = PARTY_IDENTITY.OTHER
export const identity = (code: string) => PARTY_IDENTITY[code] ?? FALLBACK
/** The colour for a party's line, text or small mark on the page. */
export const partyLine = (code: string) => identity(code).line
/** The party colour, for filled areas; put `identity(code).ink` on it. */
export const partyFill = (code: string) => identity(code).color
export const partyName = (code: string) => {
  const p = identity(code)
  return l(p.nameEn, p.name)
}

/** The party's logo, or its letters on its colour where there is no logo. */
export function PartyLogo({
  party,
  size = 20,
  className,
}: {
  party: string
  size?: number
  className?: string
}) {
  const p = identity(party)
  const cls = className ? `party-logo ${className}` : 'party-logo'
  if (p.logo)
    return (
      <img
        className={cls}
        src={p.logo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    )
  return (
    <span
      className={`${cls} party-logo-text`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: p.color,
        color: p.ink,
        fontSize: size * 0.42,
      }}
    >
      {party === 'OTHER' ? '…' : party}
    </span>
  )
}

/** A party's logo and short name, e.g. in lists of how parties voted. */
export function PartyTag({
  party,
  size = 16,
}: {
  party: string
  size?: number
}) {
  return (
    <span className="party-tag" title={partyName(party)}>
      <PartyLogo party={party} size={size} />
      <span>{party === 'OTHER' ? l('Other', 'Övr.') : party}</span>
    </span>
  )
}

/** A party's logo and full name, linking to its page where it has one. */
export function PartyName({
  party,
  size = 18,
}: {
  party: string
  size?: number
}) {
  const content = (
    <>
      <PartyLogo party={party} size={size} />
      <span>{partyName(party)}</span>
    </>
  )
  return RIKSDAG_PARTIES.includes(party) ? (
    <a className="party-name" href={`#parties-${party.toLowerCase()}`}>
      {content}
    </a>
  ) : (
    <span className="party-name">{content}</span>
  )
}
