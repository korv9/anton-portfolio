/**
 * The DrugComb cell lines on a body, drawn like an old energy chart: a dotted outline, a double
 * helix down the spine and field lines around it. Each tissue of origin sits where it belongs in
 * the body; its size is the number of measurements, and the bright arc round it is the share of
 * them that were synergistic (ZIP > 10). Everything comes from report.json's lineages.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import { fixed } from '../format'
import './body.css'

export type Lineage = {
  lineage: string
  combinations: number
  cell_lines: number
  median_zip: number
  share_synergistic: number
}

/** Where each tissue sits on the body (viewBox 900 × 760), with its Swedish name. */
const PLACES: Record<string, { at: [number, number]; sv: string }> = {
  'CNS/Brain': { at: [450, 104], sv: 'CNS/hjärna' },
  Lymphoid: { at: [478, 170], sv: 'Lymfatisk vävnad' },
  Pleura: { at: [420, 222], sv: 'Lungsäck' },
  Lung: { at: [484, 228], sv: 'Lunga' },
  Myeloid: { at: [450, 262], sv: 'Benmärg (myeloisk)' },
  Breast: { at: [418, 282], sv: 'Bröst' },
  Kidney: { at: [486, 330], sv: 'Njure' },
  Bowel: { at: [446, 372], sv: 'Tarm' },
  'Ovary/Fallopian Tube': { at: [424, 414], sv: 'Äggstock/äggledare' },
  Prostate: { at: [474, 426], sv: 'Prostata' },
  Skin: { at: [566, 360], sv: 'Hud' },
  Bone: { at: [478, 540], sv: 'Skelett' },
  Unknown: { at: [130, 668], sv: 'Okänt ursprung' },
}

/** The right half of the outline, neck to crotch; the left is its mirror. */
const HALF: [number, number][] = [
  [462, 146],
  [466, 166],
  [492, 174],
  [522, 184],
  [540, 204],
  [550, 250],
  [558, 310],
  [568, 380],
  [576, 418],
  [586, 446],
  [580, 470],
  [566, 466],
  [556, 424],
  [544, 350],
  [532, 280],
  [522, 234],
  [512, 246],
  [514, 300],
  [506, 352],
  [520, 404],
  [522, 470],
  [516, 560],
  [508, 640],
  [502, 668],
  [520, 690],
  [494, 696],
  [482, 670],
  [478, 600],
  [472, 520],
  [462, 452],
  [452, 442],
]

/** A smooth closed curve through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: [number, number][]) {
  const p = (i: number) => pts[(i + pts.length) % pts.length]
  let d = `M ${p(0)[0]} ${p(0)[1]}`
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`
  }
  return `${d} Z`
}

const OUTLINE = smooth([
  ...HALF,
  ...[...HALF].reverse().map(([x, y]): [number, number] => [900 - x, y]),
])

/** Two strands winding round the spine, crown to pelvis. */
function helix(phase: number) {
  const pts: string[] = []
  for (let y = 150; y <= 440; y += 4) {
    const x = 450 + Math.sin((y - 150) / 18 + phase) * 9
    pts.push(`${x.toFixed(1)} ${y}`)
  }
  return `M ${pts.join(' L ')}`
}

const arc = (cx: number, cy: number, r: number, share: number) => {
  const a = -Math.PI / 2 + Math.max(share, 0.004) * Math.PI * 2
  const [x, y] = [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(1)} ${y.toFixed(1)}`
}

const num = fixed

export default function BodyMap({
  lineages,
  highlight = null,
}: {
  lineages: Lineage[]
  /** A tissue chosen with a slicer outside the chart; pointing still takes over. */
  highlight?: string | null
}) {
  const root = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  const [hovered, setFocus] = useState<string | null>(null)
  const focus = hovered ?? highlight

  useEffect(() => {
    const node = root.current
    if (!node || !('IntersectionObserver' in window)) return setOn(true)
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        setOn(true)
      },
      { threshold: 0.2 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const nodes = useMemo(() => {
    const placed = lineages.filter((x) => PLACES[x.lineage])
    const max = Math.max(...placed.map((x) => x.combinations))
    const list = placed.map((x) => {
      const [cx, cy] = PLACES[x.lineage].at
      return {
        ...x,
        cx,
        cy,
        r: 5 + 15 * Math.sqrt(x.combinations / max),
        name: l(x.lineage, PLACES[x.lineage].sv),
        right: cx >= 450,
        outside: cx < 250 || cx > 650,
      }
    })
    // Labels in two columns, in the order of the body, spread so they never overlap.
    const column = (right: boolean) => {
      const side = list
        .filter((x) => x.right === right && !x.outside)
        .sort((a, b) => a.cy - b.cy)
      const top = 80
      const gap = Math.max(52, (700 - top) / Math.max(side.length, 1))
      return side.map((x, k) => ({ ...x, ly: top + k * gap }))
    }
    // A tissue outside the body (unknown origin) is labelled where it floats.
    const outside = list
      .filter((x) => x.outside)
      .map((x) => ({ ...x, ly: x.cy + x.r + 26 }))
    return [...column(false), ...column(true), ...outside]
      .sort((a, b) => a.cy - b.cy)
      .map((x, k) => ({ ...x, index: k + 1 }))
  }, [lineages])

  const active = nodes.find((n) => n.lineage === focus) ?? null
  const cells = nodes.reduce((s, n) => s + n.cell_lines, 0)

  return (
    <div
      ref={root}
      className={`body-map${on ? ' is-on' : ''}${active ? ' has-focus' : ''}`}
    >
      <svg
        viewBox="0 0 900 760"
        role="img"
        aria-label={l(
          `${cells} cancer cell lines by tissue of origin, placed on a body. The table below has the numbers.`,
          `${cells} cancercellinjer efter ursprungsvävnad, placerade på en kropp. Tabellen nedanför har siffrorna.`,
        )}
      >
        <defs>
          <filter id="body-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="900" height="760" className="body-ground" />
        <text x="40" y="44" className="body-title">
          {l(
            'Cell lines in the screens, by tissue of origin',
            'Försökens cellinjer, efter ursprungsvävnad',
          )}
        </text>

        <g className="body-field">
          {[0, 1, 2, 3].map((k) => (
            <ellipse
              key={k}
              cx="450"
              cy="390"
              rx={150 + k * 34}
              ry={300 + k * 14}
              style={{ ['--k' as string]: k }}
            />
          ))}
        </g>
        <g className="body-halo">
          {[52, 66, 80].map((r) => (
            <circle key={r} cx="450" cy="104" r={r} />
          ))}
        </g>

        <path className="body-outline" d={OUTLINE} pathLength={1} />
        <path className="body-outline-dots" d={OUTLINE} />
        <circle className="body-head" cx="450" cy="104" r="40" pathLength={1} />
        <line className="body-spine" x1="450" y1="150" x2="450" y2="440" />
        <path className="body-helix" d={helix(0)} pathLength={1} />
        <path className="body-helix" d={helix(Math.PI)} pathLength={1} />

        {nodes.map((n) => {
          const lx = n.outside ? n.cx : n.right ? 650 : 250
          const elbow = n.right ? 610 : 290
          const anchor = n.outside ? 'middle' : n.right ? 'start' : 'end'
          return (
            <g
              key={n.lineage}
              className={`body-node${focus === n.lineage ? ' is-active' : ''}`}
              style={{ ['--i' as string]: n.index }}
              onMouseEnter={() => setFocus(n.lineage)}
              onMouseLeave={() => setFocus(null)}
            >
              {!n.outside && (
                <g className="body-lead">
                  <path
                    className="body-leader"
                    d={`M ${n.cx} ${n.cy} L ${elbow} ${n.ly} L ${lx} ${n.ly}`}
                  />
                </g>
              )}
              <circle className="body-ring" cx={n.cx} cy={n.cy} r={n.r + 5} />
              <circle className="body-core" cx={n.cx} cy={n.cy} r={n.r} />
              <path
                className="body-arc"
                d={arc(n.cx, n.cy, n.r + 5, n.share_synergistic)}
                filter="url(#body-glow)"
              />
              <text className="body-index" x={n.cx} y={n.cy + 3.5}>
                {n.index}
              </text>
              <g
                className="body-label"
                transform={`translate(${n.outside ? lx : n.right ? lx + 6 : lx - 6} ${n.ly})`}
              >
                <text className="body-label-name" textAnchor={anchor} y={-4}>
                  {n.index}. {n.name.toUpperCase()}
                </text>
                <text className="body-label-meta" textAnchor={anchor} y={11}>
                  {num(n.cell_lines)} {l('cell lines', 'cellinjer')} ·{' '}
                  {num(n.combinations)} {l('measurements', 'mätningar')}
                </text>
                <text className="body-label-meta" textAnchor={anchor} y={25}>
                  {num(n.share_synergistic * 100, 1)} %{' '}
                  {l('synergistic', 'synergistiska')} ·{' '}
                  {l('median ZIP', 'median-ZIP')} {num(n.median_zip, 2)}
                </text>
              </g>
            </g>
          )
        })}
      </svg>

      <p className="body-caption" aria-live="polite">
        {active
          ? l(
              `${active.name}: ${num(active.cell_lines)} cell lines, ${num(active.combinations)} measurements, ${num(active.share_synergistic * 100, 1)} % of them synergistic (ZIP > 10).`,
              `${active.name}: ${num(active.cell_lines)} cellinjer, ${num(active.combinations)} mätningar, ${num(active.share_synergistic * 100, 1)} % av dem synergistiska (ZIP > 10).`,
            )
          : l(
              'Size: number of measurements. Bright arc: share synergistic (ZIP > 10), a full circle being 100 %. Differences also reflect which drugs and studies each tissue was tested with; this is not a treatment comparison.',
              'Storlek: antal mätningar. Ljus båge: andel synergistiska (ZIP > 10), där en hel cirkel är 100 %. Skillnaderna speglar också vilka läkemedel och studier varje vävnad testades med; det här är ingen jämförelse av behandlingar.',
            )}
      </p>
      <details className="body-table">
        <summary>{l('Show as a table', 'Visa som tabell')}</summary>
        <table className="board-table">
          <thead>
            <tr>
              <th scope="col">{l('Tissue', 'Vävnad')}</th>
              <th scope="col" className="num">
                {l('Cell lines', 'Cellinjer')}
              </th>
              <th scope="col" className="num">
                {l('Measurements', 'Mätningar')}
              </th>
              <th scope="col" className="num">
                {l('Synergistic', 'Synergistiska')}
              </th>
              <th scope="col" className="num">
                {l('Median ZIP', 'Median-ZIP')}
              </th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.lineage}>
                <td>
                  {n.index}. {n.name}
                </td>
                <td className="num">{num(n.cell_lines)}</td>
                <td className="num">{num(n.combinations)}</td>
                <td className="num">{num(n.share_synergistic * 100, 1)} %</td>
                <td className="num">{num(n.median_zip, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
