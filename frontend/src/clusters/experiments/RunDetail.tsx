/**
 * One registered run: what it asked of which data, how it was fitted, its map with a group
 * filter, the groups as a table (the map's text alternative), a group's source passages, and its
 * quality against the champion. The run file loads when the run is opened.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import ClusterScatter from '../ClusterScatter'
import {
  day,
  describe,
  groupName,
  loadRun,
  nameState,
  num,
  pct,
  runHref,
  statusName,
  type Example,
  type RunFile,
} from './data'
import RunQuality from './RunQuality'

function Source({ source }: { source?: Record<string, unknown> }) {
  if (!source) return null
  const url = typeof source.url === 'string' ? source.url : null
  const text = Object.entries(source)
    .filter(([k, v]) => k !== 'url' && v != null && typeof v !== 'object')
    .map(([, v]) => String(v))
    .join(' · ')
  return (
    <cite>
      {url && /^https?:\/\//.test(url) ? (
        <a href={url} rel="noreferrer">
          {text || url}
        </a>
      ) : (
        text
      )}
    </cite>
  )
}

function Passages({ examples }: { examples: Example[] }) {
  if (!examples.length)
    return (
      <p>
        {l(
          'The export kept no passages for this group.',
          'Exporten sparade inga passager för gruppen.',
        )}
      </p>
    )
  return (
    <ol className="cx-passages">
      {examples.map((e) => (
        <li key={e.id}>
          <blockquote>{e.text}</blockquote>
          <Source source={e.source} />
        </li>
      ))}
    </ol>
  )
}

export default function RunDetail({
  id,
  group,
  onGroup,
}: {
  id: string
  group: number | null
  onGroup: (group: number | null) => void
}) {
  const [file, setFile] = useState<RunFile | 'error' | null>(null)
  useEffect(() => {
    let live = true
    setFile(null)
    loadRun(id).then(
      (f) => live && setFile(f),
      () => live && setFile('error'),
    )
    return () => {
      live = false
    }
  }, [id])
  const points = useMemo(
    () =>
      file && file !== 'error'
        ? file.map.points.map(([pid, x, y, c]) => ({ x, y, c, label: pid }))
        : [],
    [file],
  )
  if (file === 'error')
    return (
      <p className="cx-state" role="alert">
        {l(
          `The file for run ${id} did not load.`,
          `Filen för körning ${id} kunde inte läsas.`,
        )}
      </p>
    )
  if (!file)
    return (
      <p className="cx-state" role="status" aria-busy="true">
        {l('Loading the run…', 'Läser in körningen…')}
      </p>
    )
  const { run, groups } = file
  const names = new Map(groups.map((g) => [g.cluster, groupName(g)]))
  const shown = groups.find((g) => g.cluster === group) ?? null
  const total = groups.reduce((s, g) => s + g.size, 0)
  const emb = run.pipeline.embedding ?? {}
  const facts: [string, string][] = [
    [
      l('Status', 'Status'),
      statusName(file.status, file.published_on_site_page),
    ],
    [l('Corpus', 'Korpus'), run.corpus],
    [l('Sample', 'Urval'), describe(run.sample)],
    [l('Dataset version', 'Datasetversion'), run.dataset_version],
    [
      l('Embedding', 'Inbäddning'),
      `${emb.model ?? '–'} @ ${emb.revision ?? l('no revision', 'ingen revision')}`,
    ],
    [l('Text', 'Text'), describe(run.pipeline.text)],
    [
      l('Representation', 'Representation'),
      describe(run.pipeline.representation),
    ],
    [l('Reduction', 'Reduktion'), describe(run.pipeline.reduction)],
    [l('Clustering', 'Klustring'), describe(run.pipeline.clustering)],
    [l('Seeds', 'Frön'), run.seeds.join(', ')],
    [l('Role', 'Roll'), run.role],
    [l('Run id', 'Körnings-id'), file.run_id],
    [l('Run on', 'Körd'), day(run.created_at)],
    ...(Object.keys(run.resources).length
      ? [
          [l('Resources', 'Resurser'), describe(run.resources)] as [
            string,
            string,
          ],
        ]
      : []),
  ]
  return (
    <article className="cx-run" aria-labelledby={`cx-run-${file.run_id}`}>
      <h3 id={`cx-run-${file.run_id}`}>
        {run.label ?? file.run_id}{' '}
        <span className={`cx-status cx-status-${file.status}`}>
          {statusName(file.status, file.published_on_site_page)}
        </span>
      </h3>
      <p className="cx-question">{run.question}</p>
      <dl className="cx-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <figure className="cx-figure">
        <ClusterScatter
          key={file.run_id}
          points={points}
          name={(c) =>
            names.get(c) ?? l('No clear theme', 'Inget tydligt tema')
          }
          label={`${run.label ?? file.run_id}: ${run.question}`}
          height={560}
          picked={shown ? shown.cluster : null}
          onPick={onGroup}
        />
        <figcaption>
          {file.map.method}. {file.map.note}{' '}
          {l(
            `The map shows ${num(points.length)} of the run's points; grey points belong to no group.`,
            `Kartan visar ${num(points.length)} av körningens punkter; grå punkter hör inte till någon grupp.`,
          )}
        </figcaption>
      </figure>
      <div
        className="cx-table-wrap"
        tabIndex={0}
        role="region"
        aria-labelledby={`cx-groups-${file.run_id}`}
      >
        <table className="cx-table">
          <caption id={`cx-groups-${file.run_id}`}>
            {l(
              `Groups in this run: ${groups.length}, noise ${pct(run.metrics.noise_share)}.`,
              `Grupper i körningen: ${groups.length}, brus ${pct(run.metrics.noise_share)}.`,
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Group', 'Grupp')}</th>
              <th scope="col">{l('Name or terms', 'Namn eller termer')}</th>
              <th scope="col">{l('Name status', 'Namnstatus')}</th>
              <th scope="col" className="num">
                {l('Size', 'Storlek')}
              </th>
              <th scope="col" className="num">
                {l('Share', 'Andel')}
              </th>
              <th scope="col">{l('Most common source', 'Vanligaste källa')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} aria-current={g.cluster === group || undefined}>
                <td>
                  <a
                    href={runHref(file.run_id, g.cluster)}
                    onClick={(e) => {
                      e.preventDefault()
                      onGroup(g.cluster === group ? null : g.cluster)
                    }}
                  >
                    {num(g.cluster)}
                  </a>
                </td>
                <td>{groupName(g)}</td>
                <td>{nameState(g.name_status)}</td>
                <td className="num">{num(g.size)}</td>
                <td className="num">{pct(total ? g.size / total : null)}</td>
                <td>
                  {Object.entries(g.dominant ?? {})
                    .map(([f, [v, s]]) => `${f}: ${v} (${pct(s)})`)
                    .join('; ') || '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section
        className="cx-group"
        aria-live="polite"
        aria-labelledby={`cx-group-${file.run_id}`}
      >
        <h4 id={`cx-group-${file.run_id}`}>
          {shown
            ? l(
                `Group ${shown.cluster}: ${groupName(shown)}`,
                `Grupp ${shown.cluster}: ${groupName(shown)}`,
              )
            : l('Source passages', 'Källpassager')}
        </h4>
        {shown ? (
          <>
            <p className="cx-note">
              {nameState(shown.name_status)} · {num(shown.size)}{' '}
              {l('passages', 'passager')} ·{' '}
              <a href={runHref(file.run_id, shown.cluster)}>
                {l('Link to this group', 'Länk till gruppen')}
              </a>
            </p>
            <Passages examples={shown.examples} />
          </>
        ) : (
          <p className="cx-note">
            {l(
              'Choose a group in the table or under the map to read its representative passages.',
              'Välj en grupp i tabellen eller under kartan för att läsa dess representativa passager.',
            )}
          </p>
        )}
      </section>
      <RunQuality file={file} />
    </article>
  )
}
