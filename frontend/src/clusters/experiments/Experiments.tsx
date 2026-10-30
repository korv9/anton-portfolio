/**
 * Clustering experiments per domain. On #cluster-visuals each domain's champion is shown; on
 * #cluster-visuals-experiments the candidates and rejected runs are listed with their status.
 * Address: `?domain=jobs`, `?run=<run_id>&group=<n>`. A run's coordinates belong to that run, so
 * switching runs draws a new map and never moves points between two maps.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { setHashParams, useRoute } from '../../router'
import {
  day,
  domainName,
  loadIndex,
  num,
  pct,
  runHref,
  statusName,
  type ExperimentIndex,
} from './data'
import RunDetail from './RunDetail'
import './experiments.css'

export const EXPERIMENTS = '#cluster-visuals-experiments'

export default function Experiments({ all }: { all: boolean }) {
  const route = useRoute()
  const [index, setIndex] = useState<
    ExperimentIndex | null | 'error' | undefined
  >()
  useEffect(() => {
    loadIndex().then(setIndex, () => setIndex('error'))
  }, [])
  const params = route.params
  const groupParam = params.get('group')
  const group =
    groupParam != null && /^\d+$/.test(groupParam) ? Number(groupParam) : null
  const setGroup = (g: number | null) => {
    const next = new URLSearchParams(params)
    if (g == null) next.delete('group')
    else next.set('group', String(g))
    setHashParams(route.path, next)
  }

  const heading = all
    ? l('Candidates and rejected runs', 'Kandidater och avvisade körningar')
    : l('Clustering experiments', 'Klustringsexperiment')
  const body = () => {
    if (index === undefined)
      return (
        <p className="cx-state" role="status" aria-busy="true">
          {l('Loading the experiments…', 'Läser in experimenten…')}
        </p>
      )
    if (index === 'error')
      return (
        <p className="cx-state" role="alert">
          {l(
            'The experiment index did not load.',
            'Experimentindexet kunde inte läsas.',
          )}
        </p>
      )
    const domains = Object.entries(index?.domains ?? {}).filter(
      ([, d]) => d.runs.length,
    )
    if (!index || !domains.length)
      return (
        <p className="cx-state">
          {l('No runs registered yet.', 'Inga körningar registrerade än.')}
        </p>
      )
    const runParam = params.get('run')
    const owner = runParam
      ? domains.find(([, d]) => d.runs.some((r) => r.run_id === runParam))?.[0]
      : undefined
    const key =
      owner ??
      domains.find(([k]) => k === params.get('domain'))?.[0] ??
      domains[0][0]
    const domain = index.domains[key]
    const others = domain.runs.filter((r) => r.status !== 'champion')
    const champion = domain.runs.find((r) => r.run_id === domain.champion)
    const shown = all
      ? ((owner ? runParam : null) ?? others[0]?.run_id ?? null)
      : domain.champion
    return (
      <>
        <p className="cx-note">{index.coordinates}</p>
        <nav className="cv-variants" aria-label={l('Domain', 'Domän')}>
          {domains.map(([k]) => (
            <a
              key={k}
              className="cx-chip"
              href={`${route.path}?domain=${k}`}
              aria-current={k === key ? 'page' : undefined}
            >
              {domainName(k)}
            </a>
          ))}
        </nav>
        <p className="cx-question">{domain.question}</p>
        {runParam && !owner && (
          <p className="cx-state" role="alert">
            {l(
              `Run ${runParam} is not registered.`,
              `Körning ${runParam} är inte registrerad.`,
            )}
          </p>
        )}
        {all ? (
          others.length ? (
            <div
              className="cx-table-wrap"
              tabIndex={0}
              role="region"
              aria-labelledby="cx-runs"
            >
              <table className="cx-table">
                <caption id="cx-runs">
                  {champion
                    ? l(
                        `Runs compared with the champion, ${champion.label}.`,
                        `Körningar jämförda med championen, ${champion.label}.`,
                      )
                    : l(
                        'Runs for this question; none is champion yet.',
                        'Körningar för frågan; ingen är champion än.',
                      )}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{l('Run', 'Körning')}</th>
                    <th scope="col">{l('Status', 'Status')}</th>
                    <th scope="col">{l('Embedding', 'Inbäddning')}</th>
                    <th scope="col">{l('Clustering', 'Klustring')}</th>
                    <th scope="col" className="num">
                      {l('Groups', 'Grupper')}
                    </th>
                    <th scope="col" className="num">
                      {l('Noise', 'Brus')}
                    </th>
                    <th scope="col" className="num">
                      {l('Seed ARI', 'Frö-ARI')}
                    </th>
                    <th scope="col">{l('Run on', 'Körd')}</th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((r) => (
                    <tr
                      key={r.run_id}
                      aria-current={r.run_id === shown || undefined}
                    >
                      <th scope="row">
                        <a href={runHref(r.run_id)}>{r.label}</a>
                      </th>
                      <td>
                        <span className={`cx-status cx-status-${r.status}`}>
                          {statusName(r.status, r.published_on_site_page)}
                        </span>
                      </td>
                      <td>{r.embedding.model ?? '–'}</td>
                      <td>{r.clustering.method ?? '–'}</td>
                      <td className="num">{num(r.cluster_count)}</td>
                      <td className="num">{pct(r.noise_share)}</td>
                      <td className="num">{num(r.seed_ari, 3)}</td>
                      <td>{day(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="cx-state">
              {l(
                'No candidates or rejected runs for this question.',
                'Inga kandidater eller avvisade körningar för frågan.',
              )}
            </p>
          )
        ) : !champion ? (
          <p className="cx-state">
            {l(
              'No champion yet for this question.',
              'Ingen champion än för frågan.',
            )}
          </p>
        ) : null}
        <p className="cx-note">
          {all ? (
            <a href={`#cluster-visuals?domain=${key}`}>
              {l('Back to the champions', 'Tillbaka till championerna')}
            </a>
          ) : (
            <a href={`${EXPERIMENTS}?domain=${key}`}>
              {l(
                `Candidates and rejected runs (${others.length})`,
                `Kandidater och avvisade körningar (${others.length})`,
              )}
            </a>
          )}
        </p>
        {shown && (
          <RunDetail key={shown} id={shown} group={group} onGroup={setGroup} />
        )}
      </>
    )
  }
  return (
    <section className="cx" id="cv-experiments" aria-labelledby="cx-title">
      <h2 id="cx-title">{heading}</h2>
      {body()}
    </section>
  )
}
