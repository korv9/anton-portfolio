/**
 * B — The Ideal Human, Explore: trends per category, the three measures side by side, the
 * composition of a change by occupation and employer, comparisons by occupation field and
 * county, the patterns and masked examples. From sweden/language/*.json (export_language.py).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import MultiLineChart from '../charts/MultiLineChart'
import RankBars from '../charts/RankBars'
import { CompositionTable, type Composition } from './LanguageMeasures'

/** year, texts, matching, matches, words, share, share mix fixed, per 1,000 words, per 1,000
 * words mix fixed, share within 2010 length bands mix fixed; the mix-fixed values are null
 * where a year records no occupations. */
export type Row = [
  number,
  number,
  number,
  number,
  number,
  number,
  number | null,
  number,
  number | null,
  number | null,
]
export type Category = {
  id: string
  family: 'skill' | 'personal'
  label_en: string
  label_sv: string
  description_en: string
  pattern: string
  rows: Row[]
  break: {
    first_year_after: number
    mean_before: number
    mean_after: number
    variance_explained: number
  } | null
}
type Cells = { rows: [string, string, number, number, number][] }
type Examples = { rows: string[][] }

export const BASE = 'sweden/language/'
export const pct = (v: number) => `${(v * 100).toFixed(1)} %`
export const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
export const name = (c: Category) => l(c.label_en, c.label_sv)

export default function Explore({
  agreement,
  cats,
  years,
  picked,
  onPick,
}: {
  agreement: ReactNode
  cats: Category[]
  years: number[]
  picked: string | null
  onPick: (category: string) => void
}) {
  const [fields, setFields] = useState<Cells | null>(null)
  const [regions, setRegions] = useState<Cells | null>(null)
  const [examples, setExamples] = useState<Examples | null>(null)
  const [composition, setComposition] = useState<Composition | null>(null)
  const [by, setBy] = useState<'field' | 'region'>('field')
  const category = picked ?? cats[1]?.id ?? cats[0].id
  const last = years[years.length - 1]
  const [year, setYear] = useState(last)
  useEffect(() => {
    fetchJson<Cells>(BASE + 'fields.json').then(setFields, () => {})
    fetchJson<Cells>(BASE + 'regions.json').then(setRegions, () => {})
    fetchJson<Examples>(BASE + 'examples.json').then(setExamples, () => {})
    fetchJson<Composition>(BASE + 'composition.json').then(
      setComposition,
      () => {},
    )
  }, [])
  const lines = useMemo(() => {
    const keys = [...new Set([category, ...cats.map((c) => c.id)])].slice(0, 5)
    return keys.map((k) => {
      const c = cats.find((x) => x.id === k)!
      return {
        key: k,
        name: name(c),
        // The mix-fixed rate exists from the first year that records occupations.
        points: c.rows
          .filter((r) => r[8] != null)
          .map((r, i, rows) => ({
            date: `${r[0]}-01-01`,
            label: String(r[0]),
            value: r[8]!,
            // A gap of more than a year is a break in the line, never an interpolation.
            breakBefore: i > 0 && r[0] - rows[i - 1][0] > 1,
          })),
      }
    })
  }, [cats, category])
  const cells = by === 'field' ? fields : regions
  const ranked = (cells?.rows ?? [])
    .filter((r) => r[1] === category && r[2] === year)
    .map((r) => ({
      key: r[0],
      label: r[0],
      value: r[4] / r[3],
      note: `${num(r[4])} / ${num(r[3])}`,
    }))
    .sort((a, b) => b.value - a.value)
  const cat = cats.find((c) => c.id === category)!
  return (
    <>
      <div className="sw-controls">
        <label>
          {l('Category', 'Kategori')}
          <select value={category} onChange={(e) => onPick(e.target.value)}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {name(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3>
        {l(
          'Matches per 1,000 words, occupation mix fixed',
          'Träffar per 1 000 ord, fast yrkesmix',
        )}
      </h3>
      <MultiLineChart
        series={lines}
        label={l(
          'Standardised rate per year',
          'Standardiserad frekvens per år',
        )}
        format={(v) => v.toFixed(2)}
        colorOf={(k) => lines.findIndex((s) => s.key === k) + 1}
        yFrom={0}
      />
      <div className="sw-table-wrap" tabIndex={0}>
        <table className="sw-table">
          <caption>
            {l('Every category and year', 'Varje kategori och år')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Category', 'Kategori')}</th>
              <th scope="col" className="sw-n">
                {l('Year', 'År')}
              </th>
              <th scope="col" className="sw-n">
                {l('Distinct texts', 'Unika texter')}
              </th>
              <th scope="col" className="sw-n">
                {l('Using it', 'Använder den')}
              </th>
              <th scope="col" className="sw-n">
                {l('Share', 'Andel')}
              </th>
              <th scope="col" className="sw-n">
                {l('Standardised', 'Standardiserad')}
              </th>
              <th scope="col" className="sw-n">
                {l('Per 1,000 words', 'Per 1 000 ord')}
              </th>
              <th scope="col" className="sw-n">
                {l('Per 1,000 words, mix fixed', 'Per 1 000 ord, fast mix')}
              </th>
              <th scope="col" className="sw-n">
                {l('Words per text', 'Ord per text')}
              </th>
            </tr>
          </thead>
          <tbody>
            {cats.flatMap((c) =>
              c.rows.map((r) => (
                <tr key={c.id + r[0]}>
                  <th scope="row">{name(c)}</th>
                  <td className="sw-n">{r[0]}</td>
                  <td className="sw-n">{num(r[1])}</td>
                  <td className="sw-n">{num(r[2])}</td>
                  <td className="sw-n">{pct(r[5])}</td>
                  <td className="sw-n">{r[6] == null ? '–' : pct(r[6])}</td>
                  <td className="sw-n">{r[7].toFixed(2)}</td>
                  <td className="sw-n">
                    {r[8] == null ? '–' : r[8].toFixed(2)}
                  </td>
                  <td className="sw-n">{Math.round(r[4] / r[1])}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <h3>
        {l('Three measures of the same change', 'Tre mått på samma förändring')}
      </h3>
      {agreement}
      {composition && (
        <>
          <h3>
            {l(
              'Who advertises: occupation and employer',
              'Vem som annonserar: yrke och arbetsgivare',
            )}
          </h3>
          <p className="sw-note">
            {l(
              'A change in the national rate can come from change inside each group of ads or from a shift towards groups that use the category more. Each row splits the same change by one grouping; rows by occupation leave out texts without a recorded occupation, and the last column gives the share kept.',
              'En förändring i den nationella nivån kan komma från förändring inom varje grupp av annonser eller från en förskjutning mot grupper som använder kategorin mer. Varje rad delar samma förändring efter en gruppering; rader efter yrke utelämnar texter utan registrerat yrke, och sista kolumnen anger andelen som är kvar.',
            )}
          </p>
          <CompositionTable data={composition} category={category} />
        </>
      )}

      <h3>{l('By occupation field or county', 'Per yrkesområde eller län')}</h3>
      <div className="sw-controls">
        <label>
          {l('Compare', 'Jämför')}
          <select
            value={by}
            onChange={(e) => setBy(e.target.value as 'field' | 'region')}
          >
            <option value="field">
              {l('Occupation fields', 'Yrkesområden')}
            </option>
            <option value="region">{l('Counties', 'Län')}</option>
          </select>
        </label>
        <label>
          {l('Year', 'År')}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {ranked.length ? (
        <RankBars
          rows={ranked}
          format={pct}
          max={1}
          label={l(
            `${name(cat)} by ${by}`,
            `${name(cat)} per ${by === 'field' ? 'yrkesområde' : 'län'}`,
          )}
        />
      ) : (
        <p className="sw-note">{l('Loading…', 'Laddar…')}</p>
      )}
      <p className="sw-note">
        {l(
          'Crude shares; cells with fewer than 30 distinct texts are left out.',
          'Råa andelar; celler med färre än 30 unika texter är utelämnade.',
        )}
      </p>

      <h3>{l('The pattern and examples', 'Mönstret och exempel')}</h3>
      <p className="sw-note">{cat.description_en}</p>
      <pre className="sw-mono sw-pattern">{cat.pattern}</pre>
      {examples && (
        <ul className="sw-examples">
          {examples.rows
            .filter((r) => r[0] === category)
            .map((r, i) => (
              <li key={i}>
                <span className="sw-mono">
                  {r[1]} · {r[3]}
                </span>{' '}
                <q>{r[6]}</q>
              </li>
            ))}
        </ul>
      )}
      <p className="sw-note">
        {l(
          'Drawn reproducibly by the lowest hash of the ad text; e-mail addresses and phone numbers masked.',
          'Dragna reproducerbart med lägsta hash av annonstexten; e-postadresser och telefonnummer maskerade.',
        )}
      </p>
    </>
  )
}
