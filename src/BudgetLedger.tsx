import { currentLocale, t } from './i18n'
import { useMemo, useState } from 'react'

export type BudgetLine = { session: string; budget_year: number; expenditure_area: number; expenditure_area_name: string; actor: string; amount_msek: number; deviation_msek: number; source_url: string }
const money = (msek: number) => {
  const sv = currentLocale() === 'sv'
  const amount = Math.abs(msek) < 100 ? msek : msek / 1000
  return `${amount.toLocaleString(sv ? 'sv-SE' : 'en-GB', { maximumFractionDigits: 1 })} ${Math.abs(msek) < 100 ? (sv ? 'mnkr' : 'm SEK') : (sv ? 'mdkr' : 'bn SEK')}`
}
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
  return <section className="budget-ledger" aria-label={t("Browse budget proposals")}>
    <p className="eyebrow">{t("Budget proposals / the money")}</p><h4>{t("Choose a year and see each proposed spending frame.")}</h4>
    <p>{t("All amounts below are proposed expenditure by area for the selected budget year. “Difference” means compared with the government's proposal for that same year. It is not a change from the previous year, actual spending or a measure of a party's support in a vote.")}</p>
    <div className="budget-controls"><label>{t("Budget year")}<select value={year} onChange={e => { setYear(e.target.value); setActor('GOV') }}>{years.map(value => <option key={value}>{value}</option>)}</select></label><label>{t("Proposal")}<select value={chosen} onChange={e => setActor(e.target.value)}>{actors.map(value => <option key={value} value={value}>{value === 'GOV' ? 'Government (collective)' : value}</option>)}</select></label></div>
    <div className="budget-ledger-summary"><div><strong>{budgetYear}</strong><span>{t("Budget year · session ")}{year}</span></div><div><strong>{own.length}/27</strong><span>{t("Areas present for ")}{chosen}</span></div><div><strong>{complete ? money(total) : t('Incomplete')}</strong><span>{t(complete ? 'Total proposed expenditure' : 'No comparable total calculated')}</span></div><div><strong>{complete && chosen !== 'GOV' ? signed(total - govTotal) : '—'}</strong><span>{t("Versus government · complete frames only")}</span></div></div>
    <p className="budget-ledger-coverage">{t("Available in this import: ")}{actors.map(code => `${code} ${inYear.filter(row => row.actor === code).length}/27`).join(' · ')}{t(". A missing separate party frame cannot be inferred from the collective government proposal.")}</p>
    <div className="budget-ledger-layout"><div><p className="eyebrow">{t(chosen === 'GOV' ? 'Largest spending areas' : 'Largest differences, either direction')}</p>{top.map(({ area, row, difference }) => <button key={area} className="budget-ledger-bar" aria-pressed={selectedArea === area} onClick={() => setSelectedArea(area)}><span><b>{nameOf(area)}</b><strong>{chosen === 'GOV' ? money(row!.amount_msek) : signed(difference ?? 0)}</strong></span><i className={difference != null && difference < 0 ? 'negative' : ''} style={{ width: `${Math.max(1, (chosen === 'GOV' ? row!.amount_msek : Math.abs(difference ?? 0)) / max * 100)}%` }} /></button>)}</div><aside className="budget-ledger-detail"><p className="eyebrow">{t("Area ")}{selectedArea} · {nameOf(selectedArea)}</p>{focus?.row ? <><strong>{money(focus.row.amount_msek)}</strong><p>{chosen === 'GOV' ? t('Government proposal') : currentLocale() === 'sv' ? `${chosen}:s förslag` : `${chosen}'s proposal`}{focus.gov && chosen !== 'GOV' ? currentLocale() === 'sv' ? ` · ${signed(focus.difference ?? 0)} jämfört med regeringen` : ` · ${signed(focus.difference ?? 0)} relative to government` : ''}</p><a href={focus.row.source_url} target="_blank" rel="noreferrer">{t("Read the parliamentary comparison table ↗")}</a></> : <p>{t("This proposal has no imported row for this area.")}</p>}</aside></div>
    <details className="budget-ledger-all"><summary>{t("View all 27 expenditure areas and source amounts")}</summary><div className="coverage-scroll" tabIndex={0} aria-label={t("All expenditure areas, scroll horizontally")}><table><thead><tr><th scope="col">{t("Area")}</th><th scope="col">{t("Government amount")}</th><th scope="col">{chosen} {t("amount")}</th><th scope="col">{t("Difference")}</th><th scope="col">{t("Source")}</th></tr></thead><tbody>{display.map(({ area, row, gov, difference }) => <tr key={area}><th scope="row">{area}. {nameOf(area)}</th><td>{gov ? money(gov.amount_msek) : t('Missing')}</td><td>{row ? money(row.amount_msek) : t('Missing')}</td><td>{difference == null ? '—' : signed(difference)}</td><td>{row && <a href={row.source_url} target="_blank" rel="noreferrer">{t("Riksdagen ↗")}</a>}</td></tr>)}</tbody></table></div></details>
  </section>
}
