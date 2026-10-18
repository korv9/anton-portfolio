import { CompanyLink, Source } from './CompanyEvidence'
import { sizeLabels, type CompanyData, type Job } from './model'

export default function JobCard({
  job,
  data,
}: {
  job: Job
  data: CompanyData
}) {
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
        <h2>
          <a href={'/#jobb-it?job=' + encodeURIComponent(job.job_id)}>
            {job.title}
          </a>
        </h2>
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
            Open Company Deep Dive →
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
