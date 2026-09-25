import { currentLocale, t } from './i18n'
import { useEffect, useState } from 'react'
import { nameOf } from './BudgetLab'

type Row = { budget_year: number; expenditure_area: number; expenditure_area_name: string; approved_budget_msek: number; amendments_msek: number; outturn_msek: number; source_url: string }
const bn = (value: number) => {
  const sv = currentLocale() === 'sv'
  const small = Math.abs(value) < 100
  return `${(small ? value : value / 1000).toLocaleString(sv ? 'sv-SE' : 'en-GB', { maximumFractionDigits: 1 })} ${small ? (sv ? 'mnkr' : 'm SEK') : (sv ? 'mdkr' : 'bn SEK')}`
}
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${bn(Math.abs(value))}`

export default function BudgetOutturn() {
  const [rows, setRows] = useState<Row[]>([])
  const [year, setYear] = useState(2025)
  const [area, setArea] = useState(9)
  const [error, setError] = useState(false)
  useEffect(() => { fetch('/data/gold/tables/fact_budget_outturn.json').then(r => { if (!r.ok) throw Error(); return r.json() }).then(setRows).catch(() => setError(true)) }, [])
  const years = [...new Set(rows.map(row => row.budget_year))].sort((a, b) => b - a)
  const annual = rows.filter(row => row.budget_year === year).sort((a, b) => a.expenditure_area - b.expenditure_area)
  const focused = annual.find(row => row.expenditure_area === area)
  const top = [...annual].sort((a, b) => Math.abs(b.outturn_msek - b.approved_budget_msek) - Math.abs(a.outturn_msek - a.approved_budget_msek)).slice(0, 8)
  const max = Math.max(1, ...top.map(row => Math.abs(row.outturn_msek - row.approved_budget_msek)))
  const approved = annual.reduce((sum, row) => sum + row.approved_budget_msek, 0)
  const actual = annual.reduce((sum, row) => sum + row.outturn_msek, 0)
  return <section className="report outturn-report" id="budget-outturn"><p className="eyebrow">{t("Annual accounts / a different question")}</p><h2>{t("What was budgeted, and what was spent?")}</h2><p>{t("These annual accounts compare the approved budget with recorded expenditure for each area. This is separate from the parties' proposals above. Differences can reflect amendments, timing and implementation; they do not show which party caused an outcome.")}</p>
    {error && <p role="alert">{t("The annual accounts could not be loaded.")}</p>}{!rows.length && !error && <p role="status">{t("Loading annual accounts…")}</p>}
    {rows.length > 0 && <><label className="outturn-year">{t("Annual account year")}<select value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(value => <option key={value}>{value}</option>)}</select></label><div className="budget-ledger-summary"><div><strong>{bn(approved)}</strong><span>{t("Approved budget · 27 areas")}</span></div><div><strong>{bn(actual)}</strong><span>{t("Recorded expenditure · 27 areas")}</span></div><div><strong>{signed(actual - approved)}</strong><span>{t("Outturn minus approved budget")}</span></div><div><strong>{years.length} {t("years")}</strong><span>{t("Available: ")}{years.at(-1)}–{years[0]}</span></div></div>
      <p>{t("Largest differences in ")}{year}{t(". Select an area to inspect its figures; the full 27-area table is below.")}</p><div className="budget-ledger-layout"><div>{top.map(row => { const difference = row.outturn_msek - row.approved_budget_msek; return <button className="budget-ledger-bar" key={row.expenditure_area} aria-pressed={area === row.expenditure_area} onClick={() => setArea(row.expenditure_area)}><span><b>{row.expenditure_area}. {nameOf(row.expenditure_area)}</b><strong>{signed(difference)}</strong></span><i className={difference < 0 ? 'negative' : ''} style={{ width: `${Math.max(1, Math.abs(difference) / max * 100)}%` }} /></button> })}</div><aside className="budget-ledger-detail">{focused && <><p className="eyebrow">{focused.expenditure_area}. {nameOf(focused.expenditure_area)}</p><strong>{bn(focused.outturn_msek)}</strong><p>{t("Recorded expenditure · approved budget ")}{bn(focused.approved_budget_msek)} {t("· difference ")}{signed(focused.outturn_msek - focused.approved_budget_msek)}.</p><p>{t("Reported amendments: ")}{signed(focused.amendments_msek)}{t(". This field is shown separately and is not added to the difference above.")}</p><a href={focused.source_url} target="_blank" rel="noreferrer">{t("Annual accounts source ↗")}</a></>}</aside></div>
      <details className="budget-ledger-all"><summary>{t("Read all 27 areas for ")}{year}</summary><div className="coverage-scroll" tabIndex={0} aria-label={t("Annual account table, scroll horizontally")}><table><thead><tr><th scope="col">{t("Area")}</th><th scope="col">{t("Approved budget")}</th><th scope="col">{t("Recorded expenditure")}</th><th scope="col">{t("Difference")}</th><th scope="col">{t("Reported amendments")}</th></tr></thead><tbody>{annual.map(row => <tr key={row.expenditure_area}><th scope="row">{row.expenditure_area}. {nameOf(row.expenditure_area)}</th><td>{bn(row.approved_budget_msek)}</td><td>{bn(row.outturn_msek)}</td><td>{signed(row.outturn_msek - row.approved_budget_msek)}</td><td>{signed(row.amendments_msek)}</td></tr>)}</tbody></table></div></details>
      <p className="evidence-note">{t("Source: Statskontoret annual outturn aggregate, 1997–2025, one row per budget year and expenditure area. Historical area definitions may differ; this view compares values within each year and does not automatically join them to the FiU1 proposal snapshots.")}</p>
    </>}
  </section>
}
