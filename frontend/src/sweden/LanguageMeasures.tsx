/**
 * B — The Ideal Human: each category's change in three measures with their agreement, and the
 * composition of a change by occupation and employer. From trends.json and composition.json
 * (export_language.py); the agreement rule is in languageChange.ts.
 */
import { l } from '../i18n'
import { agreement, type Agreement } from './languageChange'
import type { Category, Row } from './LanguageExplore'

export type Sub = {
  id: string
  parent: string
  label_en: string
  label_sv: string
  pattern: string
  rows: Row[]
}
export type Composition = {
  end: number
  bases: number[]
  rows: [
    string,
    number,
    string,
    string,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ][]
  agencies: { rows: [number, number, number, number][] }
  without_agencies: {
    rows: [string, number, string, number, number, number, number][]
  }
}

/** Share of ads, per 1,000 words and share within 2010 length bands, all with the mix fixed. */
export const MEASURES: [number, string, string][] = [
  [6, 'Share of ads', 'Andel annonser'],
  [8, 'Per 1,000 words', 'Per 1 000 ord'],
  [9, 'Share at equal length', 'Andel vid samma längd'],
]
const rel = (v: number | null) =>
  v == null ? '–' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)} %`
const AGREE: Record<Agreement, [string, string]> = {
  rise: ['Up in all three', 'Upp i alla tre'],
  fall: ['Down in all three', 'Ned i alla tre'],
  mixed: ['Depends on the measure', 'Beror på måttet'],
}

/** Relative change of one measure from a baseline year to the end year, or null. */
export const changeIn = (
  rows: Row[],
  base: number,
  end: number,
  index: number,
) => {
  const a = rows.find((r) => r[0] === base)?.[index] as number | null
  const b = rows.find((r) => r[0] === end)?.[index] as number | null
  return a == null || b == null || a <= 0 ? null : b / a - 1
}

/** Agreement over every measure and every baseline year. */
export const stability = (rows: Row[], bases: number[], end: number) =>
  agreement(
    bases.flatMap((b) => MEASURES.map(([i]) => changeIn(rows, b, end, i))),
  )

export function MeasureAgreement({
  cats,
  subs,
  bases,
  end,
}: {
  cats: Category[]
  subs: Sub[]
  bases: number[]
  end: number
}) {
  const from = bases[0]
  const line = (key: string, label: string, rows: Row[], part = false) => {
    const a = stability(rows, bases, end)
    return (
      <tr key={key} data-part={part || undefined}>
        <th scope="row">{part ? `– ${label}` : label}</th>
        {MEASURES.map(([i]) => (
          <td key={i} className="sw-n">
            {rel(changeIn(rows, from, end, i))}
          </td>
        ))}
        <td className="sw-agree" data-agree={a}>
          {l(...AGREE[a])}
        </td>
      </tr>
    )
  }
  return (
    <div className="sw-table-wrap" tabIndex={0}>
      <table className="sw-table">
        <caption>
          {l(
            `Change ${from}–${end} in three measures, occupation mix fixed`,
            `Förändring ${from}–${end} i tre mått, fast yrkesmix`,
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col">{l('Category', 'Kategori')}</th>
            {MEASURES.map(([i, en, sv]) => (
              <th key={i} scope="col" className="sw-n">
                {l(en, sv)}
              </th>
            ))}
            <th scope="col">{l('Direction', 'Riktning')}</th>
          </tr>
        </thead>
        <tbody>
          {cats.flatMap((c) => [
            line(c.id, l(c.label_en, c.label_sv), c.rows),
            ...subs
              .filter((s) => s.parent === c.id)
              .map((s) => line(s.id, l(s.label_en, s.label_sv), s.rows, true)),
          ])}
        </tbody>
      </table>
    </div>
  )
}

const GROUPINGS: Record<string, [string, string]> = {
  field: ['21 occupation fields', '21 yrkesområden'],
  occupation: ['SSYK-4 occupation groups', 'SSYK-4 yrkesgrupper'],
  employer: ['Employer type', 'Arbetsgivartyp'],
  occupation_employer: [
    'Occupation group × employer type',
    'Yrkesgrupp × arbetsgivartyp',
  ],
}

export function CompositionTable({
  data,
  category,
}: {
  data: Composition
  category: string
}) {
  const base = data.bases[0]
  const mine = data.rows.filter((r) => r[0] === category && r[1] === base)
  const show = (v: number, m: string) =>
    m === 'share' ? `${(v * 100).toFixed(1)} %` : v.toFixed(2)
  const diff = (v: number, m: string) =>
    `${v >= 0 ? '+' : '−'}${m === 'share' ? `${Math.abs(v * 100).toFixed(1)} pp` : Math.abs(v).toFixed(2)}`
  const agency = (y: number) => {
    const r = data.agencies.rows.find((x) => x[0] === y)
    return r && r[1] ? `${((r[2] / r[1]) * 100).toFixed(1)} %` : '–'
  }
  const without = data.without_agencies.rows.filter(
    (r) => r[0] === category && r[1] === base,
  )
  return (
    <>
      <div className="sw-table-wrap" tabIndex={0}>
        <table className="sw-table">
          <caption>
            {l(
              `Change ${base}–${data.end} split into a part within groups and a part from the groups' mix (as published, mix not fixed)`,
              `Förändring ${base}–${data.end} uppdelad i en del inom grupper och en del från gruppernas mix (som publicerat, mixen inte fast)`,
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Groups', 'Grupper')}</th>
              <th scope="col">{l('Measure', 'Mått')}</th>
              <th scope="col" className="sw-n">
                {base}
              </th>
              <th scope="col" className="sw-n">
                {data.end}
              </th>
              <th scope="col" className="sw-n">
                {l('Within groups', 'Inom grupper')}
              </th>
              <th scope="col" className="sw-n">
                {l('From the mix', 'Från mixen')}
              </th>
              <th scope="col" className="sw-n">
                {l('Texts with a known group', 'Texter med känd grupp')}
              </th>
            </tr>
          </thead>
          <tbody>
            {mine.map((r) => (
              <tr key={r[2] + r[3]}>
                <th scope="row">
                  {l(...GROUPINGS[r[2]])}{' '}
                  <span className="sw-mono">({r[8]})</span>
                </th>
                <td>
                  {r[3] === 'share'
                    ? l('share of ads', 'andel annonser')
                    : l('per 1,000 words', 'per 1 000 ord')}
                </td>
                <td className="sw-n">{show(r[4], r[3])}</td>
                <td className="sw-n">{show(r[5], r[3])}</td>
                <td className="sw-n">{diff(r[6], r[3])}</td>
                <td className="sw-n">{diff(r[7], r[3])}</td>
                <td className="sw-n">
                  {Math.round(r[9] * 100)} → {Math.round(r[10] * 100)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sw-note">
        {l(
          `Staffing and recruitment agencies, read from the employer name, wrote ${agency(base)} of distinct texts in ${base} and ${agency(data.end)} in ${data.end}.`,
          `Bemannings- och rekryteringsföretag, lästa ur arbetsgivarnamnet, skrev ${agency(base)} av de unika texterna ${base} och ${agency(data.end)} ${data.end}.`,
        )}{' '}
        {without.map((r) => (
          <span key={r[2]}>
            {l(
              `Without them, ${r[2] === 'share' ? 'the share of ads' : 'the rate per 1,000 words'} goes from ${show(r[5], r[2])} to ${show(r[6], r[2])} (with them ${show(r[3], r[2])} to ${show(r[4], r[2])}). `,
              `Utan dem går ${r[2] === 'share' ? 'andelen annonser' : 'frekvensen per 1 000 ord'} från ${show(r[5], r[2])} till ${show(r[6], r[2])} (med dem ${show(r[3], r[2])} till ${show(r[4], r[2])}). `,
            )}
          </span>
        ))}
      </p>
    </>
  )
}
