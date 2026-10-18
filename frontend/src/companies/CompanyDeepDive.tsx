import { CompanyLink, Source } from './CompanyEvidence'
import { Compliance } from './CompanyCompliance'
import {
  relatedJobs,
  sizeLabels,
  hiringDaily,
  type CompanyData,
  type ContextFact,
  type Link,
} from './model'
import RankBars from '../charts/RankBars'

function Facts({
  data,
  id,
  kinds,
  empty,
}: {
  data: CompanyData
  id: string
  kinds: ContextFact['kind'][]
  empty: string
}) {
  const rows = data.context.filter(
    (f) => f.company_id === id && kinds.includes(f.kind),
  )
  if (!rows.length) return <p className="ji-availability">{empty}</p>
  return (
    <div className="company-table">
      <table>
        <caption>Reviewed legal entity observations</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Measure</th>
            <th scope="col">Value / unit</th>
            <th scope="col">Source / verified</th>
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
                <Source url={f.source_url} />
                {f.source_locator} · {f.verified_at}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export default function CompanyDeepDive({
  data,
  id,
  advertisedName,
  headingLevel = 4,
  jobLink,
}: {
  data: CompanyData
  id: string
  advertisedName?: string | null
  headingLevel?: 3 | 4
  jobLink?: Link
}) {
  const c = data.companies.find((c) => c.company_id === id)
  if (!c)
    return (
      <p>
        Verified company identity is unavailable. No similarly named company has
        been substituted.
      </p>
    )
  const jobs = relatedJobs(data, id),
    days = hiringDaily(data, id)
  const relations = data.relationships.filter(
    (r) => r.company_id === id || r.related_company_id === id,
  )
  const H = headingLevel === 3 ? 'h3' : 'h4'
  const period =
    data.coverage.window_start.slice(0, 10) +
    ' – ' +
    data.coverage.window_end.slice(0, 10)
  return (
    <div className="company-deep-dive company-intelligence">
      <section className="ji-company-section">
        <H>Company Snapshot</H>
        <p>
          <strong>
            <CompanyLink id={id}>{c.registered_legal_name}</CompanyLink>
          </strong>{' '}
          · {c.organization_number || c.registry_number}
        </p>
        <dl className="ji-snapshot">
          <div>
            <dt>Advertised employer</dt>
            <dd>{advertisedName || 'Not specified in this view'}</dd>
          </div>
          <div>
            <dt>Industry</dt>
            <dd>
              SNI {c.sni_version} {c.primary_sni_code || 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt>Employee size</dt>
            <dd>
              {sizeLabels[c.employee_size_class || ''] || 'Unavailable'} (SCB
              interval)
            </dd>
          </div>
          <div>
            <dt>Current IT ads</dt>
            <dd>
              {jobs.length} observed · {period}
            </dd>
          </div>
          <div>
            <dt>Identity</dt>
            <dd>
              {jobLink
                ? `${jobLink.relationship_type.replaceAll('_', ' ')} · ${jobLink.match_method.replaceAll('_', ' ')} · evidence strength ${jobLink.match_confidence}`
                : 'Verified canonical legal entity'}
            </dd>
          </div>
          <div>
            <dt>Registry observation</dt>
            <dd>
              {c.snapshot_date} · verified {c.last_verified_at}
            </dd>
          </div>
          <div>
            <dt>Registered location</dt>
            <dd>Not in current registry projection</dd>
          </div>
          <div>
            <dt>Legal coverage</dt>
            <dd>
              Independent approved release required; assessed separately below
            </dd>
          </div>
        </dl>
        <Source url={c.source_url} />
        <small>
          Canonical ID: {id}. An advertiser, recruiter, end client, brand,
          corporate group and issuer are separate identities.
        </small>
        {jobLink?.evidence.map((e, i) => (
          <p className="ji-evidence" key={i}>
            <Source url={(e.source_url || e.evidence_url)!} />
            {e.source_locator} · verified {jobLink.verified_at}
          </p>
        ))}
        {relations.length ? (
          <ul>
            {relations.map((r, i) => {
              const other =
                r.company_id === id ? r.related_company_id : r.company_id
              return (
                <li key={i}>
                  {r.company_id === id ? 'Outgoing' : 'Incoming'}{' '}
                  {r.relationship_type.replaceAll('_', ' ')}:{' '}
                  <CompanyLink id={other}>
                    {
                      data.companies.find((c) => c.company_id === other)!
                        .registered_legal_name
                    }
                  </CompanyLink>{' '}
                  · {r.valid_from || 'date unknown'} –{' '}
                  {r.valid_to || 'current/unknown'} ·{' '}
                  <Source url={r.source_url} />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="ji-availability">
            No reviewed parent/subsidiary relationship. Ownership never
            transfers legal findings.
          </p>
        )}
      </section>
      <section className="ji-company-section">
        <H>Financial Health</H>
        <Facts
          data={data}
          id={id}
          kinds={['financial']}
          empty="No reviewed financial history or ratios available. Five-year trends require dated statements and consistent units."
        />
      </section>
      <section className="ji-company-section">
        <H>Workforce</H>
        <p>
          SCB employee interval:{' '}
          {sizeLabels[c.employee_size_class || ''] || 'Unavailable'}, observed{' '}
          {c.snapshot_date}. This is not an exact headcount or a historical
          growth series. <Source url={c.source_url} />
        </p>
        <Facts
          data={data}
          id={id}
          kinds={['employees']}
          empty="No reviewed historical workforce observations or documented workforce changes available."
        />
      </section>
      <section className="ji-company-section">
        <H>Hiring Activity</H>
        <p>
          {jobs.length} distinct active observed IT advertisements · {period} ·
          updated {data.generated_at}. Advertisements are not confirmed hires;
          this window does not establish a historical hiring trend.
        </p>
        {days.length > 1 && jobs.length > 2 && (
          <div className="ji-hiring-chart">
            <RankBars
              rows={days.map((d) => ({
                key: d.day,
                label: d.day,
                value: d.ads,
              }))}
              format={String}
              label="Active observed advertisements by publication day"
            />
            <small>
              Unit: distinct advertisements · {period} ·{' '}
              <Source url={data.coverage.source_url} />
            </small>
          </div>
        )}
        <ul className="ji-related-jobs">
          {jobs.map((j) => (
            <li key={j.job_id}>
              <a href={'/#jobb-it?job=' + encodeURIComponent(j.job_id)}>
                {j.title}
              </a>{' '}
              · {j.location || 'location unspecified'} ·{' '}
              {j.publication_date.slice(0, 10)}
            </li>
          ))}
        </ul>
      </section>
      <section className="ji-company-section">
        <H>Technology</H>
        <p>
          Advertised skills:{' '}
          {[
            ...new Set(
              jobs.flatMap((j) => j.normalized_skills || j.technologies),
            ),
          ].join(' · ') || 'Not available'}
          . These are recruitment signals, not proof of internal deployment.
        </p>
        <Facts
          data={data}
          id={id}
          kinds={['technology', 'github']}
          empty="No verified repository ownership or additional sourced architecture observations available."
        />
      </section>
      <section className="ji-company-section">
        <H>Clients &amp; Contracts</H>
        <Facts
          data={data}
          id={id}
          kinds={['contracts']}
          empty="No reviewed client or public-contract evidence available. Framework award values are not realised revenue."
        />
      </section>
      <section className="ji-company-section">
        <H>Corporate Events</H>
        <Facts
          data={data}
          id={id}
          kinds={['corporate_events']}
          empty="No reviewed announcements, acquisitions, redundancies, expansion or investment events available."
        />
      </section>
      <section className="ji-company-section">
        <H>Compliance &amp; Legal History</H>
        <Compliance id={id} headingLevel={headingLevel === 3 ? 4 : 5} />
      </section>
      <section className="ji-company-section">
        <H>Stock Market</H>
        <Facts
          data={data}
          id={id}
          kinds={['stock']}
          empty="No verified issuer mapping or market series available. A listed parent is not substituted for this entity."
        />
      </section>
    </div>
  )
}
