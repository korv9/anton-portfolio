import type { JobDetail } from './model'
export default function Requirements({ detail }: { detail: JobDetail }) {
  return (
    <section
      className="ji-section"
      id="ji-analysis"
      aria-labelledby="ji-analysis-title"
    >
      <h3 id="ji-analysis-title">Job Requirements &amp; Insights</h3>
      <div className="ji-requirements">
        {(['required', 'preferred', 'ambiguous'] as const).map((level) => {
          const rows = detail.analysis.requirements.filter(
            (r) => r.strength === level,
          )
          return (
            <div key={level}>
              <h4>
                {
                  {
                    required: 'Required',
                    preferred: 'Preferred',
                    ambiguous: 'Mentioned / uncertain',
                  }[level]
                }
              </h4>
              {rows.length ? (
                <ul>
                  {rows.map((r, i) => (
                    <li key={i}>
                      <strong>{r.label}</strong>{' '}
                      <small>
                        {r.category.replaceAll('_', ' ')} ·{' '}
                        {r.line ? `source line ${r.line}` : r.source_field}
                      </small>
                      <q lang="sv">{r.quote}</q>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No supported observations.</p>
              )}
            </div>
          )
        })}
      </div>
      <small>
        {detail.analysis.limitations} · {detail.analysis.version}
      </small>
    </section>
  )
}
