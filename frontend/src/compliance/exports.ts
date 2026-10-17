import {
  uniqueDocuments,
  type Family,
  type Filters,
  type Release,
} from './model.ts'

export type Graphic = 'authority' | 'timeline' | 'amounts'
export type PlotRow = { label: string; value: number }
export function plotRows(
  families: Family[],
  kind: Graphic,
  currency: 'SEK' | 'EUR',
): PlotRow[] {
  const counts = new Map<string, number>()
  const decisions = [
    ...new Map(
      families.flatMap((f) => f.decisions).map((d) => [d.decision_id, d]),
    ).values(),
  ]
  if (kind === 'amounts') {
    const bounds = [10000000n, 100000000n, 1000000000n, 10000000000n]
    const labels = [
      '< 100,000',
      '100,000–< 1m',
      '1m–< 10m',
      '10m–< 100m',
      '≥ 100m',
    ]
    const bins = labels.map((label) => ({
      label: `${label} ${currency}`,
      value: 0,
    }))
    for (const f of families)
      for (const a of f.amounts)
        if (a.amount_kind === 'final_effective' && a.currency === currency) {
          const amount = BigInt(a.amount.replace('.', ''))
          const index = bounds.findIndex((b) => amount < b)
          bins[index < 0 ? 4 : index].value++
        }
    return bins
  }
  for (const d of decisions) {
    const key = kind === 'authority' ? d.authority : d.decision_date.slice(0, 4)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const rows = [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }))
  if (rows.length <= 8) return rows
  if (kind === 'authority')
    return [
      ...rows.slice(0, 7),
      {
        label: 'Other issuers',
        value: rows.slice(7).reduce((n, r) => n + r.value, 0),
      },
    ]
  const size = Math.ceil(rows.length / 8)
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => {
    const chunk = rows.slice(i * size, (i + 1) * size)
    return {
      label:
        chunk.length > 1
          ? `${chunk[0].label}–${chunk.at(-1)!.label}`
          : chunk[0].label,
      value: chunk.reduce((n, r) => n + r.value, 0),
    }
  })
}
export const graphicTitle = (kind: Graphic, currency: string) =>
  kind === 'authority'
    ? 'Approved decisions by issuer'
    : kind === 'timeline'
      ? 'Approved decisions over time'
      : `Final administrative amounts · ${currency}`
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '\ufeff'
  const columns = [...new Set(rows.flatMap(Object.keys))]
  const field = (value: unknown) => {
    let text =
      value == null
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    // Spreadsheet programs interpret formula-like cells even when the CSV field is quoted.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  return (
    '\ufeff' +
    [
      columns.map(field).join(','),
      ...rows.map((row) => columns.map((c) => field(row[c])).join(',')),
    ].join('\r\n') +
    '\r\n'
  )
}
export function decisionCsv(
  families: Family[],
  release: Release,
  filters: Filters,
) {
  return csv(
    families.flatMap((f) =>
      f.decisions.map((d) => ({
        decision_id: d.decision_id,
        company_id: d.company_id,
        legal_entity: d.legal_entity,
        origin_decision_id: f.origin_decision_id,
        originating_case_id: f.case_id,
        case_number: d.case_number,
        issuer: d.authority,
        originating_authority: f.authority,
        category: f.category,
        decision_date: d.decision_date,
        publication_date: d.publication_date,
        original_outcome: d.original_outcome,
        current_status: d.legal_status,
        operative_lineage_status: f.legal_status,
        finality_status: d.finality_status,
        legal_basis: d.legal_basis,
        monetary_rows: f.amounts.filter((a) => a.decision_id === d.decision_id),
        source_url: d.source_url,
        document_hash: d.document_hash,
        last_verified_at: d.last_verified_at,
        reverify_by: d.reverify_by,
        cohort_id: release.payload.context.cohort_id,
        release_sha256: release.publication.payload_sha256,
        filters,
      })),
    ),
  )
}
export function methodology(
  release: Release,
  filters: Filters,
  families: Family[],
) {
  const data = release.payload
  return (
    `# Research export context\n\nCohort: ${data.context.cohort_id}; frozen 50 legal entities; snapshot ${data.context.cohort_as_of_date}.\n\n` +
    `Membership SHA-256: ${data.context.membership_hash}\n\nRelease SHA-256: ${release.publication.payload_sha256}\n\n` +
    `Publication reviewed: ${release.publication.reviewed_at}; valid until ${release.publication.valid_until}.\n\nStatus snapshot: ${data.context.status_snapshot_at}.\n\n` +
    `Filters: ${JSON.stringify(filters)}\n\nPeriod selects originating decisions; later approved appeal context is retained. Group totals include selected cohort members only.\n\n` +
    `Coverage: selected approved documents; source-population and search-completion denominators unknown. No identified sanction is not proof of no violation.\n\n` +
    `## Original source references\n\n` +
    uniqueDocuments(families)
      .map(
        (d) =>
          `- ${d.authority}, ${d.decision_date}: ${d.source_url} (SHA-256 ${d.document_hash})`,
      )
      .join('\n') +
    '\n\n' +
    data.methodology_markdown
  )
}
const xml = (s: unknown) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
export type Palette = {
  paper: string
  ink: string
  muted: string
  accent: string
  font: string
}
export function graphicSvg(
  release: Release,
  filters: Filters,
  families: Family[],
  kind: Graphic,
  currency: 'SEK' | 'EUR',
  height: 1200 | 1500,
  palette: Palette,
) {
  const rows = plotRows(families, kind, currency)
  const title = graphicTitle(kind, currency)
  const max = Math.max(1, ...rows.map((r) => r.value))
  const barTop = 352,
    pitch = height === 1500 ? 96 : 64
  const text = (
    x: number,
    y: number,
    value: unknown,
    size = 22,
    fill = palette.ink,
  ) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${xml(fill)}">${xml(value)}</text>`
  const docs = uniqueDocuments(families)
  const referenceLines: { url: string; line: string }[] = []
  for (const d of docs) {
    const lines = d.source_url.match(/.{1,112}/g) || []
    if (referenceLines.length + lines.length > 7) break
    referenceLines.push(...lines.map((line) => ({ url: d.source_url, line })))
  }
  const foot = height - 360
  const metadata = JSON.stringify({
    title,
    filters,
    cohort: release.payload.context,
    publication: release.publication,
    sources: docs,
  })
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="compliance-export-title compliance-export-desc"><title id="compliance-export-title">${xml(title)}</title><desc id="compliance-export-desc">Selected approved evidence only. Counts are not a measure of underlying company risk. Source population coverage is unknown.</desc><metadata>${xml(metadata)}</metadata><rect width="1200" height="${height}" fill="${xml(palette.paper)}"/><g font-family="${xml(palette.font)}">` +
    text(64, 72, 'IT COMPLIANCE INTELLIGENCE', 20, palette.muted) +
    text(64, 132, title, 38) +
    text(
      64,
      184,
      `Originating decisions: ${filters.from} to ${filters.to}`,
      23,
    ) +
    text(
      64,
      224,
      `Frozen cohort: 50 Swedish IT legal entities · ${release.payload.context.cohort_as_of_date}`,
      22,
    ) +
    text(
      64,
      260,
      `View: ${filters.scope} · status: ${filters.status || 'all'} · category: ${filters.category || 'all'}`,
      20,
      palette.muted,
    ) +
    text(
      64,
      296,
      `Issuer filter: ${filters.authority || 'all'} · SNI: ${filters.industry || 'all'} · size class: ${filters.size || 'all'}`,
      18,
      palette.muted,
    ) +
    `<line x1="64" y1="320" x2="1136" y2="320" stroke="${xml(palette.muted)}"/>` +
    (rows.length
      ? rows
          .map(
            (r, i) =>
              text(64, barTop + i * pitch, r.label, 21) +
              `<rect x="540" y="${barTop - 24 + i * pitch}" width="${Math.max(0, (r.value / max) * 500)}" height="28" fill="${xml(palette.accent)}"/>` +
              text(1060, barTop + i * pitch, r.value, 23),
          )
          .join('')
      : text(64, 400, 'No approved decision records match this selection.')) +
    text(
      64,
      foot,
      'Selected public evidence; coverage is incomplete and population coverage is unknown.',
      21,
    ) +
    text(
      64,
      foot + 36,
      'No identified sanctions does not establish an absence of violations.',
      21,
    ) +
    text(
      64,
      foot + 72,
      `Status snapshot: ${release.payload.context.status_snapshot_at.slice(0, 10)} · review expires: ${release.publication.valid_until.slice(0, 10)}`,
      20,
      palette.muted,
    ) +
    text(
      64,
      foot + 108,
      `Cohort: ${release.payload.context.cohort_id.slice(0, 56)} · release: ${release.publication.payload_sha256.slice(0, 16)}`,
      18,
      palette.muted,
    ) +
    referenceLines
      .map(
        (source, i) =>
          `<a href="${xml(source.url)}">${text(64, foot + 144 + i * 20, source.line, 16, palette.ink)}</a>`,
      )
      .join('') +
    text(
      64,
      height - 30,
      `${docs.length} source documents; exact links/hashes in SVG metadata and companion methodology.`,
      18,
      palette.muted,
    ) +
    '</g></svg>'
  )
}
export function assertFresh(release: Release) {
  if (Date.now() >= Date.parse(release.publication.valid_until))
    throw new Error(
      'Publication review expired. Reload for a fresh approved release.',
    )
}
export function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function saveGraphic(
  svg: string,
  height: 1200 | 1500,
  format: 'svg' | 'png',
) {
  if (format === 'svg') {
    save(
      new Blob([svg], { type: 'image/svg+xml' }),
      `compliance-1200x${height}.svg`,
    )
    return
  }
  const image = new Image()
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx)
    throw new Error('PNG export is unavailable in this browser. Use SVG.')
  ctx.drawImage(image, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('PNG encoding failed. Use SVG.')
  save(blob, `compliance-1200x${height}.png`)
}
