/**
 * The top of the projects hub: what the platform holds and how its runs are going, in four
 * small groups. Each group names the file or service its figures come from and when that was
 * written; a group whose file cannot be read is left out, never filled in.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { loadStatus, type Entry } from '../meaning/freshness'
import { StatusStrip } from '../tech/PlatformSections'
import type { Graph } from '../tech/PipelineTables'
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

function Group(props: {
  title: string
  source: string
  children: React.ReactNode
}) {
  return (
    <div className="hub-kpis">
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

export default function Dashboard() {
  const graph = useFile<Graph & { generated_at: string }>(
    'architecture/graph.json',
  )
  const quality = useFile<Quality>('quality/summary.json')
  const ci = useCi()
  const [status, setStatus] = useState<Record<string, Entry> | null>(null)
  useEffect(() => {
    loadStatus().then(setStatus)
  }, [])
  const updated = Object.values(status ?? {})
    .map((e) => e.recorded_at ?? '')
    .sort()
    .at(-1)
  // By node type, as the per-subject counts in graph.json are (platform/architecture/build_graph.py).
  const typed = (...types: string[]) =>
    ok(graph) ? graph.nodes.filter((n) => types.includes(n.type)).length : 0
  const passing = ci?.filter((r) => r.conclusion === 'success').length ?? 0
  const checks = ok(quality) ? quality.run.check_statuses : {}
  const applicable = ok(quality)
    ? quality.run.checks - (checks.not_applicable ?? 0)
    : 0
  const age = (iso: string) => `${day(iso)} UTC (${ago(iso)})`
  return (
    <section id="projects-overview" aria-labelledby="projects-overview-title">
      <h2 id="projects-overview-title">
        {l('Latest figures', 'Senaste siffrorna')}
      </h2>
      <div className="hub-dashboard">
        {updated && (
          <Group
            title={l('Scheduled runs', 'Schemalagda körningar')}
            source={`status/ingestion.json · ${l('updated', 'uppdaterad')} ${age(updated)}`}
          >
            <StatusStrip />
          </Group>
        )}
        {ok(graph) && (
          <Group
            title={l('What it is built from', 'Vad den byggs av')}
            source={`architecture/graph.json · ${l('built', 'byggd')} ${age(graph.generated_at)}`}
          >
            <dl className="tech-figures">
              <Figure
                label={l('Public sources', 'Offentliga källor')}
                value={num(typed('source'))}
                note={l('fetched on a schedule', 'hämtas på schema')}
              />
              <Figure
                label={l('dbt models', 'dbt-modeller')}
                value={num(typed('bronze', 'silver', 'gold'))}
                note={l(
                  'bronze, silver and gold, in the lineage graph',
                  'bronze, silver och gold, i härkomstgrafen',
                )}
              />
              <Figure
                label={l('ML stages', 'ML-steg')}
                value={num(typed('ml'))}
                note={l('where the data is text', 'där datan är text')}
              />
            </dl>
          </Group>
        )}
        {ok(quality) && (
          <Group
            title={l('Quality checks', 'Kvalitetskontroller')}
            source={`quality/summary.json · ${l('evaluated', 'utvärderad')} ${age(quality.run.evaluated_at)}`}
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
        )}
        {ci && ci.length > 0 && (
          <Group
            title={l('CI on main', 'CI på main')}
            source={l('GitHub Actions, ci.yml', 'GitHub Actions, ci.yml')}
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
        )}
      </div>
    </section>
  )
}
