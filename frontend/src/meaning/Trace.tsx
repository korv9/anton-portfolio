/**
 * Where an opened chart's numbers come from: its files, the publisher and dbt models behind
 * them, their tests, the last ingestion and the last run. Lineage is read from
 * architecture/feed-provenance.json (platform/architecture/feed_provenance.py) when the panel
 * opens; freshness and the run come from the live status the card already holds. Anything not
 * recorded is said to be so, or left out, never filled in.
 */
import { useId } from 'react'
import { Frame, useData, type Post } from './kit'
import type { useFresh } from './freshness'

type Delivery = {
  published_by: string[]
  models: { name: string; layer: string; tests: number }[]
  test_kinds: string[]
  raw: string[]
  origins: { label: string; url?: string | null }[]
  checks: { id: string; status: string }[]
}
type Provenance = {
  paths: Record<string, string | null>
  deliveries: Record<string, Delivery>
}

const PROVENANCE = 'architecture/feed-provenance.json'
/** Model names shown before the rest are counted. */
const SHOWN = 3

const file = (p: string) => p.split('/').pop()
const duration = (s: number) =>
  s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
const listed = (names: string[]) =>
  names.length > SHOWN
    ? `${names.slice(0, SHOWN).join(', ')} and ${names.length - SHOWN} more`
    : names.join(', ')

function Lineage({ d }: { d: Delivery }) {
  const tests = d.models.reduce((n, m) => n + m.tests, 0)
  const passed = d.checks.filter((c) => c.status === 'pass').length
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
          <dd>
            {d.models.length} dbt {d.models.length === 1 ? 'model' : 'models'}:{' '}
            <code>{listed(d.models.map((m) => m.name))}</code>
          </dd>
          <dt>Tests</dt>
          <dd>
            {tests
              ? `${tests} dbt tests (${d.test_kinds.join(', ')})`
              : 'none recorded'}
            {d.checks.length > 0 &&
              `; ${passed} of ${d.checks.length} quality checks passed at the last build`}
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

/** The lineage of each delivery the post's files belong to, grouped by delivery. */
function Lineages({ sources }: { sources: readonly string[] }) {
  return (
    <Frame data={useData<Provenance>(PROVENANCE)}>
      {(prov) => {
        const groups = new Map<string, string[]>()
        const none: string[] = []
        for (const p of sources) {
          const k = prov.paths[p] ?? null
          if (k && prov.deliveries[k])
            groups.set(k, [...(groups.get(k) ?? []), p])
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
              <div className="mean-trace-group">
                <dt>Lineage</dt>
                <dd>
                  Lineage not recorded
                  {groups.size > 0 && (
                    <>
                      {' '}
                      for <code>{none.map(file).join(', ')}</code>
                    </>
                  )}
                </dd>
              </div>
            )}
          </>
        )
      }}
    </Frame>
  )
}

type Fresh = ReturnType<typeof useFresh>

/**
 * The "Source" toggle of an opened card and the panel it turns over the chart. The card holds
 * `shown`, so it can make the chart beneath inert while the panel covers it.
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
  return (
    <>
      <button
        type="button"
        className="mean-trace-toggle"
        aria-expanded={shown}
        aria-controls={id}
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
            <div className="mean-trace-group">
              <dt>Data</dt>
              <dd>
                {post.sources.map((p) => (
                  <code key={p}>{p}</code>
                ))}
              </dd>
            </div>
            <Lineages sources={post.sources} />
            {fresh?.at && (
              <div className="mean-trace-group">
                <dt>Ingested</dt>
                <dd>
                  {fresh.at.slice(0, 10)}, {fresh.fresh ? 'on time' : 'overdue'}
                </dd>
              </div>
            )}
            {fresh?.run?.url && (
              <div className="mean-trace-group">
                <dt>Last run</dt>
                <dd>
                  Took {duration(fresh.run.seconds)} on GitHub Actions (
                  <a href={fresh.run.url}>log</a>)
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </>
  )
}
