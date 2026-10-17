import { useEffect, useState } from 'react'
import { parseRelease, type Release } from '../compliance/model'
import { Source } from './CompanyEvidence'

export function Compliance({
  id,
  headingLevel = 2,
}: {
  id: string
  headingLevel?: 2 | 4 | 5
}) {
  const Heading = headingLevel === 5 ? 'h5' : headingLevel === 4 ? 'h4' : 'h2'
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
      <Heading>Documented compliance decisions</Heading>
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
