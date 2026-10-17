import CompanyDeepDive from '../companies/CompanyDeepDive'
import type { CompanyData, Job } from '../companies/model'
import type { JobDetail } from './model'
import type { SearchProfile } from './profile'
import type { Relevance } from './ranking'
import Requirements from './Requirements'
import CvMatch from './CvMatch'

export default function JobResearch({
  job,
  data,
  detail,
  state,
  retry,
  profile,
  match,
}: {
  job: Job
  data: CompanyData
  detail: JobDetail | undefined
  state: string
  retry: () => void
  profile: SearchProfile | null
  match: Relevance | null
}) {
  const link = data.links.find(
    (l) =>
      l.job_id === job.job_id && l.relationship_type === 'advertised_employer',
  )!
  const roles = data.links
    .filter((l) => l.job_id === job.job_id && l.match_status === 'verified')
    .sort(
      (a, b) =>
        Number(b.relationship_type === 'actual_employer') -
        Number(a.relationship_type === 'actual_employer'),
    )
  const entities = roles.filter(
    (r, i) =>
      roles.findIndex((other) => other.company_id === r.company_id) === i,
  )
  return (
    <>
      <header className="ji-job-head" id="ji-overview">
        <h2>{job.title}</h2>
        <p>
          <strong>{job.employer_name || 'Employer unavailable'}</strong> ·{' '}
          {job.location || 'Location unspecified'} · Published{' '}
          <time dateTime={job.publication_date}>
            {job.publication_date.slice(0, 10)}
          </time>
        </p>
        <p className="ji-evidence">
          Workplace: {job.workplace_name || 'Unspecified'} · Deadline:{' '}
          {job.application_deadline?.slice(0, 10) || 'Unspecified'} ·{' '}
          {[detail?.employment_type, detail?.working_hours, detail?.duration]
            .filter(Boolean)
            .join(' · ') || 'Employment terms unspecified'}{' '}
          · Salary: {detail?.salary || detail?.salary_type || 'Unspecified'}
        </p>
        {!!detail?.remote_evidence.length && (
          <p className="ji-evidence">
            Remote / hybrid source wording: {detail.remote_evidence.join(' · ')}
          </p>
        )}
        <div className="ji-actions">
          <a
            className="btn-quiet"
            href={detail?.application_url || job.source_url}
            target="_blank"
            rel="noreferrer"
          >
            {detail?.application_url
              ? 'Apply at source ↗'
              : 'Original advertisement ↗'}
          </a>
          <a href={job.source_url} target="_blank" rel="noreferrer">
            JobSearch source ↗
          </a>
        </div>
      </header>
      <section
        className="ji-section ji-original"
        id="ji-advertisement"
        aria-labelledby="ji-advertisement-title"
      >
        <h3 id="ji-advertisement-title">Full Advertisement</h3>
        {detail ? (
          <>
            <small>
              Original source wording · {detail.text_origin} ·{' '}
              {detail.contact_redactions} contact occurrence(s) omitted ·
              plain-text formatting.
            </small>
            <div className="ji-advertisement" lang="sv">
              {detail.description_text ||
                'Source description unavailable. Open the original advertisement.'}
            </div>
            <p className="ji-evidence">
              Payload SHA-256 <code>{job.document_hash}</code> · observed{' '}
              {data.generated_at} · refresh due {data.valid_until}.
            </p>
          </>
        ) : (
          <>
            <p role="status">{state}</p>
            <button type="button" onClick={retry}>
              Retry full advertisement
            </button>
          </>
        )}
      </section>
      {detail ? (
        <Requirements detail={detail} />
      ) : (
        <section className="ji-section" id="ji-analysis">
          <h3>Job Requirements &amp; Insights</h3>
          <p>Requirements wait for a matching full advertisement.</p>
        </section>
      )}
      <CvMatch profile={profile} match={match} />
      <section
        className="ji-section"
        id="ji-company"
        aria-labelledby="ji-company-title"
      >
        <h3 id="ji-company-title">Company Deep Dive</h3>
        {entities.map((role) => (
          <div
            key={role.company_id!}
            aria-label={role.relationship_type.replaceAll('_', ' ')}
          >
            {roles.length > 1 && (
              <p>
                <strong>
                  Documented {role.relationship_type.replaceAll('_', ' ')}:
                </strong>
              </p>
            )}
            <CompanyDeepDive
              data={data}
              id={role.company_id!}
              advertisedName={job.employer_name}
              jobLink={role}
            />
          </div>
        ))}
        {link.match_status !== 'verified' && (
          <p>
            Advertised entity match: {link.match_status.replaceAll('_', ' ')}.
            Company and compliance information is withheld until identity is
            verified.
          </p>
        )}
      </section>
      <section className="ji-section" id="ji-research">
        <h3>Advanced Research</h3>
        <p className="ji-availability">
          Additional enrichment requires reviewed, directly attributed sources.
          No unsupported company facts are inferred.
        </p>
        <a href="/#compliance">Compliance &amp; Legal History →</a>
      </section>
    </>
  )
}
