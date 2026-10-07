/**
 * "Trace this result": a folded line under a figure or claim that opens to show where it comes
 * from, stage by stage, read from the architecture graph (architecture/graph.json): the page,
 * the published file, the tested models, the ingestion and the official source. Each stage
 * links into Data Constellation for the full lineage. The graph loads only when opened.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchData } from '../dataSource'
import {
  tracePath,
  type Graph,
  type GraphNode,
  type NodeType,
} from '../constellation/graph'

const STAGE: Record<NodeType, [string, string]> = {
  frontend: ['On the page', 'På sidan'],
  delivery: ['Published file', 'Publicerad fil'],
  gold: ['Tested model (gold)', 'Testad modell (guld)'],
  ml: ['Model run', 'Modellkörning'],
  silver: ['Cleaned (silver)', 'Rensad (silver)'],
  bronze: ['Staged (bronze)', 'Inläst (brons)'],
  seed: ['Curated list', 'Kuraterad lista'],
  raw: ['Raw copy', 'Råkopia'],
  ingestion: ['Ingestion', 'Inläsning'],
  source: ['Official source', 'Officiell källa'],
  shared: ['Shared', 'Delad'],
}
const SHOWN = 4

let graphOnce: Promise<Graph> | null = null
const loadGraph = () =>
  (graphOnce ??= fetchData('architecture/graph.json').then((r) => {
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  }))

export function TraceResult({
  node,
  what,
}: {
  /** The graph node the result is read from, e.g. `out:ai-act/obligations.json`. */
  node: string
  /** What is being traced, in a few words. */
  what: string
}) {
  const [open, setOpen] = useState(false)
  const [graph, setGraph] = useState<Graph | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!open || graph) return
    loadGraph()
      .then(setGraph)
      .catch(() => setFailed(true))
  }, [open, graph])
  const path = graph ? tracePath(graph, node) : []
  return (
    <details
      className="trace"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>
        {l('Trace this result', 'Spåra resultatet')}: {what}
      </summary>
      {failed && (
        <p className="trace-note">
          {l(
            'The lineage could not be loaded.',
            'Härkomsten kunde inte laddas.',
          )}
        </p>
      )}
      {open && !graph && !failed && (
        <p className="trace-note" role="status">
          {l('Loading…', 'Laddar…')}
        </p>
      )}
      {path.length > 0 && (
        <>
          <ol className="trace-path">
            {path.map((stage) => (
              <li key={stage.type}>
                <span className="trace-stage">{l(...STAGE[stage.type])}</span>
                <ul>
                  {stage.nodes.slice(0, SHOWN).map((n) => (
                    <TraceNode key={n.id} n={n} />
                  ))}
                  {stage.nodes.length > SHOWN && (
                    <li className="trace-more">
                      {l(
                        `and ${stage.nodes.length - SHOWN} more`,
                        `och ${stage.nodes.length - SHOWN} till`,
                      )}
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ol>
          <a
            className="trace-full"
            href={`#data-constellation?view=lineage&node=${encodeURIComponent(node)}`}
          >
            {l(
              'The full lineage in Data Constellation',
              'Hela härkomsten i Data Constellation',
            )}
          </a>
        </>
      )}
    </details>
  )
}

function TraceNode({ n }: { n: GraphNode }) {
  return (
    <li>
      <b>{n.label}</b>
      {n.rows != null && (
        <small>
          {' '}
          · {n.rows.toLocaleString(l('en-GB', 'sv-SE'))} {l('rows', 'rader')}
        </small>
      )}
      {n.description && <span>{n.description}</span>}
      {n.url && (
        <a href={n.url} target="_blank" rel="noreferrer">
          {n.url.replace(/^https?:\/\//, '')}
        </a>
      )}
    </li>
  )
}
