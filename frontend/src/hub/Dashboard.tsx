/**
 * The top of the projects hub: how the runs are going and what the platform holds, in four
 * small groups. Each group names the file or service its figures come from and when that was
 * written; a group whose file cannot be read is left out, never filled in. A file older than a
 * week stays, but quieter and last, so an old figure never stands beside a live one as an equal.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { loadStatus, type Entry } from '../meaning/freshness'
import { StatusStrip } from '../tech/PlatformSections'
import { deliveryState } from '../dataSource'
import { ago, day, num, ok, useFile } from '../tech/techData'
import { loadWorkflows, type Run } from '../tech/WorkflowRuns'

type Quality = {
  run: {
    evaluated_at: string
    checks: number
    check_statuses: Record<string, number>
  }
}

/** The finished CI runs on main among the latest the API returns, newest first. */
function useCi() {
  const [runs, setRuns] = useState<Run[]>()
  useEffect(() => {
    loadWorkflows().then(
      (workflows) =>
        setRuns(
          workflows
            .find((w) => w.path.endsWith('/ci.yml'))
            ?.runs.filter(
              (r) => r.head_branch === 'main' && r.status === 'completed',
            ),
        ),
      () => undefined,
    )
  }, [])
  return runs
}

const WEEK = 7 * 864e5
const isOld = (at?: string) => (at ? Date.now() - Date.parse(at) > WEEK : false)

/** The platform's counts, from the schema export (platform/publish/export_schema.py). */
type Summary = {
  models: number
  tests: number
  sources: number
  rows: number
  generated_at?: string
}

function Group(props: {
  title: string
  source: string
  /** When the file was written; a week or older makes the group quiet. */
  at?: string
  children: React.ReactNode
}) {
  return (
    <div className="hub-kpis" data-stale={isOld(props.at) || undefined}>
      <h3>{props.title}</h3>
      {props.children}
      <p className="tech-meta">{props.source}</p>
    </div>
  )
}

function Figure(props: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
      <dd className="tech-meta">{props.note}</dd>
    </div>
  )
}

const age = (iso: string) => `${day(iso)} UTC (${ago(iso)})`

export default function Dashboard() {
  const summary = useFile<Summary>('schema/summary.json')
  const quality = useFile<Quality>('quality/summary.json')
  const ci = useCi()
  const [status, setStatus] = useState<Record<string, Entry> | null>(null)
  const [release, setRelease] = useState<string>()
  useEffect(() => {
    loadStatus().then(setStatus)
    deliveryState().then(
      (d) => setRelease(d.activatedAt ?? undefined),
      () => undefined,
    )
  }, [])
  const updated = Object.values(status ?? {})
    .map((e) => e.recorded_at ?? '')
    .sort()
    .at(-1)
  // Until the export writes generated_at, the release the file came in dates it.
  const built = ok(summary) ? (summary.generated_at ?? release) : undefined
  const passing = ci?.filter((r) => r.conclusion === 'success').length ?? 0
  const checks = ok(quality) ? quality.run.check_statuses : {}
  const applicable = ok(quality)
    ? quality.run.checks - (checks.not_applicable ?? 0)
    : 0
  const groups = [
    updated && (
      <Group
        key="runs"
        title={l('Scheduled runs', 'Schemalagda körningar')}
        source={`status/ingestion.json · ${l('updated', 'uppdaterad')} ${age(updated)}`}
        at={updated}
      >
        <StatusStrip />
      </Group>
    ),
    ok(summary) && (
      <Group
        key="dbt"
        title={l('The dbt project', 'dbt-projektet')}
        source={`schema/summary.json${
          !built
            ? ''
            : summary.generated_at
              ? ` · ${l('built', 'byggd')} ${age(built)}`
              : ` · ${l('in the release published', 'i releasen publicerad')} ${age(built)}`
        }`}
        at={built}
      >
        <dl className="tech-figures">
          <Figure
            label={l('dbt models', 'dbt-modeller')}
            value={num(summary.models)}
            note={l('tables and views built', 'byggda tabeller och vyer')}
          />
          <Figure
            label={l('dbt tests', 'dbt-tester')}
            value={num(summary.tests)}
            note={l('defined in the project', 'definierade i projektet')}
          />
          <Figure
            label={l('Source tables', 'Källtabeller')}
            value={num(summary.sources)}
            note={l('declared dbt sources', 'deklarerade dbt-källor')}
          />
          <Figure
            label={l('Rows', 'Rader')}
            value={num(summary.rows)}
            note={l('in the warehouse tables', 'i lagrets tabeller')}
          />
        </dl>
      </Group>
    ),
    ci && ci.length > 0 && (
      <Group
        key="ci"
        title={l('CI on main', 'CI på main')}
        source={l('GitHub Actions, ci.yml', 'GitHub Actions, ci.yml')}
        at={ci[0].updated_at}
      >
        <dl className="tech-figures">
          <Figure
            label={l('Latest run', 'Senaste körningen')}
            value={
              ci[0].conclusion === 'success'
                ? l('Passed', 'Gick igenom')
                : l('Failed', 'Föll')
            }
            note={ago(ci[0].updated_at)}
          />
          <Figure
            label={l('Recent runs passing', 'Senaste körningar gröna')}
            value={`${num(passing)}/${num(ci.length)}`}
            note={l(
              `of the last ${ci.length} finished runs on main, since ${day(ci.at(-1)!.updated_at)} UTC`,
              `av de ${ci.length} senaste färdiga körningarna på main, sedan ${day(ci.at(-1)!.updated_at)} UTC`,
            )}
          />
        </dl>
      </Group>
    ),
    ok(quality) && (
      <Group
        key="quality"
        title={l('Quality checks', 'Kvalitetskontroller')}
        source={`quality/summary.json · ${l('evaluated', 'utvärderad')} ${age(quality.run.evaluated_at)}`}
        at={quality.run.evaluated_at}
      >
        <dl className="tech-figures">
          <Figure
            label={l('Checks passed', 'Godkända kontroller')}
            value={`${num(checks.pass ?? 0)}/${num(applicable)}`}
            note={l(
              `of the applicable checks; ${num(checks.fail ?? 0)} failed, ${num(checks.not_measured ?? 0)} not measured, ${num(checks.not_applicable ?? 0)} not applicable`,
              `av de tillämpliga; ${num(checks.fail ?? 0)} föll, ${num(checks.not_measured ?? 0)} ej mätta, ${num(checks.not_applicable ?? 0)} ej tillämpliga`,
            )}
          />
        </dl>
      </Group>
    ),
  ].filter(Boolean) as React.ReactElement<{ at?: string }>[]
  // A week-old file goes last, after the live groups.
  const stale = (g: React.ReactElement<{ at?: string }>) => isOld(g.props.at)
  return (
    <section id="projects-overview" aria-labelledby="projects-overview-title">
      <h2 id="projects-overview-title">
        {l('Latest figures', 'Senaste siffrorna')}
      </h2>
      <div className="hub-dashboard">
        {[...groups.filter((g) => !stale(g)), ...groups.filter(stale)]}
      </div>
    </section>
  )
}
