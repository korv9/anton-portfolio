/** Pure helpers for the quality views (unit-tested). No score is ever computed. */
import type {
  Analysis,
  QualityCheck,
  QualityStatus,
  ValidityStatus,
} from './types'

/** Worst first: a dimension shows its weakest measured result. */
const MEASURED_ORDER: QualityStatus[] = ['fail', 'warning', 'pass']
const VALIDITY_ORDER: ValidityStatus[] = [
  'invalidated',
  'warning',
  'insufficient_evidence',
  'not_evaluated',
  'supported',
]

export type Cell = {
  status: QualityStatus
  measured: number
  pass: number
  warning: number
  fail: number
  notMeasured: number
  notApplicable: number
  total: number
}

/**
 * One product × dimension cell from its checks: the weakest measured status; when nothing was
 * measured, not_measured if any check could be, otherwise not_applicable; null when the product
 * declares no check for the dimension.
 */
export function cellOf(checks: QualityCheck[]): Cell | null {
  if (!checks.length) return null
  const count = (s: QualityStatus) =>
    checks.filter((c) => c.status === s).length
  const cell = {
    measured: checks.filter((c) => MEASURED_ORDER.includes(c.status)).length,
    pass: count('pass'),
    warning: count('warning'),
    fail: count('fail'),
    notMeasured: count('not_measured'),
    notApplicable: count('not_applicable'),
    total: checks.length,
  }
  const status: QualityStatus =
    MEASURED_ORDER.find((s) => checks.some((c) => c.status === s)) ??
    (cell.notMeasured ? 'not_measured' : 'not_applicable')
  return { status, ...cell }
}

export function matrix(
  checks: QualityCheck[],
  products: string[],
  dimensions: string[],
): Record<string, Record<string, Cell | null>> {
  const out: Record<string, Record<string, Cell | null>> = {}
  for (const p of products) {
    out[p] = {}
    for (const d of dimensions)
      out[p][d] = cellOf(
        checks.filter((c) => c.product_id === p && c.dimension === d),
      )
  }
  return out
}

/** The weakest validity status among a product's analyses, or null when it has none. */
export function validityOf(
  analyses: Analysis[],
  product: string,
): ValidityStatus | null {
  const own = analyses.filter((a) => a.product_id === product)
  if (!own.length) return null
  return VALIDITY_ORDER.find((s) => own.some((a) => a.analysis_status === s))!
}

/** Graph node ids a check is about: its product's app node and the dbt models it names. */
export function nodesOfCheck(check: QualityCheck): string[] {
  const ids = [`app:${check.product_id}`]
  for (const part of check.dataset_id.split(','))
    if (/^\s*(bronze|silver|gold)\.[a-z0-9_]+\s*$/.test(part))
      ids.push(`dbt:${part.trim().split('.')[1]}`)
  return ids
}

/** Node id → the weakest status of the checks about it (for the constellation's quality view). */
export function nodeStatuses(
  checks: QualityCheck[],
): Map<string, QualityStatus> {
  const groups = new Map<string, QualityCheck[]>()
  for (const c of checks)
    for (const id of nodesOfCheck(c))
      groups.set(id, [...(groups.get(id) ?? []), c])
  const out = new Map<string, QualityStatus>()
  for (const [id, list] of groups) out.set(id, cellOf(list)!.status)
  return out
}

/** "2 of 2 pass", "3 measured · 1 warning", "not measured", in the reader's words. */
export function cellText(
  cell: Cell | null,
  l: (en: string, sv: string) => string,
): string {
  if (!cell) return l('no check', 'ingen kontroll')
  if (!cell.measured)
    return cell.status === 'not_applicable'
      ? l('not applicable', 'ej tillämpligt')
      : l('not measured', 'ej mätt')
  const parts = [l(`${cell.measured} measured`, `${cell.measured} mätta`)]
  if (cell.pass) parts.push(l(`${cell.pass} pass`, `${cell.pass} godkända`))
  if (cell.warning)
    parts.push(l(`${cell.warning} warning`, `${cell.warning} varning`))
  if (cell.fail) parts.push(l(`${cell.fail} fail`, `${cell.fail} underkända`))
  if (cell.notMeasured)
    parts.push(
      l(`${cell.notMeasured} not measured`, `${cell.notMeasured} ej mätta`),
    )
  return parts.join(' · ')
}

/** A check's value as the reader should see it: a ratio with its parts, a count, or nothing. */
export function valueText(
  c: QualityCheck,
  l: (en: string, sv: string) => string,
): string {
  if (c.value == null) return '–'
  if (c.numerator != null && c.denominator != null)
    return `${fmt(c.numerator)} / ${fmt(c.denominator)}${c.sample_size ? l(' (sample)', ' (urval)') : ''}`
  return fmt(c.value)
}

const fmt = (v: number) =>
  Number.isInteger(v)
    ? v.toLocaleString('sv-SE')
    : v.toLocaleString('sv-SE', { maximumFractionDigits: 3 })
