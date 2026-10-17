import { Fragment, useEffect, useState } from 'react'
import { companyHref, setHashParams, type Route } from '../router'
import ReportShell, { ReportFrame, withQuery } from '../report/ReportShell'
import { ChartCard, DashGrid } from '../ui/dash/Dash'
import RankBars from '../charts/RankBars'
import {
  filterError,
  filtersOf,
  independentRankingScope,
  observedRank,
  orderSummaries,
  parseRelease,
  safeSource,
  selectedFamilies,
  summaries,
  uniqueDocuments,
  STATUSES,
  type Filters,
  type Release,
  type Source,
} from './model'
import {
  assertFresh,
  csv,
  decisionCsv,
  graphicSvg,
  graphicTitle,
  methodology,
  plotRows,
  save,
  saveGraphic,
  type Graphic,
} from './exports'
import './compliance.css'
import publicMethodology from '../../../docs/compliance-intelligence/phase-4-methodology.md?raw'
import { parseProgress, type Progress } from './progress'

const DOCS =
  'https://github.com/korv9/anton-portfolio/blob/main/docs/compliance-intelligence/'
const count = (value: number | null | undefined) =>
  value == null ? 'Not assessed' : new Intl.NumberFormat('en-GB').format(value)
const day = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(value))
    : 'Unknown'
function money(value: string | undefined, currency: string) {
  if (value == null) return 'No qualifying final amount'
  const [whole, fraction] = value.split('.')
  return `${new Intl.NumberFormat('en-GB').format(BigInt(whole))}.${fraction} ${currency}`
}
function Evidence({ documents }: { documents: Source[] }) {
  return documents.length ? (
    <ul className="compliance-evidence">
      {documents.map((d) => (
        <li key={d.document_hash}>
          <a
            href={safeSource(d.source_url)!}
            target="_blank"
            rel="noopener noreferrer"
          >
            {d.authority} · {day(d.decision_date)} ↗
          </a>
          <small>
            SHA-256 <code>{d.document_hash}</code>
          </small>
        </li>
      ))}
    </ul>
  ) : (
    <p>No approved source documents in this selection.</p>
  )
}
const TABS = [
  {
    path: '#compliance',
    label: 'Overview',
    question: 'What does the verified evidence cover?',
  },
  {
    path: '#compliance-rankings',
    label: 'Company rankings',
    question: 'Compare the approved observations',
  },
  {
    path: '#compliance-company',
    label: 'Company detail',
    question: 'Follow a legal entity and its evidence',
  },
  {
    path: '#compliance-stories',
    label: 'Research stories',
    question: 'Export a reproducible comparison',
  },
]
function Overview({
  release,
  filters,
}: {
  release: Release
  filters: Filters
}) {
  const data = release.payload
  const fs = selectedFamilies(data, filters)
  const issuer = plotRows(fs, 'authority', 'SEK')
  const timeline = plotRows(fs, 'timeline', 'SEK')
  const [currency, setCurrency] = useState<'SEK' | 'EUR'>('SEK')
  return (
    <>
      <dl className="compliance-measures" aria-label="Observed evidence counts">
        <div>
          <dt>Companies with approved decisions</dt>
          <dd>{count(new Set(fs.map((f) => f.company_id)).size)}</dd>
          <small>Of {data.context.cohort_size} frozen cohort members</small>
        </div>
        <div>
          <dt>Approved decision records</dt>
          <dd>
            {count(
              new Set(fs.flatMap((f) => f.decisions.map((d) => d.decision_id)))
                .size,
            )}
          </dd>
          <small>Appeals remain separate decision acts</small>
        </div>
        <div>
          <dt>Reviewed source documents</dt>
          <dd>{count(uniqueDocuments(fs).length)}</dd>
          <small>Distinct original document hashes</small>
        </div>
      </dl>
      {!fs.length && (
        <p className="compliance-notice" role="status">
          No approved decisions match these filters. This is not evidence of no
          violations.
        </p>
      )}
      <DashGrid>
        <ChartCard
          title="Verified decisions by issuer"
          sub="Approved decision acts, including court context. Not a count of violations."
          span={6}
        >
          {issuer.length ? (
            <RankBars
              rows={issuer.map((r) => ({ key: r.label, ...r }))}
              label="Approved decisions by issuer"
              format={(n) => count(n)}
            />
          ) : (
            <p>No approved decision records.</p>
          )}
        </ChartCard>
        <ChartCard
          title="Decision timeline"
          sub="Native decision dates, with subsequent appeal context retained."
          span={6}
        >
          {timeline.length ? (
            <RankBars
              rows={timeline.map((r) => ({ key: r.label, ...r }))}
              label="Approved decisions over time"
              format={(n) => count(n)}
            />
          ) : (
            <p>No approved timeline is available.</p>
          )}
        </ChartCard>
        <ChartCard
          title="Final monetary sanction distribution"
          sub="Final administrative amounts only. Each obligation occurs once; currencies stay separate."
          slicer={{
            label: 'Distribution currency',
            value: currency,
            options: ['SEK', 'EUR'].map((value) => ({ value, label: value })),
            onChange: (value) => setCurrency(value as 'SEK' | 'EUR'),
          }}
        >
          {fs.some((f) => f.final_amounts[currency] != null) ? (
            <RankBars
              rows={plotRows(fs, 'amounts', currency).map((r) => ({
                key: r.label,
                ...r,
              }))}
              label={`Final amount distribution in ${currency}`}
              format={(n) => count(n)}
            />
          ) : (
            <p>
              No approved final {currency} amount is available in this
              selection.
            </p>
          )}
        </ChartCard>
      </DashGrid>
      <Coverage release={release} />
    </>
  )
}
function Coverage({ release }: { release: Release }) {
  return (
    <section
      aria-labelledby="compliance-coverage-title"
      className="compliance-section"
    >
      <h2 id="compliance-coverage-title">Source coverage and limitations</h2>
      <p>
        Full published release, before interactive filters. Population coverage
        and completed-search coverage are unknown. Empty years are not negative
        searches.
      </p>
      <div
        className="compliance-scroll"
        tabIndex={0}
        role="region"
        aria-label="Source coverage table"
      >
        <table>
          <caption>
            Authority and period coverage in the approved release
          </caption>
          <thead>
            <tr>
              <th scope="col">Issuer / period</th>
              <th scope="col">Decision records</th>
              <th scope="col">Documents</th>
              <th scope="col">Known fields</th>
              <th scope="col">Population coverage</th>
            </tr>
          </thead>
          <tbody>
            {release.payload.coverage.map((c) => (
              <tr key={c.authority + c.period_start + c.period_role}>
                <th scope="row">
                  {c.authority}
                  <small>
                    {day(c.period_start)} – {day(c.period_end)} ·{' '}
                    {c.period_role.replaceAll('_', ' ')}
                  </small>
                </th>
                <td>{count(c.approved_decision_records)}</td>
                <td>{count(c.reviewed_source_documents)}</td>
                <td>
                  {c.approved_record_field_completeness == null
                    ? 'Not measured'
                    : new Intl.NumberFormat('en-GB', {
                        style: 'percent',
                        maximumFractionDigits: 1,
                      }).format(c.approved_record_field_completeness)}
                </td>
                <td>
                  Unknown<small>{c.coverage_status.replaceAll('_', ' ')}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Known fields measure completeness of approved rows only. Documents can
        appear in more than one coverage period; cells are not additive. The
        originating-authority filter and native issuer differ.
      </p>
    </section>
  )
}
function Rankings({
  release,
  filters,
  route,
}: {
  release: Release
  filters: Filters
  route: Route
}) {
  const rankingEnabled = independentRankingScope(filters)
  const metric = !rankingEnabled
    ? 'name'
    : route.params.get('metric') === 'money'
      ? 'money'
      : route.params.get('metric') === 'name'
        ? 'name'
        : 'sanctions'
  const currency = route.params.get('currency') === 'EUR' ? 'EUR' : 'SEK'
  const ascending = route.params.get('order') === 'asc'
  const rows = summaries(release.payload, filters)
  const ordered = orderSummaries(rows, metric, currency, ascending)
  const update = (key: string, value: string) => {
    const params = new URLSearchParams(route.params)
    params.set(key, value)
    setHashParams(route.path, params)
  }
  return (
    <section className="compliance-section">
      <h2>
        {filters.scope === 'legal_entity'
          ? 'Frozen 50-company cohort'
          : 'Groups represented by cohort members'}
      </h2>
      <p>
        Orderings describe approved observations, not comparative risk or
        ethics. Unassessed companies have no rank. No matching record proves
        neither compliance nor absence of violations.
      </p>
      {!rankingEnabled && (
        <p role="status">
          KKV-dependent and combined-source rankings are disabled because KKV
          collection is unavailable or partial. Companies are listed by legal
          name. Select Integritetsskyddsmyndigheten for IMY-only comparisons;
          missing KKV records do not mean zero sanctions.
        </p>
      )}
      <div className="compliance-controls">
        <label>
          Comparison
          <select
            name="metric"
            value={metric}
            disabled={!rankingEnabled}
            onChange={(e) => update('metric', e.target.value)}
          >
            <option value="sanctions">
              Confirmed administrative sanctions
            </option>
            <option value="money">Final monetary sanctions</option>
            <option value="name">Legal name</option>
          </select>
        </label>
        <label>
          Currency
          <select
            name="currency"
            value={currency}
            onChange={(e) => update('currency', e.target.value)}
          >
            <option>SEK</option>
            <option>EUR</option>
          </select>
        </label>
        <label>
          Order
          <select
            name="order"
            value={ascending ? 'asc' : 'desc'}
            onChange={(e) => update('order', e.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>
      <div
        className="compliance-scroll"
        tabIndex={0}
        role="region"
        aria-label="Company comparison table"
      >
        <table>
          <caption>
            {rows.length} selected{' '}
            {filters.scope === 'legal_entity'
              ? 'legal entities'
              : 'cohort-member groups'}{' '}
            · monetary totals are {currency} only
          </caption>
          <thead>
            <tr>
              <th scope="col">Observed rank</th>
              <th
                scope="col"
                aria-sort={
                  metric === 'name'
                    ? ascending
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                Legal identity
              </th>
              <th
                scope="col"
                aria-sort={
                  metric === 'sanctions'
                    ? ascending
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                Administrative sanctions
              </th>
              <th
                scope="col"
                aria-sort={
                  metric === 'money'
                    ? ascending
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                Final {currency} amount
              </th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const params = new URLSearchParams(route.params)
              params.set('company', row.id)
              const identity = release.payload.companies.find(
                (c) => c.company_id === row.id,
              )!
              return (
                <tr key={row.id}>
                  <td>
                    {count(
                      rankingEnabled
                        ? observedRank(rows, row, metric, currency)
                        : null,
                    )}
                  </td>
                  <th scope="row">
                    <a href={withQuery('#compliance-company', params)}>
                      {row.label}
                    </a>
                    <small>
                      {identity.country_code} ·{' '}
                      {identity.organization_number || identity.registry_number}
                    </small>
                    {filters.scope === 'corporate_group' && (
                      <small>
                        {row.members.length} selected members; no liability
                        transferred to the parent
                        <span>
                          {' '}
                          ·{' '}
                          {row.members
                            .map(
                              (c) =>
                                `${c.registered_legal_name} (${c.organization_number || c.registry_number})`,
                            )
                            .join('; ')}
                        </span>
                      </small>
                    )}
                  </th>
                  <td>{count(row.sanctions)}</td>
                  <td>{money(row.finalAmounts?.[currency], currency)}</td>
                  <td>
                    <details>
                      <summary>{row.documents.length} source documents</summary>
                      <Evidence documents={row.documents} />
                    </details>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p role="status">
          No cohort members match the industry or size selection.
        </p>
      )}
      <p>
        Administrative sanctions can be under appeal; only explicitly final
        amounts enter the monetary comparison. Criminal convictions remain
        separately unmeasured.
      </p>
    </section>
  )
}
function CompanyDetail({
  release,
  filters,
  route,
}: {
  release: Release
  filters: Filters
  route: Route
}) {
  const data = release.payload
  const id =
    route.params.get('company') ||
    data.companies.find((c) => c.cohort_member)?.company_id
  const company = data.companies.find((c) => c.company_id === id)
  const fs = selectedFamilies(data, filters).filter((f) => f.company_id === id)
  const decisions = [
    ...new Map(
      fs.flatMap((f) => f.decisions).map((d) => [d.decision_id, d]),
    ).values(),
  ].sort((a, b) => a.decision_date.localeCompare(b.decision_date))
  const related = data.relationships.filter(
    (r) => r.company_id === id || r.related_company_id === id,
  )
  return (
    <section className="compliance-section">
      <label>
        Choose a legal entity
        <select
          name="company"
          value={id || ''}
          onChange={(e) => {
            const params = new URLSearchParams(route.params)
            params.set('company', e.target.value)
            setHashParams(route.path, params)
          }}
        >
          <option value="">Select company</option>
          {data.companies.map((c) => (
            <option key={c.company_id} value={c.company_id}>
              {c.registered_legal_name}
              {c.cohort_member ? '' : ' (related, outside cohort)'}
            </option>
          ))}
        </select>
      </label>
      {!company ? (
        <p role="status">
          This identity is not in the reviewed public registry projection.
          Choose a listed entity.
        </p>
      ) : (
        <>
          <h2>{company.registered_legal_name}</h2>
          <p>
            <a href={companyHref(company.company_id)}>
              Company Deep Dive and related IT jobs →
            </a>
          </p>
          <dl className="compliance-definition">
            <dt>Legal identity</dt>
            <dd>
              {company.country_code} · {company.registry_authority} ·{' '}
              {company.organization_number || company.registry_number}
            </dd>
            <dt>Cohort membership</dt>
            <dd>
              {company.cohort_member
                ? 'Selected legal entity'
                : 'Related entity outside the cohort; no outcomes are attributed through ownership'}
            </dd>
            <dt>Primary industry</dt>
            <dd>SNI 2025 {company.primary_sni_code || 'not available'}</dd>
            <dt>Workforce context</dt>
            <dd>
              {company.employees_lower_bound == null
                ? 'Not available'
                : `${count(company.employees_lower_bound)}–${company.employees_upper_bound == null ? 'open upper bound' : count(company.employees_upper_bound)} employees (class ${company.employee_size_class})`}{' '}
              · register snapshot {day(company.snapshot_date)}
            </dd>
            <dt>Financial context</dt>
            <dd>
              No verified financial metadata available. No revenue-adjusted
              comparison is made.
            </dd>
            <dt>Registry provenance</dt>
            <dd>
              <a
                href={safeSource(company.source_url)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                Company register source ↗
              </a>{' '}
              · last verified {day(company.last_verified_at)}
              <small>
                SHA-256 <code>{company.document_hash}</code>
              </small>
            </dd>
          </dl>
          <h3>Historical case timeline</h3>
          <p>
            Direct legal-entity decisions only. Current filters select
            originating cases; later approved appeal context is retained. Status
            is known at the release snapshot.
          </p>
          {!decisions.length && (
            <p role="status">
              No approved decisions for this legal entity match the current
              filters. Coverage remains incomplete.
            </p>
          )}
          <ol className="compliance-timeline">
            {decisions.map((d) => (
              <li key={d.decision_id}>
                <time dateTime={d.decision_date}>{day(d.decision_date)}</time>
                <h4>
                  {d.authority} · {d.case_number}
                </h4>
                <p>
                  Original outcome: {d.original_outcome.replaceAll('_', ' ')}.
                  Current status: <strong>{d.legal_status}</strong>. Finality:{' '}
                  {d.finality_status}.
                </p>
                <p>
                  Published {day(d.publication_date)} · source verified{' '}
                  {day(d.last_verified_at)} · reverify by {day(d.reverify_by)}
                </p>
                <p>Legal basis: {d.legal_basis.join('; ') || 'Unknown'}</p>
                {fs
                  .flatMap((f) => f.amounts)
                  .filter((a) => a.decision_id === d.decision_id)
                  .map((a) => (
                    <p key={a.amount_id}>
                      {a.amount_kind === 'original'
                        ? 'Original amount'
                        : 'Final effective amount'}
                      : {money(a.amount, a.currency)}
                    </p>
                  ))}
                {d.subsequent_decisions.length > 0 && (
                  <ul>
                    {d.subsequent_decisions.map((link) => (
                      <li key={link.record_id + link.relation}>
                        {link.relation} · {link.authority} ·{' '}
                        {day(link.decision_date)} ·{' '}
                        <a
                          href={safeSource(link.source_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Related decision ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <Evidence documents={[d]} />
              </li>
            ))}
          </ol>
          <h3>Related corporate entities</h3>
          <p>
            Ownership, historic relationships and legal responsibility are
            distinct. Relationships shown here do not attribute another
            company's outcomes.
          </p>
          {related.length ? (
            <ul>
              {related.map((r, i) => {
                const other = data.companies.find(
                  (c) =>
                    c.company_id ===
                    (r.company_id === id ? r.related_company_id : r.company_id),
                )!
                const params = new URLSearchParams(route.params)
                params.set('company', other.company_id)
                return (
                  <li key={i}>
                    <a href={withQuery('#compliance-company', params)}>
                      {other.registered_legal_name}
                    </a>{' '}
                    · {r.company_id === id ? 'outgoing' : 'incoming'}{' '}
                    {r.relationship_type} · {r.valid_from || 'unknown start'} to{' '}
                    {r.valid_to || 'open end'} ·{' '}
                    <a
                      href={safeSource(r.source_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Relationship source ↗
                    </a>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p>No reviewed relationships are included in this release.</p>
          )}
        </>
      )}
    </section>
  )
}
function Stories({
  release,
  filters,
  route,
}: {
  release: Release
  filters: Filters
  route: Route
}) {
  const fs = selectedFamilies(release.payload, filters)
  const kind = (
    ['authority', 'timeline', 'amounts'].includes(
      route.params.get('graphic') || '',
    )
      ? route.params.get('graphic')
      : 'authority'
  ) as Graphic
  const currency = route.params.get('currency') === 'EUR' ? 'EUR' : 'SEK'
  const [height, setHeight] = useState<1200 | 1500>(1200)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const rows = plotRows(fs, kind, currency)
  const update = (key: string, value: string) => {
    const p = new URLSearchParams(route.params)
    p.set(key, value)
    setHashParams(route.path, p)
  }
  const download = async (
    format: 'svg' | 'png' | 'csv' | 'chart-csv' | 'md',
  ) => {
    setError('')
    setBusy(true)
    try {
      assertFresh(release)
      if (format === 'csv')
        save(
          new Blob([decisionCsv(fs, release, filters)], {
            type: 'text/csv;charset=utf-8',
          }),
          'compliance-decisions.csv',
        )
      else if (format === 'chart-csv')
        save(
          new Blob(
            [
              csv(
                rows.map((r) => ({
                  ...r,
                  release_sha256: release.publication.payload_sha256,
                  filters,
                })),
              ),
            ],
            { type: 'text/csv;charset=utf-8' },
          ),
          'compliance-chart.csv',
        )
      else if (format === 'md')
        save(
          new Blob([methodology(release, filters, fs)], {
            type: 'text/markdown;charset=utf-8',
          }),
          'compliance-methodology.md',
        )
      else {
        const style = getComputedStyle(document.documentElement)
        const svg = graphicSvg(release, filters, fs, kind, currency, height, {
          paper: style.getPropertyValue('--page').trim(),
          ink: style.getPropertyValue('--ink').trim(),
          muted: style.getPropertyValue('--muted').trim(),
          accent: style.getPropertyValue('--series-3').trim(),
          font: style.getPropertyValue('--font').trim(),
        })
        await saveGraphic(svg, height, format)
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Export failed. Try SVG or CSV.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="compliance-section">
      <h2>What can the selected evidence support?</h2>
      <p>
        This selection contains {count(fs.flatMap((f) => f.decisions).length)}{' '}
        approved decision records involving{' '}
        {count(new Set(fs.map((f) => f.company_id)).size)} cohort legal
        entities, supported by {count(uniqueDocuments(fs).length)} source
        documents. This describes the reviewed sample; publication and
        enforcement selection limit comparisons.
      </p>
      <div className="compliance-controls">
        <label>
          Research comparison
          <select
            name="graphic"
            value={kind}
            onChange={(e) => update('graphic', e.target.value)}
          >
            <option value="authority">Approved decisions by issuer</option>
            <option value="timeline">Decision timeline</option>
            <option value="amounts">Final amount distribution</option>
          </select>
        </label>
        <label>
          Graphic currency
          <select
            name="graphic-currency"
            value={currency}
            onChange={(e) => update('currency', e.target.value)}
          >
            <option>SEK</option>
            <option>EUR</option>
          </select>
        </label>
        <label>
          Graphic dimensions
          <select
            name="dimensions"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value) as 1200 | 1500)}
          >
            <option value="1200">1200 × 1200 square</option>
            <option value="1500">1200 × 1500 portrait</option>
          </select>
        </label>
      </div>
      <ChartCard
        title={graphicTitle(kind, currency)}
        sub="Values below are the same structured values used to render SVG and PNG exports."
      >
        <RankBars
          rows={rows.map((r) => ({
            ...r,
            key: r.label,
            color: 'var(--series-3)',
          }))}
          label={graphicTitle(kind, currency)}
          format={(n) => count(n)}
        />
      </ChartCard>
      <div className="compliance-controls" aria-label="Research exports">
        <button
          disabled={busy || !fs.length}
          onClick={() => void download('svg')}
        >
          Export SVG
        </button>
        <button
          disabled={busy || !fs.length}
          onClick={() => void download('png')}
        >
          Export PNG
        </button>
        <button
          disabled={busy || !fs.length}
          onClick={() => void download('csv')}
        >
          Decision CSV
        </button>
        <button
          disabled={busy || !fs.length}
          onClick={() => void download('chart-csv')}
        >
          Chart CSV
        </button>
        <button disabled={busy} onClick={() => void download('md')}>
          Methodology Markdown
        </button>
      </div>
      {busy && <p role="status">Preparing export…</p>}
      {error && <p role="alert">{error}</p>}
      <p>
        Graphics include the title, date window, frozen cohort, status snapshot,
        review expiry and source references. Download the companion methodology
        for every exact source URL and document hash. PNG is rasterized directly
        from the generated SVG; no page screenshot or screenshot-based
        extraction is used.
      </p>
      <details>
        <summary>Evidence behind this comparison</summary>
        <Evidence documents={uniqueDocuments(fs)} />
      </details>
    </section>
  )
}
export default function ComplianceExplorer({ route }: { route: Route }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/data/compliance/progress.json', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => (r.ok ? parseProgress(await r.json()) : null))
      .then((p) => {
        if (!controller.signal.aborted) setProgress(p)
      })
      .catch(() => {
        if (!controller.signal.aborted) setProgress(null)
      })
    if (!release) setLoading(true)
    fetch(new URL('data/compliance/release.json', document.baseURI), {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'Published compliance data could not be loaded. Retry or consult the methodology.',
          )
        return parseRelease(await response.json())
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRelease(data)
          setError('')
          setExpired(false)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setRelease(null)
          const message =
            e instanceof Error ? e.message : 'Release validation failed.'
          setExpired(message.includes('Release review has expired'))
          setError(
            message.includes('Release review has expired') ? '' : message,
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const refresh = () => setAttempt((n) => n + 1)
    const poll = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(poll)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  useEffect(() => {
    if (!release) return
    const check = () => {
      if (Date.now() >= Date.parse(release.publication.valid_until))
        setExpired(true)
    }
    const timer = window.setInterval(check, 1000)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [release])
  const available =
    release &&
    !expired &&
    !error &&
    !loading &&
    Date.now() < Date.parse(release.publication.valid_until)
      ? release
      : null
  const filters = available ? filtersOf(route.params, available.payload) : null
  let issue =
    filters && available ? filterError(filters, available.payload) : null
  if (filters?.scope === 'corporate_group' && available && !issue) {
    try {
      summaries(available.payload, filters)
    } catch (e) {
      issue =
        e instanceof Error ? e.message : 'Group relationships are ambiguous.'
    }
  }
  const update = (key: string, value: string) => {
    const params = new URLSearchParams(route.params)
    if (value) params.set(key, value)
    else params.delete(key)
    setHashParams(route.path, params)
  }
  return (
    <ReportFrame>
      <div className="compliance" lang="en">
        <ReportShell
          name="Job Intelligence · Compliance & Legal History"
          intro="Swedish IT legal entities · reviewed public decisions · evidence before comparison"
          tabs={TABS}
          path={route.path}
          hrefOf={(path) =>
            path.startsWith('#') ? withQuery(path, route.params) : path
          }
          deeper={[
            {
              href: DOCS + 'phase-4-methodology.md',
              label: 'Public methodology',
              about: 'Definitions, selection, missingness and limits',
            },
            {
              href: DOCS + 'phase-5.md',
              label: 'Release and research export',
              about: 'Human approval, freshness and reproducibility',
            },
          ]}
        >
          {loading ? (
            <p role="status">Loading reviewed evidence…</p>
          ) : !available ? (
            <section
              className="compliance-unavailable"
              aria-labelledby="compliance-awaiting"
            >
              <p className="compliance-eyebrow">PUBLICATION GATE</p>
              <h2 id="compliance-awaiting">
                {expired
                  ? 'Publication review expired'
                  : error
                    ? 'Verified release unavailable'
                    : 'Awaiting verified data'}
              </h2>
              <p>
                {expired
                  ? 'The approved release has reached its reverification deadline. Company metrics and exports are held until a fresh release is reviewed.'
                  : error ||
                    (progress
                      ? 'The 50-company research sample is verified. Company outcomes and rankings remain withheld pending human evidence, reuse and publication review.'
                      : 'A verified 50-company register cohort and human-approved Gold decisions are required. No company rankings or legal outcomes are published yet.')}
              </p>
              <dl className="compliance-definition">
                <dt>Cohort target</dt>
                <dd>
                  {progress
                    ? `50 selected Swedish IT legal entities; frozen ${progress.cohort.as_of_date}`
                    : '50 Swedish IT legal entities; verified selection status unavailable'}
                </dd>
                <dt>Companies analyzed</dt>
                <dd>Not available</dd>
                <dt>Source coverage</dt>
                <dd>
                  Incomplete; source-population coverage is unknown. No
                  conclusion about a company's conduct can be drawn.
                </dd>
              </dl>
              {progress && (
                <section aria-label="Collection and review progress">
                  <h3>Collection and review progress</h3>
                  <p>
                    Observed {progress.observed_at}. This dated processing
                    report contains no company findings or sanction metrics.
                  </p>
                  <p>
                    {progress.cohort.eligible_population_count.toLocaleString(
                      'en-GB',
                    )}{' '}
                    eligible active Swedish limited companies; selected by
                    employee size class, then organization number. The private
                    sample is frozen; source reuse and public release require
                    human clearance.
                  </p>
                  <dl className="compliance-definition">
                    <dt>Document candidates awaiting review</dt>
                    <dd>
                      {progress.review.candidate_records} across the collected
                      sources; not all concern cohort companies
                    </dd>
                    <dt>Human review actions</dt>
                    <dd>{progress.review.human_review_actions}</dd>
                    <dt>Approved cohort decision rows</dt>
                    <dd>
                      {progress.approved_gold_records}; this is not a count of
                      violations
                    </dd>
                    {Object.entries(progress.sources).map(([id, s]) => (
                      <Fragment key={id}>
                        <dt>
                          <a
                            href={s.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.authority}
                          </a>
                        </dt>
                        <dd>
                          {s.observed_documents} current PDF references ·{' '}
                          {s.status.replaceAll('_', ' ')} · source checked{' '}
                          {s.verified_at || 'not available'}. Source-population
                          coverage is unknown.
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                </section>
              )}
              <div className="compliance-controls">
                <button onClick={() => setAttempt((n) => n + 1)}>
                  Check for reviewed release
                </button>
                <button
                  onClick={() =>
                    save(
                      new Blob([publicMethodology], {
                        type: 'text/markdown;charset=utf-8',
                      }),
                      'compliance-methodology.md',
                    )
                  }
                >
                  Methodology Markdown
                </button>
              </div>
              <p>
                <a href={DOCS + 'phase-4-methodology.md'}>
                  Read the selection and metric methodology ↗
                </a>
              </p>
            </section>
          ) : (
            filters && (
              <>
                <aside
                  className="compliance-notice"
                  aria-label="Cohort and verification"
                >
                  <strong>
                    {available.payload.context.cohort_size} Swedish IT legal
                    entities · frozen{' '}
                    {day(available.payload.context.cohort_as_of_date)}
                  </strong>
                  <p>
                    Current status known at{' '}
                    {day(available.payload.context.status_snapshot_at)}.
                    Publication reviewed{' '}
                    {day(available.publication.reviewed_at)}; reverify by{' '}
                    {day(available.publication.valid_until)}.
                  </p>
                  <p>
                    Coverage is incomplete. No identified sanctions is not proof
                    of no violations. Administrative sanctions are separate from
                    criminal convictions; criminal-conviction data are
                    unmeasured.
                  </p>
                  <details>
                    <summary>
                      Cohort definition and release verification
                    </summary>
                    <p>
                      Cohort {available.payload.context.cohort_id} ·
                      employee-class selection, then organization number.{' '}
                      <a href={DOCS + 'phase-1.md'}>Selection rule ↗</a>
                    </p>
                    <p>
                      Membership SHA-256{' '}
                      <code>{available.payload.context.membership_hash}</code>
                    </p>
                    <p>
                      Release SHA-256{' '}
                      <code>{available.publication.payload_sha256}</code>
                    </p>
                    <ul>
                      {available.payload.context.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </details>
                </aside>
                <form
                  className="compliance-controls"
                  aria-label="Compliance filters"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <label>
                    Originating authority
                    <select
                      name="authority"
                      value={filters.authority}
                      onChange={(e) => update('authority', e.target.value)}
                    >
                      <option value="">All authorities</option>
                      {[
                        ...new Set([
                          ...available.payload.families.map((f) => f.authority),
                          ...available.payload.coverage.map((c) => c.authority),
                        ]),
                      ]
                        .sort()
                        .map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Case category
                    <select
                      name="category"
                      value={filters.category}
                      onChange={(e) => update('category', e.target.value)}
                    >
                      <option value="">All case categories</option>
                      {[
                        ...new Set(
                          available.payload.families.map((f) => f.category),
                        ),
                      ]
                        .sort()
                        .map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Legal status
                    <select
                      name="status"
                      value={filters.status}
                      onChange={(e) => update('status', e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    From
                    <input
                      name="from"
                      type="date"
                      autoComplete="off"
                      min={available.payload.context.filters.date_from}
                      max={available.payload.context.filters.date_to}
                      value={filters.from}
                      onChange={(e) => update('from', e.target.value)}
                    />
                  </label>
                  <label>
                    To
                    <input
                      name="to"
                      type="date"
                      autoComplete="off"
                      min={available.payload.context.filters.date_from}
                      max={available.payload.context.filters.date_to}
                      value={filters.to}
                      onChange={(e) => update('to', e.target.value)}
                    />
                  </label>
                  <label>
                    Industry (SNI 2025)
                    <select
                      name="industry"
                      value={filters.industry}
                      onChange={(e) => update('industry', e.target.value)}
                    >
                      <option value="">All eligible industries</option>
                      {[
                        ...new Set(
                          available.payload.companies
                            .filter((c) => c.cohort_member)
                            .map((c) => c.primary_sni_code!),
                        ),
                      ]
                        .sort()
                        .map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Employee size class
                    <select
                      name="size"
                      value={filters.size}
                      onChange={(e) => update('size', e.target.value)}
                    >
                      <option value="">All size classes</option>
                      {[
                        ...new Set(
                          available.payload.companies
                            .filter((c) => c.cohort_member)
                            .map((c) => c.employee_size_class!),
                        ),
                      ]
                        .sort((a, b) => Number(a) - Number(b))
                        .map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Entity scope
                    <select
                      name="scope"
                      value={filters.scope}
                      onChange={(e) => update('scope', e.target.value)}
                    >
                      <option value="legal_entity">Legal entities</option>
                      <option value="corporate_group">
                        Groups: selected members only
                      </option>
                    </select>
                  </label>
                  <a href={route.path}>Reset filters</a>
                </form>
                {issue ? (
                  <p role="alert">{issue} Reset the filters to continue.</p>
                ) : (
                  <div>
                    <p role="status">
                      {selectedFamilies(available.payload, filters).length}{' '}
                      approved decision lineages match the current filters.
                    </p>
                    {route.path === '#compliance-rankings' ? (
                      <Rankings
                        release={available}
                        filters={filters}
                        route={route}
                      />
                    ) : route.path === '#compliance-company' ? (
                      <CompanyDetail
                        release={available}
                        filters={filters}
                        route={route}
                      />
                    ) : route.path === '#compliance-stories' ? (
                      <Stories
                        release={available}
                        filters={filters}
                        route={route}
                      />
                    ) : (
                      <Overview release={available} filters={filters} />
                    )}
                  </div>
                )}
              </>
            )
          )}
        </ReportShell>
      </div>
    </ReportFrame>
  )
}
