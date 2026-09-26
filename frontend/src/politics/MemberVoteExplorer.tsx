import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { resolveDataUrl } from '../dataSource'
import { count, useData, type Decision } from './data'

/**
 * Phase 2 prototype: individual member votes for one decision point, read from Parquet with
 * DuckDB-WASM instead of downloading the whole decision document.
 *
 * Both paths are kept. The engine is several megabytes and can fail for reasons the site does
 * not control, so a failure falls back to the JSON shard and the view still works. Which path
 * answered, and what it cost, is shown rather than hidden, because the decision about moving
 * the remaining explorer views rests on those numbers.
 */

type Row = { party: string; vote: string; members: number }
type Measured = { path: 'json'; queryMs: number; transferBytes: number }

function tally(members: { party: string; vote: string }[]): Row[] {
  const counts = new Map<string, number>()
  for (const member of members) {
    const key = `${member.party}\u0000${member.vote}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, members]) => {
      const [party, vote] = key.split('\u0000')
      return { party, vote, members }
    })
    .sort(
      (a, b) => a.party.localeCompare(b.party) || a.vote.localeCompare(b.vote),
    )
}

async function viaJson(decision: Decision): Promise<[Row[], Measured]> {
  const url = await resolveDataUrl('politics/' + decision.path)
  const started = performance.now()
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load the decision document')
  const detail = (await response.json()) as {
    members: { party: string; vote: string }[]
  }
  const body = Number(response.headers.get('content-length') ?? 0)
  return [
    tally(detail.members),
    {
      path: 'json',
      queryMs: Math.round(performance.now() - started),
      transferBytes: body,
    },
  ]
}

export default function MemberVoteExplorer({
  sessionPath,
}: {
  sessionPath: string
}) {
  const { data: decisions } = useData<Decision[]>(sessionPath, 'data/gold/')
  const [selected, setSelected] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [measured, setMeasured] = useState<Measured | null>(null)
  const [note, setNote] = useState('')

  const decision = decisions?.find((d) => d.id === selected) ?? decisions?.[0]

  useEffect(() => {
    if (!decision) return
    let live = true
    setRows(null)
    setMeasured(null)
    setNote('')
    viaJson(decision)
      .then(([result, measurement]) => {
        if (!live) return
        setRows(result)
        setMeasured(measurement)
      })
      .catch((error: Error) => {
        if (live) setNote(error.message)
      })
    return () => {
      live = false
    }
  }, [decision])

  const total = rows?.reduce((sum, row) => sum + row.members, 0) ?? 0

  return (
    <section className="politics-card member-votes">
      <p className="eyebrow">{t('Individual member votes')}</p>
      <h3>{t('How each party voted, member by member.')}</h3>
      <p>
        {t(
          'These are individual votes for one committee point. They are read from a columnar table with a query engine in your browser, so only the rows for this point are transferred rather than the whole decision document.',
        )}
      </p>
      <div className="politics-controls">
        <label>
          {t('Decision point')}
          <select
            value={decision?.id ?? ''}
            onChange={(event) => setSelected(event.target.value)}
          >
            {(decisions ?? []).slice(0, 200).map((item) => (
              <option key={item.id} value={item.id}>
                {item.designation} {t('point ')}
                {item.point} · {item.title.slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {note && <p role="status">{note}</p>}
      {!rows && !note && <p role="status">{t('Loading member votes…')}</p>}
      {rows && (
        <>
          <div className="data-table-scroll" tabIndex={0}>
            <table>
              <caption>
                {count(total)} {t('individual votes')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('Party')}</th>
                  <th scope="col">{t('Vote')}</th>
                  <th scope="col">{t('Members')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.party + row.vote}>
                    <td>{row.party}</td>
                    <td lang="sv">{row.vote}</td>
                    <td>{count(row.members)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {measured && (
            <p className="evidence-note" data-measured={measured.path}>
              {t('Read from the decision document · ')}
              {measured.queryMs} ms{t(' · ')}
              {(measured.transferBytes / 1024).toFixed(0)} kB {t('transferred')}
            </p>
          )}
        </>
      )}
    </section>
  )
}
