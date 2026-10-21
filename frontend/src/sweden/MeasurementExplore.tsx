/**
 * A — Politics of Measurement: the data types shared with Measurement.tsx and the Explore section
 * (counts per domain under both mappings, tables per year, the agency check and every item).
 */
import { useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import RankBars from '../charts/RankBars'
import MultiLineChart from '../charts/MultiLineChart'
import Agencies from './MeasurementAgencies'

export type Geo = 'national' | 'county' | 'municipality' | 'subarea'
export type Domain = {
  id: string
  label_en: string
  label_sv: string
  scope_en: string
  scb_tables: number
  kolada_kpis: number
  scb_current: number
  kolada_current: number
  scb_municipal: number
  scb_subannual: number
  first_year: number | null
  institutions: number
  geo: Record<Geo, number>
  scb_with_metadata: number
  scb_measures: number
}
type Counts = { scb: number; kolada: number }
/** The recount under the second mapping (title keywords, multi-label). */
export type Sensitivity = {
  items: number
  agree: number
  moved: number
  unmatched: number
  moved_share: number | null
  domains: Record<string, Counts>
  flows: ({ from: string; to: string } & Counts)[]
}
/** Items each catalogue credits to an agency the page names as holding a thin domain. */
export type Elsewhere = {
  agency: string
  holds: string
  items: number
  municipal: number
  domains: Record<string, number>
}[]
export type Summary = {
  current_from: number
  domains: Domain[]
  totals: {
    catalogue: string
    items: number
    first_year: number | null
    last_year: number | null
    institutions: number
  }[]
  sensitivity: Sensitivity
  elsewhere: Elsewhere
  provenance: {
    sources: { name: string; url: string; licence: string }[]
    fetched: { fetched_at: string | null; files?: number; bytes?: number }
    run_id: string | null
    code_sha: string | null
    models: string[]
    classification: string[]
    sensitivity: string[]
  }
}
export type Coverage = { rows: [string, number, Geo, number][] }
export type Items = { rows: (string | number | null)[][] }

export const BASE = 'sweden/measurement/'
export const GEO_LEVELS: Geo[] = [
  'national',
  'county',
  'municipality',
  'subarea',
]
export const GEO_LABEL: Record<Geo, [string, string]> = {
  national: ['Country only', 'Bara riket'],
  county: ['Counties', 'Län'],
  municipality: ['Municipalities', 'Kommuner'],
  subarea: ['Below municipality', 'Under kommun'],
}
export const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
export const name = (d: Domain) => l(d.label_en, d.label_sv)
export const pct = (x: number) =>
  `${(x * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 0 })} %`
const keywordTotal = (s: Sensitivity, id: string) =>
  (s.domains[id]?.scb ?? 0) + (s.domains[id]?.kolada ?? 0)

export default function Explore({
  summary,
  coverage,
  picked,
  onPick,
}: {
  summary: Summary
  coverage: Coverage | null
  picked: string | null
  onPick: (domain: string) => void
}) {
  const domains = summary.domains
  // The full list (about 2 MB) loads only when asked for, so the page's first data stays small.
  const [items, setItems] = useState<Items | 'loading' | 'error' | null>(null)
  const [query, setQuery] = useState('')
  const domain = picked ?? domains[0].id
  const loadItems = () => {
    setItems('loading')
    fetchJson<Items>(BASE + 'items.json').then(setItems, () =>
      setItems('error'),
    )
  }
  const series = useMemo(() => {
    if (!coverage) return []
    const per = new Map<string, Map<number, number>>()
    for (const [d, year, , tables] of coverage.rows) {
      if (year < 1950) continue
      const m = per.get(d) ?? new Map()
      m.set(year, (m.get(year) ?? 0) + tables)
      per.set(d, m)
    }
    const order = [...domains].sort((a, b) => b.scb_tables - a.scb_tables)
    const keys = [...new Set([domain, ...order.map((d) => d.id)])].slice(0, 5)
    return keys
      .filter((k) => per.has(k))
      .map((k) => ({
        key: k,
        name: name(domains.find((d) => d.id === k)!),
        points: [...per.get(k)!.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([y, v]) => ({
            date: `${y}-01-01`,
            label: String(y),
            value: v,
          })),
      }))
  }, [coverage, domain, domains])
  const shown = useMemo(() => {
    if (!items || typeof items === 'string') return []
    const q = query.trim().toLowerCase()
    return items.rows
      .filter(
        (r) =>
          r[3] === domain && (!q || String(r[2]).toLowerCase().includes(q)),
      )
      .slice(0, 200)
  }, [items, domain, query])
  const keys = series.map((s) => s.key)
  return (
    <>
      <h3>
        {l(
          'Published tables and key figures per domain',
          'Publicerade tabeller och nyckeltal per domän',
        )}
      </h3>
      <RankBars
        label={l('SCB tables per domain', 'SCB-tabeller per domän')}
        format={num}
        picked={picked}
        onPick={onPick}
        rows={[...domains]
          .sort(
            (a, b) =>
              b.scb_tables + b.kolada_kpis - a.scb_tables - a.kolada_kpis,
          )
          .map((d) => ({
            key: d.id,
            label: name(d),
            value: d.scb_tables + d.kolada_kpis,
            note: `SCB ${num(d.scb_tables)} · Kolada ${num(d.kolada_kpis)}`,
          }))}
      />
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption>
            {l('Every domain in numbers', 'Varje domän i siffror')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Domain', 'Domän')}</th>
              <th scope="col" className="sw-n">
                SCB
              </th>
              <th scope="col" className="sw-n">
                {l(
                  `SCB, data ${summary.current_from}+`,
                  `SCB, data ${summary.current_from}+`,
                )}
              </th>
              <th scope="col" className="sw-n">
                {l('SCB monthly/quarterly', 'SCB månad/kvartal')}
              </th>
              {GEO_LEVELS.map((g) => (
                <th key={g} scope="col" className="sw-n">
                  SCB: {l(...GEO_LABEL[g])}
                </th>
              ))}
              <th scope="col" className="sw-n">
                Kolada
              </th>
              <th scope="col" className="sw-n">
                {l('Kolada current', 'Kolada aktuella')}
              </th>
              <th scope="col" className="sw-n">
                {l('First year', 'Första år')}
              </th>
              <th scope="col" className="sw-n">
                {l('Keyword mapping', 'Nyckelordsindelning')}
              </th>
              <th scope="col" className="sw-n">
                {l('SCB contents, regional', 'SCB-innehåll, regionala')}
              </th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.id}>
                <th scope="row">{name(d)}</th>
                <td className="sw-n">{num(d.scb_tables)}</td>
                <td className="sw-n">{num(d.scb_current)}</td>
                <td className="sw-n">{num(d.scb_subannual)}</td>
                {GEO_LEVELS.map((g) => (
                  <td key={g} className="sw-n">
                    {num(d.geo[g])}
                  </td>
                ))}
                <td className="sw-n">{num(d.kolada_kpis)}</td>
                <td className="sw-n">{num(d.kolada_current)}</td>
                <td className="sw-n">{d.first_year ?? '–'}</td>
                <td className="sw-n">
                  {d.id === 'other'
                    ? '–'
                    : num(keywordTotal(summary.sensitivity, d.id))}
                </td>
                <td className="sw-n">
                  {num(d.scb_measures)} / {num(d.scb_with_metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sw-note">
        {l(
          `Keyword mapping: SCB tables and Kolada key figures whose title matches the domain’s words; one item can count in several domains. Under it, ${num(summary.sensitivity.moved)} of ${num(summary.sensitivity.items)} items (${pct(summary.sensitivity.moved_share ?? 0)}) match only domains other than their own, and ${num(summary.sensitivity.unmatched)} match none. SCB contents: the contents listed in the metadata of the SCB tables that have a region variable, over the number of such tables; metadata is fetched for those tables only.`,
          `Nyckelordsindelning: SCB-tabeller och Kolada-nyckeltal vars titel innehåller domänens ord; en post kan räknas i flera domäner. Med den matchar ${num(summary.sensitivity.moved)} av ${num(summary.sensitivity.items)} poster (${pct(summary.sensitivity.moved_share ?? 0)}) bara andra domäner än sin egen, och ${num(summary.sensitivity.unmatched)} matchar ingen. SCB-innehåll: innehållen i metadata för de SCB-tabeller som har en regionvariabel, delat med antalet sådana tabeller; metadata hämtas bara för dem.`,
        )}
      </p>

      <Agencies elsewhere={summary.elsewhere} domains={domains} />

      <h3>
        {l(
          'SCB tables reporting each year, since 1950',
          'SCB-tabeller som rapporterar varje år, sedan 1950',
        )}
      </h3>
      {series.length > 0 && (
        <MultiLineChart
          series={series}
          label={l(
            'SCB tables per year by domain',
            'SCB-tabeller per år och domän',
          )}
          format={num}
          colorOf={(k) => keys.indexOf(k) + 1}
        />
      )}

      <h3>
        {l(
          'Tables and key figures in a domain',
          'Tabeller och nyckeltal i en domän',
        )}
      </h3>
      <div className="sw-controls">
        <label>
          {l('Domain', 'Domän')}
          <select value={domain} onChange={(e) => onPick(e.target.value)}>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {name(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Search titles', 'Sök i titlar')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {items === null ? (
        <button type="button" className="sw-link" onClick={loadItems}>
          {l(
            'Show every table and key figure',
            'Visa varje tabell och nyckeltal',
          )}
        </button>
      ) : items === 'error' ? (
        <p className="sw-note" role="status">
          {l('The list could not be read.', 'Listan kunde inte läsas.')}
        </p>
      ) : items !== 'loading' ? (
        <div className="sw-table-wrap">
          <table className="sw-table">
            <caption className="visually-hidden">
              {l('Tables and key figures', 'Tabeller och nyckeltal')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{l('Catalogue', 'Katalog')}</th>
                <th scope="col">{l('Title', 'Titel')}</th>
                <th scope="col">{l('Source', 'Källa')}</th>
                <th scope="col">{l('Frequency', 'Frekvens')}</th>
                <th scope="col" className="sw-n">
                  {l('Period', 'Period')}
                </th>
                <th scope="col">{l('Finest geography', 'Finaste geografi')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r[0]}-${r[1]}`}>
                  <td className="sw-mono">
                    {r[0] === 'scb' ? 'SCB' : 'Kolada'} {r[1]}
                  </td>
                  <td>{r[2]}</td>
                  <td>{r[4]}</td>
                  <td>{r[6]}</td>
                  <td className="sw-n">
                    {r[7] ? `${r[7]}–${r[8]}` : (r[8] ?? '–')}
                  </td>
                  <td>{l(...GEO_LABEL[r[9] as Geo])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 200 && (
            <p className="sw-note">
              {l(
                'First 200 rows; narrow the search.',
                'De första 200 raderna; smalna av sökningen.',
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="sw-note" role="status">
          {l('Loading…', 'Laddar…')}
        </p>
      )}
    </>
  )
}
