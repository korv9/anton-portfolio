/**
 * A run's quality measures, its dominance by source against the null, its stated limitations,
 * and the comparison with the champion exactly as acceptance recorded it, criterion by criterion.
 */
import { Fragment } from 'react'
import { l } from '../../i18n'
import { num, pct, type Criterion, type RunFile } from './data'

const value = (v: number | null | undefined) => num(v, 3)

/** The rule a criterion checked, in words, from the frozen criteria file. */
function rule(c: Criterion) {
  if (c.at_least != null) return `≥ ${value(c.at_least)}`
  if (c.at_most != null) return `≤ ${value(c.at_most)}`
  const lower = c.direction === 'lower'
  if (c.not_worse_than_champion != null)
    return l(
      `at most ${value(c.not_worse_than_champion)} ${lower ? 'above' : 'below'} the champion`,
      `högst ${value(c.not_worse_than_champion)} ${lower ? 'över' : 'under'} championen`,
    )
  if (c.better_than_champion != null)
    return l(
      `at least ${value(c.better_than_champion)} ${lower ? 'below' : 'above'} the champion`,
      `minst ${value(c.better_than_champion)} ${lower ? 'under' : 'över'} championen`,
    )
  return ''
}

const passed = (ok: boolean) => (ok ? l('Yes', 'Ja') : l('No', 'Nej'))

function Row({ c, inner }: { c: Criterion; inner?: boolean }) {
  return (
    <tr className={inner ? 'cx-inner' : undefined}>
      <th scope="row">
        {c.name ?? c.metric}
        {c.name && c.metric && <small> {c.metric}</small>}
        {c.required === false && (
          <small> {l('(not required)', '(ej krav)')}</small>
        )}
      </th>
      <td>
        {c.any_of
          ? l('at least one of these holds', 'minst ett av dessa håller')
          : rule(c)}
      </td>
      <td className="num">{c.any_of ? '' : value(c.candidate)}</td>
      <td className="num">{c.any_of ? '' : value(c.champion)}</td>
      <td>
        {passed(c.passed)}
        {c.note && <small> {c.note}</small>}
      </td>
    </tr>
  )
}

export default function RunQuality({ file }: { file: RunFile }) {
  const m = file.run.metrics
  const a = file.acceptance
  const measures: [string, string][] = [
    [l('Groups', 'Grupper'), num(m.cluster_count)],
    [l('Noise', 'Brus'), pct(m.noise_share)],
    ...(m.coverage != null
      ? [[l('Coverage', 'Täckning'), pct(m.coverage)] as [string, string]]
      : []),
    ...(m.largest_cluster_share != null
      ? [
          [
            l('Largest group', 'Största grupp'),
            pct(m.largest_cluster_share),
          ] as [string, string],
        ]
      : []),
    [
      l('Seed stability (ARI mean / min)', 'Fröstabilitet (ARI medel / min)'),
      `${value(m.seed_stability?.ari_mean)} / ${value(m.seed_stability?.ari_min)}`,
    ],
    [
      l('Separation, clustered space', 'Separation, klustringsrummet'),
      value(m.separation_clustered),
    ],
    [
      l(
        'Separation, representation space',
        'Separation, representationsrummet',
      ),
      value(m.separation_representation),
    ],
  ]
  const dominance = Object.entries(m.dominance ?? {})
  return (
    <section
      className="cx-quality"
      aria-labelledby={`cx-quality-${file.run_id}`}
    >
      <h4 id={`cx-quality-${file.run_id}`}>{l('Quality', 'Kvalitet')}</h4>
      <dl className="cx-facts cx-measures">
        {measures.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {dominance.length > 0 && (
        <div
          className="cx-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={l('Dominance by source', 'Dominans per källa')}
        >
          <table className="cx-table">
            <caption>
              {l(
                'Do groups follow one source? The weighted share of each group’s most common value, against the 95th percentile of shuffled labels.',
                'Följer grupperna en källa? Den viktade andelen av varje grupps vanligaste värde, mot 95:e percentilen för blandade etiketter.',
              )}
            </caption>
            <thead>
              <tr>
                <th scope="col">{l('Field', 'Fält')}</th>
                <th scope="col" className="num">
                  {l('Top share', 'Toppandel')}
                </th>
                <th scope="col" className="num">
                  {l('Null p95', 'Noll p95')}
                </th>
                <th scope="col" className="num">
                  AMI
                </th>
              </tr>
            </thead>
            <tbody>
              {dominance.map(([field, d]) => (
                <tr key={field}>
                  <th scope="row">{field}</th>
                  <td className="num">{pct(d.weighted_top_share)}</td>
                  <td className="num">{pct(d.null_top_share_p95)}</td>
                  <td className="num">{value(d.ami)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4>{l('Limitations', 'Begränsningar')}</h4>
      <ul className="cx-limits">
        {file.run.limitations.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <h4>{l('Against the champion', 'Mot championen')}</h4>
      {!a ? (
        <p className="cx-note">
          {file.status === 'champion'
            ? l(
                'This run is the champion; no acceptance record is attached.',
                'Körningen är champion; inget acceptansprotokoll finns.',
              )
            : l(
                'No acceptance check was recorded for this run.',
                'Ingen acceptanskontroll registrerades för körningen.',
              )}
        </p>
      ) : (
        <div
          className="cx-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={l(
            'Comparison with the champion',
            'Jämförelse med championen',
          )}
        >
          <table className="cx-table cx-accept">
            <caption>
              {a.passed
                ? l('Every required criterion held.', 'Alla krav höll.')
                : l(
                    `Failed: ${a.failed.join(', ')}.`,
                    `Föll på: ${a.failed.join(', ')}.`,
                  )}{' '}
              {a.champion_run_id
                ? l(
                    `Compared with ${a.champion_run_id}.`,
                    `Jämförd med ${a.champion_run_id}.`,
                  )
                : l(
                    'There was no champion to compare with.',
                    'Det fanns ingen champion att jämföra med.',
                  )}{' '}
              {l('Criteria file', 'Kriteriefil')} sha256{' '}
              <code>{a.criteria_sha256.slice(0, 12)}</code>
            </caption>
            <thead>
              <tr>
                <th scope="col">{l('Criterion', 'Kriterium')}</th>
                <th scope="col">{l('Rule', 'Regel')}</th>
                <th scope="col" className="num">
                  {l('Candidate', 'Kandidat')}
                </th>
                <th scope="col" className="num">
                  {l('Champion', 'Champion')}
                </th>
                <th scope="col">{l('Passed', 'Godkänd')}</th>
              </tr>
            </thead>
            <tbody>
              {a.criteria.map((c, i) => (
                <Fragment key={c.name ?? c.metric ?? i}>
                  <Row c={c} />
                  {c.any_of?.map((inner, j) => (
                    <Row key={j} c={inner} inner />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
