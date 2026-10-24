/**
 * Fits each chart of a card to the space it is drawn in. Chart text is sized in SVG units and
 * the chart is scaled to the card, so each chart gets its drawn scale as --mean-s; meaning.css
 * divides text sizes by it to keep them near 10 px. Text that grows in drawing units can then
 * reach past the chart's fixed margins, so the viewBox widens to take in all its text: the
 * chart shrinks a little rather than cutting a tick or a line label at the edge.
 */
export function fitCharts(node: Element) {
  node
    .querySelectorAll<SVGSVGElement>('.mean-body svg[viewBox]')
    .forEach(fitChart)
  const open = node.classList.contains('mean-open')
  node
    .querySelectorAll<HTMLElement>('.mean-body .mean-bars')
    .forEach((bars) => fitRows(bars, open))
}

/** Room kept under a cut list for its "N more when opened" line (meaning.css). */
const MORE = 20

/**
 * A thumbnail's ranked list shows only the rows that fit whole and counts the rest, with the
 * rows the post itself left out (`data-hidden`), as `data-more`. Opened, every row shows.
 */
function fitRows(bars: HTMLElement, open: boolean) {
  const rows = [...bars.querySelectorAll<HTMLElement>('li')]
  for (const li of rows) if (li.dataset.cut) li.style.display = ''
  rows.forEach((li) => delete li.dataset.cut)
  const left = Number(bars.dataset.hidden ?? 0)
  const bottom = bars.getBoundingClientRect().bottom
  const fits = (li: HTMLElement, room: number) =>
    li.getBoundingClientRect().bottom <= bottom - room + 0.5
  let cut = 0
  if (!open && !rows.every((li) => fits(li, left ? MORE : 0))) {
    const keep = rows.findIndex((li) => !fits(li, MORE))
    for (const li of rows.slice(Math.max(1, keep))) {
      li.dataset.cut = '1'
      li.style.display = 'none'
      cut++
    }
  }
  const more = open ? 0 : left + cut
  if (more) bars.dataset.more = String(more)
  else delete bars.dataset.more
}

/** Pixels of air kept around text that reaches the edge. */
const PAD = 2

function fitChart(svg: SVGSVGElement) {
  // The viewBox the post drew; one this function set is recognised and replaced.
  const own = svg.getAttribute('viewBox') ?? ''
  if (own !== svg.dataset.fit) svg.dataset.box = own
  const [x, y, w, h] = (svg.dataset.box ?? own).split(/[\s,]+/).map(Number)
  const { width, height } = svg.getBoundingClientRect()
  if (!w || !h || !width || !height) return
  let box = [x, y, w, h]
  // A few rounds: a wider box draws smaller, which makes the text larger in drawing units.
  for (let round = 0; round < 3; round++) {
    const s = Math.min(width / box[2], height / box[3])
    svg.style.setProperty('--mean-s', String(s))
    const b = textBox(svg)
    if (!b) break
    const pad = PAD / s
    const x0 = Math.min(x, b.x0 - pad)
    const y0 = Math.min(y, b.y0 - pad)
    const x1 = Math.max(x + w, b.x1 + pad)
    const y1 = Math.max(y + h, b.y1 + pad)
    const next = [x0, y0, x1 - x0, y1 - y0]
    if (next.every((v, i) => Math.abs(v - box[i]) < 0.5)) break
    box = next
  }
  const fit = box.map((v) => +v.toFixed(1)).join(' ')
  svg.dataset.fit = fit
  if (own !== fit) svg.setAttribute('viewBox', fit)
}

/** The union of the chart's text boxes in its drawing units; null when it has no text. */
function textBox(svg: SVGSVGElement) {
  const m = svg.getScreenCTM()?.inverse()
  if (!m) return null
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (const t of svg.querySelectorAll('text')) {
    const r = t.getBoundingClientRect()
    if (!r.width) continue
    const p = new DOMPoint(r.left, r.top).matrixTransform(m)
    const q = new DOMPoint(r.right, r.bottom).matrixTransform(m)
    b.x0 = Math.min(b.x0, p.x)
    b.y0 = Math.min(b.y0, p.y)
    b.x1 = Math.max(b.x1, q.x)
    b.y1 = Math.max(b.y1, q.y)
  }
  return b.x0 < b.x1 ? b : null
}
