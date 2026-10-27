import { useEffect, useState } from 'react'
import { objectStorageUrl } from '../dataSource'
import { l } from '../i18n'
import { num, day, size, ago, reading } from './techData'

type Fetched = {
  source_key: string
  fetched_at: string | null
  content_changed_at?: string | null
  files?: number
  bytes?: number
  fetched?: number
  changed?: number
  errors?: number
}
type Ingestion = {
  subjects: Record<
    string,
    {
      recorded_at: string
      outcome: 'success' | 'failure'
      error: string | null
      github_run: string | null
      sources: Fetched[]
    }
  >
}

export function Fetches() {
  const [status, setStatus] = useState<Ingestion | 'error' | null>(null)
  useEffect(() => {
    objectStorageUrl('status/ingestion.json')
      .then((url) => fetch(url, { cache: 'no-cache' }))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setStatus, () => setStatus('error'))
  }, [])
  if (status === null) return reading
  // The status lives in object storage; where it cannot be read the table is left out.
  if (status === 'error') return null
  const subjects = Object.entries(status.subjects).sort((a, b) =>
    b[1].recorded_at.localeCompare(a[1].recorded_at),
  )
  return (
    <div className="tech-scroll" tabIndex={0}>
      <table className="tech-table fetches">
        <thead>
          <tr>
            <th scope="col">{l('Subject', 'Ämne')}</th>
            <th scope="col">{l('Ingest', 'Inläsning')}</th>
            <th scope="col">{l('Source', 'Källa')}</th>
            <th scope="col">{l('Last fetched', 'Senast hämtad')}</th>
            <th scope="col">
              {l('Content last changed', 'Innehållet senast ändrat')}
            </th>
            <th scope="col" className="num">
              {l('Files', 'Filer')}
            </th>
            <th scope="col" className="num">
              {l('Size', 'Storlek')}
            </th>
            <th scope="col" className="num">
              {l(
                'This run: fetched, changed, failed',
                'Den här körningen: hämtade, ändrade, misslyckade',
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.flatMap(([name, s]) => {
            const sources = s.sources.length
              ? s.sources
              : [{ source_key: '–', fetched_at: null }]
            return sources.map((f, i) => (
              <tr key={`${name}-${f.source_key}`} data-state={s.outcome}>
                {i === 0 && (
                  <>
                    <th scope="row" rowSpan={sources.length}>
                      {name}
                    </th>
                    <td rowSpan={sources.length}>
                      <span className="fetches-state">{s.outcome}</span>{' '}
                      {s.github_run ? (
                        <a href={s.github_run}>{ago(s.recorded_at)}</a>
                      ) : (
                        ago(s.recorded_at)
                      )}
                      {s.error && <p className="tech-meta">{s.error}</p>}
                    </td>
                  </>
                )}
                <td>{f.source_key}</td>
                <td>{day(f.fetched_at)}</td>
                <td>{day(f.content_changed_at)}</td>
                <td className="num">{f.files == null ? '–' : num(f.files)}</td>
                <td className="num">{f.bytes == null ? '–' : size(f.bytes)}</td>
                <td className="num">
                  {f.fetched == null
                    ? '–'
                    : `${num(f.fetched)}, ${num(f.changed ?? 0)}, ${num(f.errors ?? 0)}`}
                </td>
              </tr>
            ))
          })}
        </tbody>
      </table>
    </div>
  )
}

export type WelfareRun = {
  exported_at: string
  dbt: {
    command: string
    generated_at: string
    dbt_version: string
    elapsed_seconds: number
    nodes: Record<string, number>
    tests: Record<string, number>
  }
  sources: {
    source_key: string
    fetched_at: string
    content_changed_at: string
    files: number
    bytes: number
  }[]
}

export function RunRecord({ run }: { run: WelfareRun }) {
  const t = run.dbt.tests
  return (
    <>
      <p className="tech-meta">
        {l(
          `Exported ${day(run.exported_at)} · dbt ${run.dbt.command} ${run.dbt.dbt_version}, ${run.dbt.elapsed_seconds} s · the subject's ${num(run.dbt.nodes.model ?? 0)} models and ${num(run.dbt.nodes.seed ?? 0)} seeds · tests: ${t.pass} passed, ${t.fail} failed, ${t.error} errors, ${t.warn} warnings`,
          `Exporterad ${day(run.exported_at)} · dbt ${run.dbt.command} ${run.dbt.dbt_version}, ${run.dbt.elapsed_seconds} s · ämnets ${num(run.dbt.nodes.model ?? 0)} modeller och ${num(run.dbt.nodes.seed ?? 0)} seeds · tester: ${t.pass} godkända, ${t.fail} underkända, ${t.error} fel, ${t.warn} varningar`,
        )}
      </p>
      <div className="tech-scroll" tabIndex={0}>
        <table className="tech-table">
          <thead>
            <tr>
              <th scope="col">{l('Source', 'Källa')}</th>
              <th scope="col">{l('Fetched', 'Hämtad')}</th>
              <th scope="col">
                {l('Content last changed', 'Innehållet senast ändrat')}
              </th>
              <th scope="col" className="num">
                {l('Files', 'Filer')}
              </th>
              <th scope="col" className="num">
                {l('Size', 'Storlek')}
              </th>
            </tr>
          </thead>
          <tbody>
            {run.sources.map((s) => (
              <tr key={s.source_key}>
                <th scope="row">{s.source_key}</th>
                <td>{day(s.fetched_at)}</td>
                <td>{day(s.content_changed_at)}</td>
                <td className="num">{num(s.files)}</td>
                <td className="num">{size(s.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
