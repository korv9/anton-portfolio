/**
 * The hub's headline: four figures on one line, the size of the dbt project and the newest run,
 * with the files they come from and their dates under them. The full picture is the flow further
 * down (PlatformFlow.tsx). A figure whose file cannot be read, or that has no date, is left out.
 */
import { useEffect, useState } from 'react'
import { deliveryState } from '../dataSource'
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

/** The time the active R2 release was published, once the delivery manifest is read. */
export function useRelease() {
  const [release, setRelease] = useState<string>()
  useEffect(() => {
    deliveryState().then(
      (d) => setRelease(d.activatedAt ?? undefined),
      () => undefined,
    )
  }, [])
  return release
}

/**
 * The dbt project's size with its date: the file's own generated_at, or the release it came in.
 * Without either the figures are left out, as an undated count is.
 */
export function useDbtSize() {
  const summary = useFile<Summary>('schema/summary.json')
  const release = useRelease()
  const at = ok(summary) ? (summary.generated_at ?? release) : undefined
  return ok(summary) && at ? { size: summary, at, release } : { release }
}

export default function Headline() {
  const { size, at } = useDbtSize()
  const status = useStatus()
  const figures: [string, string][] = []
  if (size)
    figures.push(
      [l('dbt models', 'dbt-modeller'), num(size.models)],
      [l('dbt tests', 'dbt-tester'), num(size.tests)],
      [l('dbt source tables', 'dbt-källtabeller'), num(size.sources)],
    )
  if (status)
    figures.push([
      l('Last ingestion run', 'Senaste inläsning'),
      ago(status.last.recorded_at!),
    ])
  if (!figures.length) return null
  const files = [
    size &&
      at &&
      `schema/summary.json · ${size.generated_at ? l('built', 'byggd') : l('in the release of', 'i releasen från')} ${day(at)} UTC`,
    status && `status/ingestion.json · ${day(status.last.recorded_at)} UTC`,
  ].filter(Boolean)
  return (
    <section
      id="projects-overview"
      className="hub-headline"
      aria-label={l('The platform in figures', 'Plattformen i siffror')}
    >
      <dl>
        {figures.map(([label, value], i) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd
              data-kind={
                status && i === figures.length - 1 ? 'time' : undefined
              }
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="tech-meta">{files.join(' · ')}</p>
    </section>
  )
}
