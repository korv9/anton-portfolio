/**
 * The platform's path, step by step: one row per layer of architecture/graph.json, each with its
 * node count and what happens there; its name opens every node of the layer, and the quality gate between gold
 * and delivery with every check of quality/summary.json as one mark. Rows light up in order as
 * they scroll into view, the spine fills, counts run up and the gate's marks drop in by turn;
 * then it stands still. Reduced motion: every row lit, every count final.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { l } from '../i18n'
import { ok, useJson } from '../useJson'
import type { Quality, Summary } from './overviewTypes'
import NodeSample from './NodeSample'

type Node = {
  id: string
  label: string
  layer: string
  rows?: number
  description?: string
}
type Graph = { nodes: Node[]; layers: string[] }
type Bi = { en: string; sv: string }
const t = (en: string, sv: string): Bi => ({ en, sv })

/** What happens on each layer, keyed by the graph's layer id; a new layer shows by its id. */
const STEPS: Record<string, { name: Bi; unit: Bi; text: Bi }> = {
  source: {
    name: t('Public sources', 'Öppna källor'),
    unit: t('publishers', 'utgivare'),
    text: t(
      'REST APIs, PX-Web tables, XML archives, PDFs and RSS feeds, each on its own schedule.',
      'REST-API:er, PX-Web-tabeller, XML-arkiv, PDF:er och RSS-flöden, var och en i sin egen takt.',
    ),
  },
  ingestion: {
    name: t('Ingestion', 'Inläsning'),
    unit: t('Python packages', 'Python-paket'),
    text: t(
      'One package per source, run from one registry on a laptop and in GitHub Actions.',
      'Ett paket per källa, körda från ett register på en laptop och i GitHub Actions.',
    ),
  },
  raw: {
    name: t('Raw', 'Rådata'),
    unit: t('raw datasets', 'rådataset'),
    text: t(
      'Every fetch is kept unedited, with its URL, fetch time and SHA-256.',
      'Varje hämtning sparas oredigerad, med URL, hämtningstid och SHA-256.',
    ),
  },
  bronze: {
    name: t('dbt bronze', 'dbt bronze'),
    unit: t('models', 'modeller'),
    text: t('Types the raw records.', 'Typar råposterna.'),
  },
  silver: {
    name: t('dbt silver', 'dbt silver'),
    unit: t('models', 'modeller'),
    text: t(
      'Conforms them to the same dates, municipalities and parties.',
      'Harmoniserar dem till samma datum, kommuner och partier.',
    ),
  },
  ml: {
    name: t('Machine learning', 'Maskininlärning'),
    unit: t('runs and tables', 'körningar och tabeller'),
    text: t(
      'Embeddings, clusterings and similarity runs, read back into dbt as tables.',
      'Inbäddningar, klustringar och likhetskörningar, inlästa i dbt igen som tabeller.',
    ),
  },
  gold: {
    name: t('dbt gold', 'dbt gold'),
    unit: t('models', 'modeller'),
    text: t(
      'Shared dimensions and the marts the site reads.',
      'Delade dimensioner och de marts som sajten läser.',
    ),
  },
  delivery: {
    name: t('Delivery', 'Leverans'),
    unit: t('file groups', 'filgrupper'),
    text: t(
      'JSON for first paint ships with the site; Parquet and document shards go to Cloudflare R2 as a versioned release, read back and compared before it goes live.',
      'JSON för första renderingen följer med sajten; Parquet och dokumentskärvor går till Cloudflare R2 som en versionerad release, läses tillbaka och jämförs innan den går live.',
    ),
  },
  frontend: {
    name: t('The site', 'Sajten'),
    unit: t('products', 'produkter'),
    text: t(
      'A Cloudflare Worker serves the pages and two Workers AI endpoints.',
      'En Cloudflare Worker serverar sidorna och två Workers AI-ändpunkter.',
    ),
  },
}

/** Runs a count from 0 to `to` once `on` turns true; the final value at once under reduced motion. */
function Count({ to, on }: { to: number; on: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!on) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(to)
    const start = performance.now()
    let raf = 0
    const step = () => {
      const f = Math.min(1, (performance.now() - start) / 900)
      setN(Math.round(to * (1 - (1 - f) ** 3)))
      if (f < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [on, to])
  return <>{n.toLocaleString(l('en-GB', 'sv-SE'))}</>
}

/** One row of the path; `is-in` is set once it has been in view. Its name opens the full list. */
function Step(props: {
  index: number
  count: number
  nodes: Node[]
  step: (typeof STEPS)[string]
  children?: React.ReactNode
  focal?: boolean
}) {
  const ref = useRef<HTMLLIElement>(null)
  const [seen, setSeen] = useState(false)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const panel = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setSeen(true)
        io.disconnect()
      },
      { rootMargin: '0px 0px -20% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const tr = (b: Bi) => l(b.en, b.sv)
  return (
    <li
      ref={ref}
      className={`hub-path-step${seen ? ' is-in' : ''}${props.focal ? ' is-focal' : ''}${open ? ' is-open' : ''}`}
    >
      <span className="hub-path-index" aria-hidden="true">
        {String(props.index).padStart(2, '0')}
      </span>
      <div className="hub-path-count">
        <strong>
          <Count to={props.count} on={seen} />
        </strong>
        <span>{tr(props.step.unit)}</span>
      </div>
      <div className="hub-path-body">
        <h4>
          {props.nodes.length > 0 ? (
            <button
              type="button"
              className="hub-path-toggle"
              aria-expanded={open}
              aria-controls={panel}
              onClick={() => setOpen(!open)}
            >
              {tr(props.step.name)}
              <span aria-hidden="true">{open ? '−' : '+'}</span>
            </button>
          ) : (
            tr(props.step.name)
          )}
        </h4>
        <p>{tr(props.step.text)}</p>
        {props.children}
        {open && (
          <ul className="hub-path-all" id={panel}>
            {props.nodes.map((n) => (
              <li key={n.id}>
                {n.id.startsWith('dbt:') ? (
                  <button
                    type="button"
                    className="hub-path-node"
                    aria-expanded={picked === n.id}
                    onClick={() => setPicked(picked === n.id ? null : n.id)}
                  >
                    <code>{n.label}</code>
                  </button>
                ) : (
                  <code>{n.label}</code>
                )}
                {n.rows != null && (
                  <span>
                    {n.rows.toLocaleString(l('en-GB', 'sv-SE'))}{' '}
                    {l('rows', 'rader')}
                  </span>
                )}
                {n.description && <p>{n.description}</p>}
                {picked === n.id && <NodeSample name={n.id.slice(4)} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

export default function PipelineFlow({ titleId }: { titleId: string }) {
  const graph = useJson<Graph>('architecture/graph.json')
  const quality = useJson<Quality>('quality/summary.json')
  const summary = useJson<Summary>('schema/summary.json')
  if (!ok(graph)) return null
  const marks = ok(quality)
    ? Object.entries(quality.run.check_statuses ?? {}).flatMap(([status, n]) =>
        Array.from({ length: n ?? 0 }, () => status),
      )
    : []
  const rows = graph.layers.map((layer) => {
    const nodes = graph.nodes.filter((n) => n.layer === layer)
    return { layer, count: nodes.length, nodes }
  })
  const gate = rows.findIndex((r) => r.layer === 'gold') + 1
  const fallback = (layer: string) => ({
    name: t(layer, layer),
    unit: t('nodes', 'noder'),
    text: t('', ''),
  })
  return (
    <ol className="hub-path" aria-labelledby={titleId}>
      {rows.slice(0, gate).map((r, i) => (
        <Step
          key={r.layer}
          index={i + 1}
          step={STEPS[r.layer] ?? fallback(r.layer)}
          {...r}
        />
      ))}
      <Step
        index={gate + 1}
        count={ok(summary) ? summary.tests : 0}
        nodes={[]}
        focal
        step={{
          name: t('Quality gate', 'Kvalitetsgrind'),
          unit: t('dbt tests', 'dbt-tester'),
          text: t(
            'dbt tests and enforced contracts, JSON Schemas for every delivered file, and validators that reconcile totals against the warehouse. A failure stops the run before anything is published.',
            'dbt-tester och tvingande kontrakt, JSON-scheman för varje levererad fil och validatorer som stämmer av totaler mot lagret. Ett fel stoppar körningen innan något publiceras.',
          ),
        }}
      >
        {marks.length > 0 && (
          <div className="hub-path-checks">
            <p>
              {l(
                `${marks.length} quality checks: ${marks.filter((m) => m === 'pass').length} pass, the rest not measured or not applicable.`,
                `${marks.length} kvalitetskontroller: ${marks.filter((m) => m === 'pass').length} godkända, resten inte mätta eller inte tillämpliga.`,
              )}
            </p>
            <ol aria-hidden="true">
              {marks.map((m, i) => (
                <li
                  key={i}
                  className={`is-${m}`}
                  style={{ '--i': i } as React.CSSProperties}
                />
              ))}
            </ol>
          </div>
        )}
      </Step>
      {rows.slice(gate).map((r, i) => (
        <Step
          key={r.layer}
          index={gate + 2 + i}
          step={STEPS[r.layer] ?? fallback(r.layer)}
          {...r}
        />
      ))}
    </ol>
  )
}
