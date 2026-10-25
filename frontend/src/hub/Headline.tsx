/**
 * The hub's headline: four figures on one line, the size of the dbt project and the newest run,
 * with the files they come from under them. The full picture is the flow further down
 * (PlatformFlow.tsx). A figure whose file cannot be read is left out.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { loadStatus } from '../meaning/freshness'
import { ago, day, num, ok, useFile } from '../tech/techData'
import { readStatus, type Status } from './platformStatus'

/** The dbt project's size, from the schema export (platform/publish/export_schema.py). */
export type Summary = {
  models: number
  tests: number
  sources: number
  rows: number
  generated_at?: string
}

export function useStatus() {
  const [status, setStatus] = useState<ReturnType<typeof readStatus>>(null)
  useEffect(() => {
    loadStatus().then((s) => setStatus(s && readStatus(s as Status)))
  }, [])
  return status
}

export default function Headline() {
  const summary = useFile<Summary>('schema/summary.json')
  const status = useStatus()
  const figures: [string, string][] = []
  if (ok(summary))
    figures.push(
      [l('dbt models', 'dbt-modeller'), num(summary.models)],
      [l('dbt tests', 'dbt-tester'), num(summary.tests)],
      [l('Source tables', 'Källtabeller'), num(summary.sources)],
    )
  if (status)
    figures.push([
      l('Last run', 'Senaste körning'),
      ago(status.last.recorded_at!),
    ])
  if (!figures.length) return null
  const files = [
    ok(summary) &&
      `schema/summary.json${summary.generated_at ? ` · ${day(summary.generated_at)} UTC` : ''}`,
    status && `status/ingestion.json · ${day(status.last.recorded_at)} UTC`,
  ].filter(Boolean)
  return (
    <section
      id="projects-overview"
      className="hub-headline"
      aria-label={l('The platform in figures', 'Plattformen i siffror')}
    >
      <dl>
        {figures.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="tech-meta">{files.join(' · ')}</p>
    </section>
  )
}
