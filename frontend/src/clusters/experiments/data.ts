/**
 * Cluster experiments as ml/experiments/export.py writes them: a small index of every registered
 * run per domain, and one file per run that loads only when the run is opened.
 */
import { fetchJson } from '../../dataSource'
import { l } from '../../i18n'

export type Status = 'candidate' | 'champion' | 'rejected'
type Dict = Record<string, unknown>

export type RunSummary = {
  run_id: string
  status: Status
  label: string
  role: string
  created_at: string
  dataset_version: string
  embedding: Dict & { model?: string; revision?: string }
  clustering: Dict & { method?: string }
  cluster_count: number
  noise_share: number
  seed_ari: number | null
  accepted: boolean | null
  /** The pipeline the domain's own site page publishes; a registry promotion does not change it. */
  published_on_site_page?: boolean
  retired_at?: string | null
}
export type Domain = {
  champion: string | null
  question: string
  runs: RunSummary[]
}
export type ExperimentIndex = {
  schema_version: number
  generated_at: string
  coordinates: string
  domains: Record<string, Domain>
}

export type Criterion = {
  name?: string
  metric?: string
  candidate?: number | null
  champion?: number | null
  passed: boolean
  note?: string
  required?: boolean
  at_least?: number
  at_most?: number
  not_worse_than_champion?: number
  better_than_champion?: number
  direction?: 'higher' | 'lower'
  any_of?: Criterion[]
}
export type Acceptance = {
  passed: boolean
  failed: string[]
  criteria: Criterion[]
  criteria_sha256: string
  champion_run_id: string | null
}
export type Dominance = {
  weighted_top_share?: number
  ami?: number
  null_top_share_p95?: number
} & Dict
export type Metrics = {
  cluster_count: number
  noise_share: number
  coverage?: number
  largest_cluster_share?: number
  seed_stability?: { ari_mean?: number; ari_min?: number }
  separation_clustered?: number
  separation_representation?: number
  dominance?: Record<string, Dominance>
} & Dict
export type Example = { id: string; text: string; source?: Dict }
export type Group = {
  cluster: number
  key: string
  size: number
  name_status: string
  /** A generated or reviewed name, when the export has one: English, or [English, Swedish]. */
  name?: string | [string, string]
  terms?: string[]
  dominant?: Record<string, [string, number]>
  examples: Example[]
}
export type RunFile = {
  schema_version: number
  run_id: string
  status: Status
  acceptance: Acceptance | null
  published_on_site_page?: boolean
  retired_at?: string | null
  run: {
    domain: string
    question: string
    corpus: string
    sample: Dict
    dataset_version: string
    pipeline: Dict & { embedding?: Dict; clustering?: Dict }
    seeds: number[]
    role: string
    metrics: Metrics
    resources: Dict
    limitations: string[]
    created_at: string
    label?: string
  }
  map: {
    method: string
    note: string
    columns: string[]
    points: [string, number, number, number][]
  }
  groups: Group[]
}

const INDEX = 'cluster-experiments/index.json'

/**
 * The index, or null when nothing is registered yet: a 404, or a release without the file.
 * Any other failure (a page instead of JSON, a broken file) stays an error.
 */
export async function loadIndex(): Promise<ExperimentIndex | null> {
  try {
    return await fetchJson<ExperimentIndex>(INDEX)
  } catch (error) {
    if (/HTTP 404|unavailable in approved delivery/.test(String(error)))
      return null
    throw error
  }
}

const runs = new Map<string, Promise<RunFile>>()
/** One run's file, fetched once per page. A failed fetch is forgotten so it can be retried. */
export function loadRun(id: string): Promise<RunFile> {
  if (!/^[\w-]+$/.test(id)) return Promise.reject(new Error(`bad run id ${id}`))
  let pending = runs.get(id)
  if (!pending) {
    pending = fetchJson<RunFile>(`cluster-experiments/runs/${id}.json`)
    pending.catch(() => runs.delete(id))
    runs.set(id, pending)
  }
  return pending
}

export const DOMAIN_NAMES: Record<string, () => string> = {
  philosophy: () => l('Philosophy', 'Filosofi'),
  symbolic: () => l('Symbols', 'Symboler'),
  jobs: () => l('Job ads', 'Jobbannonser'),
  debates: () => l('Debates', 'Debatter'),
}
export const domainName = (d: string) => DOMAIN_NAMES[d]?.() ?? d

/** The status, and for the published pipeline whether a promoted candidate retired it. */
export const statusName = (s: string, onSite?: boolean) =>
  onSite && s !== 'champion'
    ? l(
        'Former champion, still the published page',
        'Tidigare champion, fortfarande den publicerade sidan',
      )
    : s === 'champion'
      ? l('Champion', 'Champion')
      : s === 'candidate'
        ? l('Candidate', 'Kandidat')
        : s === 'rejected'
          ? l('Rejected', 'Avvisad')
          : s

const locale = () => l('en-GB', 'sv-SE')
export const num = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n)
    ? '–'
    : n.toLocaleString(locale(), { maximumFractionDigits: digits })
export const pct = (share: number | null | undefined) =>
  share == null ? '–' : `${num(share * 100, 1)} %`
export const day = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(locale(), { dateStyle: 'medium' })
}

/** A pipeline step or a sample as one readable line: `key value, key value`. */
export function describe(value: unknown): string {
  if (value == null) return '–'
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return value.map(describe).join(', ')
  return Object.entries(value as Dict)
    .map(([k, v]) =>
      v && typeof v === 'object' ? `${k} (${describe(v)})` : `${k} ${v}`,
    )
    .join(', ')
}

/** What the export says about a group's name. Only the data can say a person reviewed it. */
export function nameState(status: string) {
  if (status.startsWith('generated'))
    return l('Generated, not reviewed', 'Genererad, ej granskad')
  if (status === 'reviewed' || status.startsWith('human'))
    return l('Reviewed by a person', 'Granskad av en person')
  if (status === 'unnamed') return l('No name', 'Inget namn')
  return status
}

export function groupName(g: Group): string {
  if (Array.isArray(g.name)) return l(g.name[0], g.name[1])
  if (g.name) return g.name
  if (g.terms?.length) return g.terms.slice(0, 4).join(', ')
  return l('No clear theme', 'Inget tydligt tema')
}

/** The hash of the experiments view for a run, and optionally one of its groups. */
export const runHref = (run: string, group?: number) =>
  `#cluster-visuals-experiments?run=${encodeURIComponent(run)}${group == null ? '' : `&group=${group}`}`
