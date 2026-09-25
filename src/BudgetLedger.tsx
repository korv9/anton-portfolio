import { useMemo, useState } from 'react'

export type BudgetLine = { session: string; budget_year: number; expenditure_area: number; expenditure_area_name: string; actor: string; amount_msek: number; deviation_msek: number; source_url: string }
const money = (msek: number) => Math.abs(msek) < 100 ? `${msek.toLocaleString('en-GB', { maximumFractionDigits: 1 })} m SEK` : `${(msek / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })} bn SEK`
const signed = (msek: number) => `${msek > 0 ? '+' : msek < 0 ? '−' : ''}${money(Math.abs(msek))}`

export default function BudgetLedger({ rows, nameOf }: { rows: BudgetLine[]; nameOf: (area: number) => string }) {
  const [year, setYear] = useState('2025/26')
  const [actor, setActor] = useState('S')
  const [selectedArea, setSelectedArea] = useState(9)
  const years = [...new Set(rows.map(row => row.session))].sort().reverse()
  const inYear = rows.filter(row => row.session === year)
  const actors = [...new Set(inYear.map(row => row.actor))].sort((a, b) => a === 'GOV' ? -1 : b === 'GOV' ? 1 : a.localeCompare(b))
  const chosen = actors.includes(actor) ? actor : 'GOV'
  const own = inYear.filter(row => row.actor === chosen)
  const government = new Map(inYear.filter(row => row.actor === 'GOV').map(row => [row.expenditure_area, row]))
  const byArea = new Map(own.map(row => [row.expenditure_area, row]))
  const budgetYear = inYear[0]?.budget_year
  const display = useMemo(() => Array.from({ length: 27 }, (_, index) => index + 1).map(area => {
    const row = byArea.get(area), gov = government.get(area)
    return { area, row, gov, difference: row && gov ? row.amount_msek - gov.amount_msek : null }
  }), [own, inYear])
  const complete = own.length === 27 && government.size === 27
  const top = [...display].filter(item => item.row).sort((a, b) => chosen === 'GOV' ? (b.row?.amount_msek ?? 0) - (a.row?.amount_msek ?? 0) : Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0)).slice(0, 7)
  const max = Math.max(1, ...top.map(item => chosen === 'GOV' ? item.row?.amount_msek ?? 0 : Math.abs(item.difference ?? 0)))
  const focus = display.find(item => item.area === selectedArea)
  const total = own.reduce((sum, row) => sum + row.amount_msek, 0)
  const govTotal = [...government.values()].reduce((sum, row) => sum + row.amount_msek, 0)
  return <section className="budget-ledger" aria-label="Browse budget proposals">
    <p className="eyebrow">Budget proposals / the money</p><h4>Choose a year and see each proposed spending frame.</h4>
    <p>All amounts below are proposed expenditure by area for the selected budget year. “Difference” means compared with the government's proposal for that same year. It is not a change from the previous year, actual spending or a measure of a party's support in a vote.</p>
    <div className="budget-controls"><label>Budget year<select value={year} onChange={e => { setYear(e.target.value); setActor('GOV') }}>{years.map(value => <option key={value}>{value}</option>)}</select></label><label>Proposal<select value={chosen} onChange={e => setActor(e.target.value)}>{actors.map(value => <option key={value} value={value}>{value === 'GOV' ? 'Government (collective)' : value}</option>)}</select></label></div>
    <div className="budget-ledger-summary"><div><strong>{budgetYear}</strong><span>Budget year · session {year}</span></div><div><strong>{own.length}/27</strong><span>Areas present for {chosen}</span></div><div><strong>{complete ? money(total) : 'Incomplete'}</strong><span>{complete ? 'Total proposed expenditure' : 'No comparable total calculated'}</span></div><div><strong>{complete && chosen !== 'GOV' ? signed(total - govTotal) : '—'}</strong><span>Versus government · complete frames only</span></div></div>
    <p className="budget-ledger-coverage">Available in this import: {actors.map(code => `${code} ${inYear.filter(row => row.actor === code).length}/27`).join(' · ')}. A missing separate party frame cannot be inferred from the collective government proposal.</p>
    <div className="budget-ledger-layout"><div><p className="eyebrow">{chosen === 'GOV' ? 'Largest spending areas' : 'Largest differences, either direction'}</p>{top.map(({ area, row, difference }) => <button key={area} className="budget-ledger-bar" aria-pressed={selectedArea === area} onClick={() => setSelectedArea(area)}><span><b>{nameOf(area)}</b><strong>{chosen === 'GOV' ? money(row!.amount_msek) : signed(difference ?? 0)}</strong></span><i className={difference != null && difference < 0 ? 'negative' : ''} style={{ width: `${Math.max(1, (chosen === 'GOV' ? row!.amount_msek : Math.abs(difference ?? 0)) / max * 100)}%` }} /></button>)}</div><aside className="budget-ledger-detail"><p className="eyebrow">Area {selectedArea} · {nameOf(selectedArea)}</p>{focus?.row ? <><strong>{money(focus.row.amount_msek)}</strong><p>{chosen === 'GOV' ? 'Government proposal' : `${chosen}'s proposal`}{focus.gov && chosen !== 'GOV' ? ` · ${signed(focus.difference ?? 0)} relative to government` : ''}</p><a href={focus.row.source_url} target="_blank" rel="noreferrer">Read the parliamentary comparison table ↗</a></> : <p>This proposal has no imported row for this area.</p>}</aside></div>
    <details className="budget-ledger-all"><summary>View all 27 expenditure areas and source amounts</summary><div className="coverage-scroll" tabIndex={0} aria-label="All expenditure areas, scroll horizontally"><table><thead><tr><th scope="col">Area</th><th scope="col">Government amount</th><th scope="col">{chosen} amount</th><th scope="col">Difference</th><th scope="col">Source</th></tr></thead><tbody>{display.map(({ area, row, gov, difference }) => <tr key={area}><th scope="row">{area}. {nameOf(area)}</th><td>{gov ? money(gov.amount_msek) : 'Missing'}</td><td>{row ? money(row.amount_msek) : 'Missing'}</td><td>{difference == null ? '—' : signed(difference)}</td><td>{row && <a href={row.source_url} target="_blank" rel="noreferrer">Riksdagen ↗</a>}</td></tr>)}</tbody></table></div></details>
  </section>
}
