import { useEffect, useState } from 'react'
import type { Route } from '../router'
import { fetchData } from '../dataSource'
import { ReportFrame } from '../report/ReportShell'
import CompanyDeepDive from './CompanyDeepDive'
import { parseCompanyData, relatedJobs, type CompanyData } from './model'
import CompanyJobCard from './CompanyJobCard'
import { Source } from './CompanyEvidence'
export { CompanyLink, Source } from './CompanyEvidence'
export { Compliance } from './CompanyCompliance'
import './companies.css'

export function Coverage({ data }: { data: CompanyData }) {
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
        <a href="/#jobb-it">Return to Job Intelligence</a>
      </>
    )
  return (
    <>
      <p>
        <a href="/#jobb-it">← Job Intelligence</a>
      </p>
      <h1>{c.registered_legal_name}</h1>
      <h2>Company Deep Dive</h2>
      <CompanyDeepDive key={id} data={data} id={id} headingLevel={3} />
      <section className="company-section">
        <h2>Related current IT jobs</h2>
        <a href={'/#jobb-it?company=' + encodeURIComponent(id)}>
          Open filtered job list →
        </a>
        {relatedJobs(data, id).map((j) => (
          <CompanyJobCard key={j.job_id} job={j} data={data} />
        ))}
      </section>
      <Coverage data={data} />
    </>
  )
}
export function useCompanyData() {
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
  return { data, state, retry: () => setAttempt((n) => n + 1) }
}
export default function CompanyIntelligence({ route }: { route: Route }) {
  const { data, state, retry } = useCompanyData()
  return (
    <ReportFrame>
      <div className="company-intelligence">
        {data ? (
          <Profile data={data} id={route.companyId || ''} />
        ) : (
          <>
            <h1>Company Deep Dive</h1>
            <p role="status">{state}</p>
            <button type="button" onClick={retry}>
              Retry data loading
            </button>
            <p>
              <a href="/#jobb-it">Job Intelligence</a>
            </p>
          </>
        )}
      </div>
    </ReportFrame>
  )
}
