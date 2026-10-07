/**
 * The data catalogue, built from three published files and nothing else: the architecture
 * graph (architecture/graph.json: what each published file is made from and who reads it), the
 * delivery catalog (catalog.json: every file with rows, bytes and checksum) and the quality
 * checks (quality/checks.json). Pure, so it is unit-tested directly.
 */
import {
  downstream,
  upstream,
  type Graph,
  type GraphNode,
} from '../constellation/graph.ts'

export type CatalogFile = {
  path: string
  product: string
  format: string
  bytes: number
  rows: number | null
  sha256: string
  run_id: string
}
export type Catalog = {
  run_id: string
  bases: Record<string, string>
  files: CatalogFile[]
}
export type QualityCheck = {
  quality_check_id: string
  dataset_id: string
  dimension_label: string
  description: string
  status: string
}

export type Dataset = {
  id: string
  label: string
  domain: string
  files: CatalogFile[]
  rows: number
  bytes: number
  formats: string[]
  models: GraphNode[]
  sources: GraphNode[]
  consumers: GraphNode[]
  checks: QualityCheck[]
}

/** `ai-act/*.json` matches `ai-act/actors.json`; `debates/**` matches anything below. */
export function globMatch(glob: string, path: string): boolean {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
  return new RegExp(`^${pattern}$`).test(path)
}

export function buildCatalogue(
  graph: Graph,
  catalog: Catalog,
  checks: QualityCheck[],
): Dataset[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  return graph.nodes
    .filter((n) => n.type === 'delivery')
    .map((n) => {
      const glob = n.label
      const files = catalog.files.filter((f) => globMatch(glob, f.path))
      const models = graph.edges
        .filter((e) => e.target === n.id && e.type === 'delivery')
        .map((e) => byId.get(e.source))
        .filter((m): m is GraphNode => m != null)
      const up = [...upstream(graph, n.id)].map((id) => byId.get(id)!)
      const names = new Set(models.map((m) => `gold.${m.label}`))
      return {
        id: n.id,
        label: glob,
        domain: n.domain,
        files,
        rows: files.reduce((s, f) => s + (f.rows ?? 0), 0),
        bytes: files.reduce((s, f) => s + f.bytes, 0),
        formats: [...new Set(files.map((f) => f.format))],
        models,
        sources: up.filter((u) => u.type === 'source'),
        consumers: [...downstream(graph, n.id)]
          .map((id) => byId.get(id)!)
          .filter((c) => c.type === 'frontend'),
        // A check may name several datasets: "gold.a, seeds/b".
        checks: checks.filter((c) =>
          c.dataset_id.split(/,\s*/).some((id) => names.has(id)),
        ),
      }
    })
    .sort(
      (a, b) =>
        a.domain.localeCompare(b.domain) || a.label.localeCompare(b.label),
    )
}
