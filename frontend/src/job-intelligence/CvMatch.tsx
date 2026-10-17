import type { SearchProfile } from './profile'
import type { Relevance } from './ranking'

export default function CvMatch({
  profile,
  match,
}: {
  profile: SearchProfile | null
  match: Relevance | null
}) {
  return (
    <section className="ji-section" id="ji-cv" aria-labelledby="ji-cv-title">
      <h3 id="ji-cv-title">CV Match</h3>
      {!profile ? (
        <p className="ji-availability">
          Public mode: generic job analysis only. Private CV matching is
          disabled; no CV is uploaded, stored or sent externally.
        </p>
      ) : !match ? (
        <p role="status">
          Local relevance analysis waits for the exact full advertisement
          version.
        </p>
      ) : (
        <>
          <p>
            <strong>Local relevance estimate {match.score}/100</strong> ·{' '}
            {match.suitable
              ? 'Within configured role preferences'
              : 'Outside configured recommendation criteria'}
            . This is a transparent research estimate, not an employer or ATS
            assessment.
          </p>
          <p className="ji-evidence">
            Matching runs in this browser. The qualification file is local and
            user-controlled. No CV is uploaded or sent to an external service.
          </p>
          <div className="ji-match-factors">
            {match.factors.map((f) => (
              <div key={f.key}>
                <strong>{f.key}</strong>
                <span>
                  {f.value === null
                    ? 'Unassessed'
                    : `${Math.round(f.value * 100)}/100`}{' '}
                  · weight {f.weight}
                </span>
                <small>{f.explanation}</small>
              </div>
            ))}
          </div>
          <div className="ji-match-evidence">
            {(['matched', 'partial', 'not_evidenced'] as const).map((state) => (
              <div key={state}>
                <h4>
                  {
                    {
                      matched: 'Matched explicit requirements',
                      partial: 'Partially evidenced',
                      not_evidenced: 'Not evidenced by the CV',
                    }[state]
                  }
                </h4>
                {match.requirements.filter((r) => r.state === state).length ? (
                  <ul>
                    {match.requirements
                      .filter((r) => r.state === state)
                      .map((m, i) => (
                        <li key={i}>
                          <strong>{m.requirement.label}</strong> ·{' '}
                          {m.requirement.strength}
                          <q lang="sv">{m.requirement.quote}</q>
                          {m.evidence && (
                            <span className="ji-cv-evidence">
                              CV: <q>{m.evidence.quote}</q> ·{' '}
                              {m.evidence.source_ref}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>None identified.</p>
                )}
              </div>
            ))}
          </div>
          <h4>Hard requirements to verify</h4>
          {match.blockers.length ? (
            <ul>
              {match.blockers.map((b, i) => (
                <li key={i}>
                  {b.reason} <q lang="sv">{b.quote}</q>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No blocker identified by these bounded rules. This is not proof
              that every condition is met.
            </p>
          )}
          <h4>Relevant CV experience and projects</h4>
          <ul>
            {profile.facts.experience
              .filter((e) =>
                e.skills.some((s) =>
                  match.requirements.some((m) => m.evidence?.skill === s),
                ),
              )
              .map((e, i) => (
                <li key={i}>
                  <strong>{e.label}</strong> · {e.kind}
                  <q>{e.quote}</q>
                  <small>{e.source_ref}</small>
                </li>
              ))}
          </ul>
          <p className="ji-evidence">
            CV education: {profile.facts.education.quote} ·{' '}
            {profile.facts.education.source_ref}. Professional years:{' '}
            {profile.facts.professional_years === null
              ? 'not stated; internships and project work are not converted into years'
              : profile.facts.professional_years}
            .
          </p>
          <small>
            Missing keywords mean not evidenced, never proof of missing
            competence. Preferences and factor weights are local configuration;
            qualifications come from the source CV. Version {match.version}.
          </small>
        </>
      )}
    </section>
  )
}
