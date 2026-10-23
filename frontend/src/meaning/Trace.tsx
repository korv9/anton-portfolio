/**
 * Where an opened chart's numbers come from: its files, the publisher and the models and tables
 * behind them, their tests, the last ingestion and the last run. Lineage is read from
 * architecture/feed-provenance.json (platform/architecture/feed_provenance.py) when the panel
 * opens; freshness and the run come from the live status the card already holds. Anything not
 * recorded is said to be so, or left out, never filled in.
 */
import { useId, type ReactNode } from 'react'
import { useData, type Post } from './kit'
import type { useFresh } from './freshness'

type Delivery = {
  published_by: string[]
  models: { name: string; layer: string; tests: number }[]
  test_kinds: string[]
  raw: string[]
  origins: { label: string; url?: string | null }[]
  checks: { id: string; status: string; evaluated_at?: string | null }[]
}
type Provenance = {
  paths: Record<string, string | null>
  deliveries: Record<string, Delivery>
}

const PROVENANCE = 'architecture/feed-provenance.json'
/** GitHub's billing rule for Actions: standard hosted runners cost nothing on a public repository,
 * and every workflow here runs on ubuntu-latest. */
const ACTIONS_BILLING =
  'https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions'
/** Model names shown before the rest are counted. */
const SHOWN = 3

const file = (p: string) => p.split('/').pop()
const duration = (s: number) =>
  s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
const listed = (names: string[]) =>
  names.length > SHOWN
    ? `${names.slice(0, SHOWN).join(', ')} and ${names.length - SHOWN} more`
    : names.join(', ')

/** Model names grouped by layer, e.g. "3 gold: a, b, c; 1 raw: d". Raw and ingestion tables
 * are not dbt models, so each layer is counted on its own. */
function byLayer(models: Delivery['models']) {
  const layers = new Map<string, string[]>()
  for (const m of models)
    layers.set(m.layer, [...(layers.get(m.layer) ?? []), m.name])
  return [...layers].map(([layer, names]) => (
    <span key={layer}>
      {names.length} {layer}: <code>{listed(names)}</code>
    </span>
  ))
}

function Lineage({ d }: { d: Delivery }) {
  const tests = d.models.reduce((n, m) => n + m.tests, 0)
  // A check that does not apply to this data says nothing about it, so it is not counted.
  const evaluated = d.checks.filter((c) => c.status !== 'not_applicable')
  const passed = evaluated.filter((c) => c.status === 'pass').length
  const at = evaluated
    .map((c) => c.evaluated_at ?? '')
    .sort()
    .pop()
    ?.slice(0, 10)
  return (
    <>
      {d.origins.length > 0 && (
        <>
          <dt>Origin</dt>
          <dd>{d.origins.map((o) => o.label).join(', ')}</dd>
        </>
      )}
      {d.models.length > 0 && (
        <>
          <dt>Models</dt>
          <dd className="mean-trace-layers">{byLayer(d.models)}</dd>
          <dt>Tests</dt>
          <dd>
            {tests
              ? `${tests} dbt tests (${d.test_kinds.join(', ')})`
              : 'none recorded'}
            {evaluated.length > 0 &&
              `; ${passed} of ${evaluated.length} quality checks passed${at ? ` on ${at}` : ' at the last build'}`}
          </dd>
        </>
      )}
      <dt>Published by</dt>
      <dd>
        <code>{d.published_by.map(file).join(', ')}</code>
      </dd>
    </>
  )
}

/** One dt/dd pair in its own group, so the list stays valid markup. */
const Row = ({ term, children }: { term: string; children: ReactNode }) => (
  <div className="mean-trace-group">
    <dt>{term}</dt>
    <dd>{children}</dd>
  </div>
)

/** The lineage of each delivery the post's files belong to, grouped by delivery. Loading and a
 * failed fetch get a row of their own: Frame's markup is not valid inside a dl. */
function Lineages({ sources }: { sources: readonly string[] }) {
  const prov = useData<Provenance>(PROVENANCE)
  if (prov === null) return <Row term="Lineage">Loading</Row>
  if (prov instanceof Error)
    return <Row term="Lineage">Not available: {prov.message}</Row>
  const groups = new Map<string, string[]>()
  const none: string[] = []
  for (const p of sources) {
    const k = prov.paths[p] ?? null
    if (k && prov.deliveries[k]) groups.set(k, [...(groups.get(k) ?? []), p])
    else none.push(p)
  }
  return (
    <>
      {[...groups].map(([k, files]) => (
        <div key={k} className="mean-trace-group">
          {groups.size > 1 && (
            <>
              <dt>For</dt>
              <dd>
                <code>{files.map(file).join(', ')}</code>
              </dd>
            </>
          )}
          <Lineage d={prov.deliveries[k]} />
        </div>
      ))}
      {none.length > 0 && (
        <Row term="Lineage">
          Lineage not recorded
          {groups.size > 0 && (
            <>
              {' '}
              for <code>{none.map(file).join(', ')}</code>
            </>
          )}
        </Row>
      )}
    </>
  )
}

type Fresh = ReturnType<typeof useFresh>

/**
 * The "Source" toggle of an opened card and the panel it turns over the chart. The card holds
 * `shown`, so it can make the chart beneath inert while the panel covers it. The ingest and cost
 * rows show only what is recorded: the subject's ingest time and its Actions run (a GitHub URL),
 * free under GitHub's billing rule, with no money figure. Workers AI
 * neurons and R2 storage are not recorded per chart (every feed file is served as JSON from the
 * site, and the neuron ledger stays local), so they are left out.
 */
export function Trace({
  post,
  fresh,
  shown,
  toggle,
}: {
  post: Post
  fresh: Fresh
  shown: boolean
  toggle: () => void
}) {
  const id = useId()
  const state = fresh && (fresh.fresh ? 'on time' : 'overdue')
  return (
    <>
      <button
        type="button"
        className="mean-trace-toggle"
        aria-expanded={shown}
        aria-controls={shown ? id : undefined}
        onClick={toggle}
      >
        Source
      </button>
      {shown && (
        <section
          id={id}
          className="mean-trace"
          aria-label="Where this comes from"
        >
          <dl>
            <Row term="Data">
              {post.sources.map((p) => (
                <code key={p}>{p}</code>
              ))}
            </Row>
            <Lineages sources={post.sources} />
            {fresh && (
              <Row term="Ingested">
                {fresh.at
                  ? `${fresh.at.slice(0, 10)}, ${state}`
                  : `${state}; the time of the last success is not recorded`}
              </Row>
            )}
            {fresh?.run?.url?.startsWith('https://github.com/') && (
              <>
                <Row term="Ingest">
                  Ingest took {duration(fresh.run.seconds)} (
                  <a href={fresh.run.url}>workflow run log</a>)
                </Row>
                <Row term="Cost">
                  <a href={ACTIONS_BILLING}>
                    Free: public repository, standard runner
                  </a>
                </Row>
              </>
            )}
          </dl>
        </section>
      )}
    </>
  )
}
