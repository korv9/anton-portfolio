import { useEffect, useState, type MouseEvent } from 'react'
import { companyHref, setHashParams, type Route } from '../router'
import { fetchData } from '../dataSource'
import { ReportFrame } from '../report/ReportShell'
import RankBars from '../charts/RankBars'
import { parseRelease, type Release } from '../compliance/model'
import {
  parseCompanyData,
  relatedJobs,
  hiringDaily,
  sizeLabels,
  type CompanyData,
  type Company,
  type Job,
  type ContextFact,
} from './model'
import './companies.css'

export function CompanyLink({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const navigate = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    history.pushState(null, '', companyHref(id))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return (
    <a href={companyHref(id)} onClick={navigate}>
      {children}
    </a>
  )
}
function Source({ url, hash }: { url: string; hash?: string }) {
  return (
    <>
      <a href={url} target="_blank" rel="noreferrer">
        Source ↗
      </a>
      {hash && (
        <small>
          SHA-256 <code>{hash}</code>
        </small>
      )}
    </>
  )
}
function JobCard({ job, data }: { job: Job; data: CompanyData }) {
  const link = data.links.find(
    (l) =>
      l.job_id === job.job_id && l.relationship_type === 'advertised_employer',
  )!
  const company = data.companies.find((c) => c.company_id === link.company_id)
  const roles = data.links.filter(
    (l) =>
      l.job_id === job.job_id &&
      l.relationship_type !== 'advertised_employer' &&
      l.match_status === 'verified',
  )
  return (
    <article className="company-job">
      <header>
        <h2>{job.title}</h2>
        <p>
          {company ? (
            <CompanyLink id={company.company_id}>
              {company.registered_legal_name}
            </CompanyLink>
          ) : (
            job.employer_name || 'Employer name not provided'
          )}
        </p>
      </header>
      <p>
        {job.location || 'Location not provided'} · Published{' '}
        <time dateTime={job.publication_date}>
          {job.publication_date.slice(0, 10)}
        </time>
      </p>
      {job.workplace_name && <p>Workplace: {job.workplace_name}</p>}
      {job.technologies.length ? (
        <p>Skills mentioned: {job.technologies.join(' · ')}</p>
      ) : (
        <p>No structured technology tags provided.</p>
      )}
      {company ? (
        <>
          <p>
            Verified advertised entity ·{' '}
            {company.organization_number || company.registry_number}. The
            advertiser may be a recruiting agency; the end employer has not been
            inferred.
          </p>
          <p>
            {sizeLabels[company.employee_size_class || '']
              ? `Employee class: ${sizeLabels[company.employee_size_class!]} · `
              : ''}
            SNI {company.sni_version}:{' '}
            {company.primary_sni_code || 'not available'} · register{' '}
            {company.snapshot_date}
          </p>
          <CompanyLink id={company.company_id}>
            Open Company Intelligence →
          </CompanyLink>
        </>
      ) : (
        <p className="company-state">
          Advertised entity match: {link.match_status.replaceAll('_', ' ')}. Its
          company and compliance data are withheld until identity is verified.
        </p>
      )}
      {roles.length > 0 && (
        <ul>
          {roles.map((role) => (
            <li key={role.relationship_type}>
              Documented {role.relationship_type.replaceAll('_', ' ')}:{' '}
              <CompanyLink id={role.company_id!}>
                {
                  data.companies.find((c) => c.company_id === role.company_id)!
                    .registered_legal_name
                }
              </CompanyLink>
              <details>
                <summary>Role evidence</summary>
                <p>
                  Verified {role.verified_at} ·{' '}
                  {role.match_method.replaceAll('_', ' ')}
                </p>
                {role.evidence.map((e, i) => (
                  <p key={i}>
                    <Source
                      url={(e.source_url || e.evidence_url)!}
                      hash={e.document_hash}
                    />
                    {e.source_locator}
                  </p>
                ))}
              </details>
            </li>
          ))}
        </ul>
      )}
      <p>
        <a href={job.source_url} target="_blank" rel="noreferrer">
          Original job advertisement ↗
        </a>
      </p>
      <details>
        <summary>Identity and source evidence</summary>
        <p>
          Original employer: {job.employer_name || 'not provided'} ·
          Organization number:{' '}
          {job.organization_number || 'not available for publication'}
        </p>
        <p>
          Method: {link.match_method.replaceAll('_', ' ')} · Evidence
          confidence: {link.match_confidence}. This is an evidence-strength
          indicator, not a probability.
        </p>
        {link.verified_at && <p>Verified: {link.verified_at}</p>}
        <Source url={job.source_url} hash={job.document_hash} />
        <p>
          The advertisement hash identifies the preserved canonical JobTech JSON
          payload.
        </p>
        {link.evidence.map(
          (e, i) =>
            (e.source_url || e.evidence_url) && (
              <p key={i}>
                <Source
                  url={(e.source_url || e.evidence_url)!}
                  hash={e.document_hash}
                />
                {e.source_locator}
              </p>
            ),
        )}
      </details>
    </article>
  )
}
function Coverage({ data }: { data: CompanyData }) {
  return (
    <aside className="company-coverage" aria-label="Job and company coverage">
      <h2>Coverage and freshness</h2>
      <p>
        Active Data/IT advertisements published{' '}
        {data.coverage.window_start.replace('T', ' ')} –{' '}
        {data.coverage.window_end.replace('T', ' ')} ( client query clock:{' '}
        {data.coverage.query_timezone}; source offsets are not specified).
        Observed {data.generated_at}. Refresh due {data.valid_until}.
      </p>
      <p>
        This job population is separate from the fixed 50-company compliance
        cohort. Advertisements are not hires. Employee size classes are
        intervals; timing and missing financial data limit comparisons.
      </p>
      <dl className="company-metrics">
        <dt>Active IT ads in this window</dt>
        <dd>{data.metrics.total_active_it_ads}</dd>
        <dt>Linked to verified advertised companies</dt>
        <dd>
          {data.metrics.verified_company_links} (
          {data.metrics.match_coverage_percentage ?? 'not assessed'}%)
        </dd>
        <dt>Ambiguous / unresolved / awaiting review</dt>
        <dd>
          {data.metrics.ambiguous_matches} / {data.metrics.unresolved_matches} /{' '}
          {data.metrics.review_required_matches}
        </dd>
        <dt>Companies with reviewed financial data</dt>
        <dd>{data.metrics.companies_with_financial_data}</dd>
        <dt>Companies with reviewed compliance search coverage</dt>
        <dd>
          Not assessed: no company-scoped search-completeness record is
          published
        </dd>
      </dl>
      <Source url={data.coverage.source_url} />
      {' · '}
      <a href={data.coverage.license_url} target="_blank" rel="noreferrer">
        JobTech advertisement license
      </a>
      <details>
        <summary>Collection limitations</summary>
        <ul>
          {data.coverage.limitations.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
    </aside>
  )
}
function ContextSection({
  data,
  company,
  kind,
  title,
  empty,
}: {
  data: CompanyData
  company: Company
  kind: ContextFact['kind']
  title: string
  empty: string
}) {
  const rows = data.context.filter(
    (f) => f.company_id === company.company_id && f.kind === kind,
  )
  return (
    <section className="company-section">
      <h2>{title}</h2>
      {rows.length ? (
        <div className="company-table">
          <table>
            <caption>
              {title}: directly attributed, reviewed source observations
            </caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Measure / event</th>
                <th scope="col">Value</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => (
                <tr key={i}>
                  <td>{f.period}</td>
                  <td>{f.label}</td>
                  <td>
                    {f.value} {f.unit}
                  </td>
                  <td>
                    <Source url={f.source_url} hash={f.document_hash} />
                    {f.source_locator}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  )
}
function Compliance({ id }: { id: string }) {
  const [release, setRelease] = useState<Release | null>(null)
  const [state, setState] = useState(
    'Loading the approved public compliance release…',
  )
  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch('/data/compliance/release.json', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok)
          throw new Error('Approved compliance release unavailable.')
        const r = await parseRelease(await response.json())
        if (alive) {
          setRelease(r)
          setState(
            'No approved public compliance dataset is currently available. This company has not been assessed here.',
          )
        }
      } catch {
        if (alive) {
          setRelease(null)
          setState(
            'Compliance data is unavailable or its review has expired. No finding is shown.',
          )
        }
      }
    }
    void load()
    const timer = window.setInterval(() => {
      setRelease(null)
      void load()
    }, 60000)
    const focus = () => {
      setRelease(null)
      void load()
    }
    window.addEventListener('focus', focus)
    return () => {
      alive = false
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', focus)
    }
  }, [id])
  useEffect(() => {
    if (!release) return
    const timer = window.setTimeout(
      () => {
        setRelease(null)
        setState(
          'Compliance review has expired. No finding is shown until reverification.',
        )
      },
      Math.max(
        0,
        Math.min(
          2147483647,
          Date.parse(release.publication.valid_until) - Date.now(),
        ),
      ),
    )
    return () => clearTimeout(timer)
  }, [release])
  const fresh =
    release && Date.parse(release.publication.valid_until) > Date.now()
  const company =
    fresh && release.payload.companies.find((c) => c.company_id === id)
  const families = company
    ? release!.payload.families.filter((f) => f.company_id === id)
    : []
  const decisions = [
    ...new Map(
      families.flatMap((f) => f.decisions).map((d) => [d.decision_id, d]),
    ).values(),
  ].sort((a, b) => a.decision_date.localeCompare(b.decision_date))
  return (
    <section className="company-section">
      <h2>Documented compliance decisions</h2>
      {!fresh ? (
        <p role="status">{state}</p>
      ) : !company ? (
        <p>
          This legal entity is outside the approved public registry projection.
          Its compliance coverage has not been assessed here.
        </p>
      ) : (
        <>
          <p>
            Approved records only · direct legal entity ·{' '}
            {release.payload.context.filters.date_from} –{' '}
            {release.payload.context.filters.date_to} · verified status{' '}
            {release.payload.context.status_snapshot_at}.
          </p>
          <p>
            {families.length
              ? `${families.reduce((n, f) => n + f.administrative_sanctions, 0)} confirmed administrative sanctions in the approved records. `
              : 'No approved company decisions are published in this release. '}
            Coverage is incomplete; absence of a record does not establish
            absence of violations. Administrative sanctions are separate from
            criminal convictions.
          </p>
          <ol>
            {decisions.map((d) => (
              <li key={d.decision_id}>
                <time dateTime={d.decision_date}>{d.decision_date}</time> ·{' '}
                {d.authority} · {d.case_number} · {d.legal_status} · finality:{' '}
                {d.finality_status}
                <p>
                  <Source url={d.source_url} hash={d.document_hash} />
                </p>
                <ul>
                  {d.subsequent_decisions.map((s) => (
                    <li key={s.record_id}>
                      {s.relation} · {s.decision_date}{' '}
                      <Source url={s.source_url} hash={s.document_hash} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <a href={'/#compliance-company?company=' + encodeURIComponent(id)}>
            Evidence, appeals and methodology in Compliance Explorer →
          </a>
        </>
      )}
      <p>
        <a href="/#compliance">
          Compliance source coverage and publication methodology →
        </a>
      </p>
    </section>
  )
}
function Profile({ data, id }: { data: CompanyData; id: string }) {
  const c = data.companies.find((c) => c.company_id === id)
  if (!c)
    return (
      <>
        <h1>Company profile unavailable</h1>
        <p>
          This canonical identity has no verified profile in the current job
          release. No similarly named company has been substituted.
        </p>
        <a href="/#jobb-it">Return to IT jobs</a>
      </>
    )
  const jobs = relatedJobs(data, id)
  const related = data.relationships.filter(
    (r) => r.company_id === id || r.related_company_id === id,
  )
  return (
    <>
      <p>
        <a href="/#jobb-it">← Veckans IT-jobb</a>
      </p>
      <h1>{c.registered_legal_name}</h1>
      <section className="company-section">
        <h2>Company overview</h2>
        <dl className="company-metrics">
          <dt>Canonical ID</dt>
          <dd>
            <code>{c.company_id}</code>
          </dd>
          <dt>Legal identity</dt>
          <dd>
            {c.country_code} · {c.organization_number || c.registry_number}
          </dd>
          <dt>Industry</dt>
          <dd>
            SNI {c.sni_version} {c.primary_sni_code || 'not available'}
          </dd>
        </dl>
        <p>
          Register observed {c.snapshot_date} · verified {c.last_verified_at}. A
          legal entity, brand, corporate group and securities issuer are
          separate identities.
        </p>
        <Source url={c.source_url} hash={c.document_hash} />
      </section>
      <ContextSection
        data={data}
        company={c}
        kind="financial"
        title="Financial performance"
        empty="No reviewed financial history is available for this legal entity. Revenue and financial reporting year have not been inferred."
      />
      <section className="company-section">
        <h2>Employee history</h2>
        <p>
          {sizeLabels[c.employee_size_class || '']
            ? `SCB employee interval: ${sizeLabels[c.employee_size_class!]} (class ${c.employee_size_class}), observed ${c.snapshot_date}.`
            : 'SCB employee size class is not available.'}{' '}
          This is a current observation, not an exact headcount or a historical
          series.
        </p>
        <Source url={c.source_url} />
      </section>
      <ContextSection
        data={data}
        company={c}
        kind="employees"
        title="Additional workforce observations"
        empty="No reviewed historical workforce observations are available."
      />
      <section className="company-section">
        <h2>Hiring activity</h2>
        <p>
          {jobs.length} distinct observed ads with verified company
          relationships. This covers the current publication window; withdrawn
          and older advertisements are excluded. No causal relation to financial
          or legal outcomes is claimed.
        </p>
        <RankBars
          rows={hiringDaily(data, id).map((r) => ({
            key: r.day,
            label: r.day,
            value: r.ads,
          }))}
          format={String}
          label="Observed active advertisements by publication day"
        />
        <p>
          Size context:{' '}
          {sizeLabels[c.employee_size_class || ''] || 'not available'}{' '}
          employees. Financial comparisons require reviewed financial
          observations for the same legal entity and compatible periods.
        </p>
      </section>
      <Compliance id={id} />
      <ContextSection
        data={data}
        company={c}
        kind="corporate_events"
        title="Corporate events"
        empty="No reviewed corporate events are available. Mergers and former names require dated source evidence."
      />
      <section className="company-section">
        <h2>Related corporate entities</h2>
        {related.length ? (
          <ul>
            {related.map((r, i) => {
              const child = data.companies.find(
                (c) => c.company_id === r.company_id,
              )!
              const parent = data.companies.find(
                (c) => c.company_id === r.related_company_id,
              )!
              return (
                <li key={i}>
                  <CompanyLink id={child.company_id}>
                    {child.registered_legal_name}
                  </CompanyLink>{' '}
                  {r.relationship_type.replaceAll('_', ' ')}{' '}
                  <CompanyLink id={parent.company_id}>
                    {parent.registered_legal_name}
                  </CompanyLink>{' '}
                  ({r.valid_from || 'start unknown'} –{' '}
                  {r.valid_to || 'end unknown'}){' '}
                  <Source url={r.source_url} hash={r.document_hash} />
                </li>
              )
            })}
          </ul>
        ) : (
          <p>
            No reviewed relationship between the published entities is
            available. Ownership does not transfer compliance decisions between
            companies.
          </p>
        )}
      </section>
      <ContextSection
        data={data}
        company={c}
        kind="contracts"
        title="Clients and public contracts"
        empty="No reviewed client or public contract data is available for this legal entity."
      />
      <section className="company-section">
        <h2>Public technology intelligence</h2>
        <p>
          Structured skills mentioned in related job advertisements:{' '}
          {[...new Set(jobs.flatMap((j) => j.technologies))].join(' · ') ||
            'not available'}
          . These are recruitment signals, not proof of technologies deployed by
          the company.
        </p>
      </section>
      <ContextSection
        data={data}
        company={c}
        kind="technology"
        title="Reviewed technology observations"
        empty="No additional reviewed technology observations are available."
      />
      <ContextSection
        data={data}
        company={c}
        kind="github"
        title="GitHub repositories"
        empty="No company-to-repository relationship has been verified. Repositories are not matched by name alone."
      />
      <ContextSection
        data={data}
        company={c}
        kind="stock"
        title="Stock market context"
        empty="No verified issuer mapping is available. A listed parent is not substituted for this legal entity."
      />
      <section className="company-section">
        <h2>Related current IT jobs</h2>
        <a href={'/#jobb-it?company=' + encodeURIComponent(id)}>
          Open filtered job list →
        </a>
        {jobs.map((j) => (
          <JobCard key={j.job_id} job={j} data={data} />
        ))}
      </section>
      <Coverage data={data} />
    </>
  )
}
export default function CompanyIntelligence({ route }: { route: Route }) {
  const [data, setData] = useState<CompanyData | null>(null)
  const [state, setState] = useState('Loading current job and company data…')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetchData('jobs/company-intelligence.json', { signal: controller.signal })
      .then((r) => r.json())
      .then((value) => {
        const result = parseCompanyData(value)
        if (!controller.signal.aborted) {
          setData(result)
          setState(
            'No current verified job/company release is available. No example companies or job counts are shown.',
          )
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setData(null)
          setState(e instanceof Error ? e.message : 'Dataset unavailable.')
        }
      })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const check = () => {
      if (data && Date.parse(data.valid_until) <= Date.now()) {
        setData(null)
        setState('Current job snapshot has expired. Refresh is required.')
      }
    }
    const timer = window.setInterval(check, 1000)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [data])
  const filter = route.params.get('company') || ''
  const search = route.params.get('q') || ''
  const jobs = data
    ? (filter ? relatedJobs(data, filter) : data.jobs)
        .filter((j) =>
          `${j.title} ${j.employer_name || ''} ${j.location || ''} ${j.technologies.join(' ')}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
        )
        .sort(
          (a, b) =>
            b.publication_date.localeCompare(a.publication_date) ||
            a.job_id.localeCompare(b.job_id),
        )
    : []
  const [limit, setLimit] = useState(25)
  useEffect(() => setLimit(25), [filter, search])
  return (
    <ReportFrame>
      <div className="company-intelligence">
        {!data ? (
          <>
            <h1>
              {route.page === 'company'
                ? 'Company Intelligence'
                : 'Veckans IT-jobb'}
            </h1>
            <p role="status">{state}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Retry data loading
            </button>
            <p>
              <a href="/#jobb">Job market analysis →</a>
            </p>
          </>
        ) : route.page === 'company' ? (
          <Profile data={data} id={route.companyId || ''} />
        ) : (
          <>
            <p>
              <a href="#jobb">← Job market analysis</a>
            </p>
            <h1>Veckans IT-jobb</h1>
            <p>
              Current IT advertisements, linked to verified legal entities where
              evidence permits.
            </p>
            <Coverage data={data} />
            <label className="company-search">
              Search title, employer, location or skill
              <input
                type="search"
                name="job-search"
                value={search}
                onChange={(e) => {
                  const p = new URLSearchParams(route.params)
                  p.set('q', e.target.value)
                  setHashParams(route.path, p)
                }}
              />
            </label>
            {filter && (
              <p>
                Canonical company filter: <code>{filter}</code> ·{' '}
                <a href="#jobb-it">Clear company filter</a>
              </p>
            )}
            <p role="status">{jobs.length} advertisements in this view.</p>
            {jobs.length ? (
              jobs
                .slice(0, limit)
                .map((j) => <JobCard key={j.job_id} job={j} data={data} />)
            ) : (
              <p>No advertisements match these filters.</p>
            )}
            {limit < jobs.length && (
              <button type="button" onClick={() => setLimit((n) => n + 25)}>
                Show more jobs
              </button>
            )}
          </>
        )}
      </div>
    </ReportFrame>
  )
}
