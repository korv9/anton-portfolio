import { useEffect, useLayoutEffect, useRef } from 'react'
import { setHashParams, type Route } from '../router'
import { filterJobs, jobInstant } from './model'
import JobFilters from './JobFilters'
import JobResearch from './JobResearch'
import useWorkspace from './useWorkspace'
import './workspace.css'

export default function JobIntelligence({ route }: { route: Route }) {
  const w = useWorkspace(route.params.get('job'))
  const research = useRef<HTMLDivElement>(null),
    list = useRef<HTMLDivElement>(null)
  const initialSelection = useRef(route.params.has('job')),
    userSelected = useRef(false)
  const selectedId = route.params.get('job') || w.jobs[0]?.job_id
  const selected = w.data?.jobs.find(
    (j) =>
      j.job_id === selectedId &&
      (!j.application_deadline ||
        jobInstant(j.application_deadline, true) >= Date.now()),
  )
  const sorted =
    route.params.get('sort') === 'newest'
      ? [...w.jobs].sort(
          (a, b) =>
            jobInstant(b.publication_date) - jobInstant(a.publication_date) ||
            a.job_id.localeCompare(b.job_id),
        )
      : w.jobs
  const filtered = w.data ? filterJobs(sorted, w.data, route.params) : []
  useEffect(() => {
    if (
      !w.ready ||
      !w.jobs.length ||
      initialSelection.current ||
      userSelected.current
    )
      return
    const p = new URLSearchParams(route.params)
    p.set('job', w.jobs[0].job_id)
    setHashParams('#jobb-it', p)
  }, [w.ready, w.profile, w.jobs[0]?.job_id])
  useLayoutEffect(() => {
    if (research.current) research.current.scrollTop = 0
  }, [selectedId])
  useEffect(() => {
    const item = list.current?.querySelector<HTMLElement>(
      'button[aria-pressed="true"]',
    )
    if (!item || !list.current) return
    const row = item.getBoundingClientRect(),
      box = list.current.getBoundingClientRect()
    if (row.top < box.top) list.current.scrollTop += row.top - box.top
    else if (row.bottom > box.bottom)
      list.current.scrollTop += row.bottom - box.bottom
  }, [selectedId, filtered.length])
  function choose(id: string) {
    if (id === selectedId) return
    userSelected.current = true
    const p = new URLSearchParams(route.params)
    p.set('job', id)
    history.pushState(null, '', '#jobb-it?' + p)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
  function change(key: string, value: string) {
    const p = new URLSearchParams(route.params)
    if (value) p.set(key, value)
    else p.delete(key)
    setHashParams('#jobb-it', p)
  }
  const match = selected
    ? w.rankings.find((r) => r.job_id === selected.job_id) || null
    : null
  return (
    <div className="job-intelligence" lang="en">
      <header className="ji-workspace-head">
        <div>
          <h1>Job Intelligence</h1>
          <p>
            {w.profile
              ? 'Local CV preferences · evidence-based relevance estimates'
              : 'Current IT jobs · original wording · verified company evidence'}
          </p>
        </div>
        <nav aria-label="Intelligence workspaces">
          <a href="/#compliance">Compliance &amp; Legal History</a>
          <a href="/#jobb">Labour Market Observatory</a>
        </nav>
      </header>
      {w.profileState === 'invalid' && (
        <p role="status">
          Local qualification configuration could not be validated. Generic
          public analysis is shown; no CV matching is active.
        </p>
      )}
      {!w.data ? (
        <div className="ji-unavailable">
          <p role="status">{w.state}</p>
          <button type="button" onClick={w.retry}>
            Retry data loading
          </button>
        </div>
      ) : (
        <>
          <div className="ji-split">
            <aside className="ji-explorer" aria-labelledby="ji-explorer-title">
              <header>
                <h2 id="ji-explorer-title">Job Explorer</h2>
                <p>
                  {w.profile
                    ? `${w.jobs.length} relevant current jobs · ${route.params.get('sort') === 'newest' ? 'newest within recommendations' : 'best match first'}`
                    : `Latest ${w.jobs.length} active Data/IT ads · newest first`}
                </p>
              </header>
              <JobFilters
                jobs={w.jobs}
                data={w.data}
                params={route.params}
                change={change}
                privateMode={!!w.profile}
                clear={() => {
                  const p = new URLSearchParams(route.params)
                  for (const k of [
                    'q',
                    'skill',
                    'location',
                    'seniority',
                    'company',
                  ])
                    p.delete(k)
                  setHashParams('#jobb-it', p)
                }}
              />
              <p className="ji-result-count" role="status">
                {filtered.length} matching results of {w.jobs.length}
                {filtered.length !== w.jobs.length ? ' · Filters active' : ''}
              </p>
              {w.profile && (
                <small>
                  {w.candidateCount} current source candidates ·{' '}
                  {w.suitableCount} meet configured recommendation criteria
                  {w.jobs.length < 50
                    ? ' · Fewer than 50 suitable advertisements'
                    : ''}
                  .
                </small>
              )}
              <div
                ref={list}
                className="ji-job-list"
                tabIndex={0}
                aria-label="Current IT job advertisements"
              >
                {filtered.length ? (
                  <ul>
                    {filtered.map((j) => {
                      const relevance = w.rankings.find(
                        (r) => r.job_id === j.job_id,
                      )
                      return (
                        <li key={j.job_id}>
                          <article
                            className="ji-job-item"
                            data-selected={j.job_id === selectedId}
                          >
                            <button
                              type="button"
                              aria-pressed={j.job_id === selectedId}
                              onClick={() => choose(j.job_id)}
                            >
                              <span className="ji-job-title">{j.title}</span>
                              <span>
                                {j.employer_name || 'Employer unspecified'}
                              </span>
                              <small>
                                {j.location || 'Location unspecified'} ·{' '}
                                {j.publication_date.slice(0, 10)}
                              </small>
                              <small>
                                {relevance
                                  ? `${relevance.score}/100 local relevance${relevance.blockers.length ? ' · verify requirements' : ''}`
                                  : 'Public analysis'}
                              </small>
                            </button>
                          </article>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p>
                    {w.profile && !w.ready
                      ? 'Preparing the local candidate ranking…'
                      : 'No advertisements match these filters or recommendation criteria. The selected job remains open.'}
                  </p>
                )}
              </div>
            </aside>
            <div
              ref={research}
              className="ji-research"
              role="region"
              aria-label="Selected job research"
              tabIndex={0}
            >
              {selected ? (
                <>
                  {!filtered.some((j) => j.job_id === selected.job_id) && (
                    <p className="ji-filter-note">
                      Selected job is outside the current filters or
                      recommendation list.
                    </p>
                  )}
                  <JobResearch
                    job={selected}
                    data={w.data}
                    detail={w.details.find((d) => d.job_id === selected.job_id)}
                    state={w.detailState}
                    retry={w.retryDetails}
                    profile={w.profile}
                    match={match}
                  />
                </>
              ) : (
                <p role="status">
                  {!w.ready
                    ? 'Loading current advertisement evidence…'
                    : 'The selected advertisement is unavailable, expired or removed from the current snapshot. Choose another job.'}
                </p>
              )}
            </div>
          </div>
          <div className="ji-coverage">
            <p>
              Observed {w.data.generated_at} · refresh due {w.data.valid_until}{' '}
              · {w.data.metrics.verified_company_links}/
              {w.data.metrics.total_active_it_ads} verified advertised company
              links. Job population is independent of the frozen SCB compliance
              cohort.
            </p>
            <a
              href={w.data.coverage.source_url}
              target="_blank"
              rel="noreferrer"
            >
              JobSearch source and coverage ↗
            </a>
          </div>
        </>
      )}
    </div>
  )
}
