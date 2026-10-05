/**
 * The decision tree, drawn so it can be watched working: measurements fall from the root as
 * points of light, take the branch each rule sends them down and gather in the leaves. Branches
 * are as thick as the measurements that pass; a leaf glows by the share of them that were
 * synergistic. Pointing at a leaf traces its path and reads its rules. From tree.json, trained by
 * platform/publish/drugcomb_ml.py on the real DrugCombDB screens.
 */
import { useMemo, useState } from 'react'
import { l } from '../i18n'

type Rule = {
  en: string
  sv: string
  yes: { en: string; sv: string }
  no: { en: string; sv: string }
}
export type TreeNode = {
  id: number
  depth: number
  n: number
  share: number
  feature?: string
  threshold?: number
  rule?: Rule
  children?: [TreeNode, TreeNode]
}

const W = 1000
const H = 660
const TOP = 92
const BOTTOM = 560

const num = (v: number, d = 0) =>
  v.toLocaleString(l('en-GB', 'sv-SE'), {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

/** A short label for a split, in two lines to fit on the drawing; the full rule is read on hover. */
function short(node: TreeNode): [string, string] {
  const f = node.feature ?? ''
  if (f.startsWith('tissue=')) return [f.slice(7), l('tissue?', 'vävnad?')]
  const name = {
    stronger_drug_zip: l('stronger drug', 'starkare läkem.'),
    weaker_drug_zip: l('weaker drug', 'svagare läkem.'),
    cell_zip: l('cell line', 'cellinje'),
  }[f]
  return [name ?? f, `≤ ${num(node.threshold ?? 0, 1)}`]
}

type Placed = TreeNode & {
  x: number
  y: number
  parent: Placed | null
  branch: 0 | 1 | null
}

function place(root: TreeNode): Placed[] {
  const leaves: TreeNode[] = []
  const walk = (n: TreeNode) =>
    n.children ? n.children.forEach(walk) : leaves.push(n)
  walk(root)
  const depth = Math.max(...leaves.map((n) => n.depth))
  const xs = new Map<number, number>()
  leaves.forEach((n, i) =>
    xs.set(n.id, 60 + ((W - 120) * (i + 0.5)) / leaves.length),
  )
  const out: Placed[] = []
  const visit = (
    n: TreeNode,
    parent: Placed | null,
    branch: 0 | 1 | null,
  ): number => {
    const y = TOP + ((BOTTOM - TOP) * n.depth) / depth
    const me: Placed = { ...n, x: 0, y, parent, branch }
    out.push(me)
    if (n.children) {
      const a = visit(n.children[0], me, 0)
      const b = visit(n.children[1], me, 1)
      me.x = (a + b) / 2
    } else me.x = xs.get(n.id)!
    return me.x
  }
  visit(root, null, null)
  return out
}

const curve = (a: Placed, b: Placed) => {
  const my = (a.y + b.y) / 2
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${a.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

/** The whole way from the root to a node, for the points of light to travel. */
function route(node: Placed) {
  const chain: Placed[] = []
  for (let n: Placed | null = node; n; n = n.parent) chain.unshift(n)
  return chain
    .slice(1)
    .map((n, i) =>
      curve(chain[i], n).replace(
        /^M [^C]+/,
        i ? '' : `M ${chain[0].x} ${chain[0].y} `,
      ),
    )
    .join(' ')
}

const still = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function DecisionTree({
  root,
  highlight = null,
}: {
  root: TreeNode
  /** A node chosen with a slicer outside the chart; pointing still takes over. */
  highlight?: number | null
}) {
  const nodes = useMemo(() => place(root), [root])
  const [hovered, setFocus] = useState<number | null>(null)
  const focus = hovered ?? highlight
  const total = root.n
  const leaves = nodes.filter((n) => !n.children)
  const maxShare = Math.max(...leaves.map((n) => n.share))
  const width = (n: number) => 1 + 13 * Math.sqrt(n / total)

  // Which nodes lie on the path to the focused one.
  const onPath = new Set<number>()
  const focused = nodes.find((n) => n.id === focus) ?? null
  for (let n: Placed | null = focused; n; n = n.parent) onPath.add(n.id)

  // Points of light: about 90 in all, shared out by how many measurements reach each leaf; the
  // gold ones stand for the synergistic share.
  const motes = useMemo(() => {
    if (still()) return []
    return leaves.flatMap((leaf) => {
      const k = Math.max(1, Math.round((90 * leaf.n) / total))
      const gold = Math.round(k * leaf.share)
      const d = route(leaf)
      return Array.from({ length: k }, (_, j) => ({
        key: `${leaf.id}-${j}`,
        d,
        gold: j < gold,
        dur: 5 + ((leaf.id * 7 + j * 13) % 30) / 10,
        begin: ((j * 37 + leaf.id * 11) % 60) / 10,
      }))
    })
  }, [leaves, total])

  const trail = focused
    ? (() => {
        const chain: Placed[] = []
        for (let n: Placed | null = focused; n; n = n.parent) chain.unshift(n)
        return chain.slice(0, -1).map((n, i) => {
          const next = chain[i + 1]
          const answer = next.branch === 0 ? n.rule!.yes : n.rule!.no
          return `${l(n.rule!.en, n.rule!.sv)} ${l(answer.en, answer.sv)}`
        })
      })()
    : []

  return (
    <div className={`dtree${focused ? ' has-focus' : ''}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={l(
          `Decision tree with ${leaves.length} leaves. Each path from the top is a set of rules; each leaf shows how many measurements reach it and the share that were synergistic.`,
          `Beslutsträd med ${leaves.length} löv. Varje väg uppifrån är en uppsättning regler; varje löv visar hur många mätningar som når dit och andelen som var synergistiska.`,
        )}
      >
        <defs>
          <radialGradient id="dtree-glow">
            <stop offset="0" stopColor="#ffe3a3" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffe3a3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} className="dtree-ground" />
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            className="dtree-level"
            x1="30"
            x2={W - 30}
            y1={TOP + (BOTTOM - TOP) * f}
            y2={TOP + (BOTTOM - TOP) * f}
          />
        ))}

        {nodes
          .filter((n) => n.parent)
          .map((n) => (
            <path
              key={n.id}
              className={`dtree-branch${onPath.has(n.id) ? ' is-on' : ''}`}
              d={curve(n.parent!, n)}
              strokeWidth={width(n.n)}
              pathLength={1}
              style={{ ['--d' as string]: n.depth }}
            />
          ))}

        <g className="dtree-motes" aria-hidden="true">
          {motes.map((m) => (
            <circle
              key={m.key}
              r={m.gold ? 2.6 : 1.6}
              className={m.gold ? 'is-gold' : undefined}
            >
              <animateMotion
                dur={`${m.dur}s`}
                begin={`${m.begin}s`}
                repeatCount="indefinite"
                path={m.d}
              />
            </circle>
          ))}
        </g>

        {nodes
          .filter((n) => n.children)
          .map((n) => (
            <g
              key={n.id}
              className={`dtree-node${onPath.has(n.id) ? ' is-on' : ''}`}
              transform={`translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`}
              onMouseEnter={() => setFocus(n.id)}
              onMouseLeave={() => setFocus(null)}
            >
              <circle r={n.depth === 0 ? 9 : 6} />
              <circle r={n.depth === 0 ? 15 : 10} className="dtree-halo" />
              <text y={-27} textAnchor="middle">
                {short(n)[0]}
              </text>
              <text y={-15} textAnchor="middle" className="dtree-thr">
                {short(n)[1]}
              </text>
            </g>
          ))}

        {leaves.map((n) => {
          const r = 6 + 16 * Math.sqrt(n.n / total)
          const glow = n.share / maxShare
          return (
            <g
              key={n.id}
              className={`dtree-leaf${focus === n.id ? ' is-on' : ''}`}
              transform={`translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`}
              onMouseEnter={() => setFocus(n.id)}
              onMouseLeave={() => setFocus(null)}
            >
              <circle
                r={r * (1.6 + glow)}
                fill="url(#dtree-glow)"
                opacity={glow}
              />
              <circle r={r} className="dtree-leaf-core" />
              <text y={r + 16} textAnchor="middle" className="dtree-share">
                {num(n.share * 100, 0)} %
              </text>
              <text y={r + 29} textAnchor="middle" className="dtree-n">
                {num(n.n / 1000, 0)}k
              </text>
            </g>
          )
        })}
        <text
          x={W / 2}
          y={TOP - 56}
          textAnchor="middle"
          className="dtree-root-label"
        >
          {l(
            `${num(total)} measurements enter`,
            `${num(total)} mätningar går in`,
          )}
        </text>
        <text x={W / 2} y={H - 22} textAnchor="middle" className="dtree-foot">
          {l(
            'leaves: share synergistic (ZIP > 10) · thousands of measurements',
            'löv: andel synergistiska (ZIP > 10) · tusen mätningar',
          )}
        </text>
      </svg>
      <div className="dtree-caption" aria-live="polite">
        {focused ? (
          <>
            <ol>
              {trail.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <p>
              <b>
                {num(focused.n)} {l('measurements', 'mätningar')} ·{' '}
                {num(focused.share * 100, 1)} %{' '}
                {l('synergistic', 'synergistiska')}
              </b>
            </p>
          </>
        ) : (
          <p>
            {l(
              'Each point of light is a share of the training measurements; gold ones were synergistic. Point at a node or a leaf to read the rules that lead there.',
              'Varje ljuspunkt är en andel av träningsmätningarna; de gyllene var synergistiska. Peka på en nod eller ett löv för att läsa reglerna som leder dit.',
            )}
          </p>
        )}
      </div>
    </div>
  )
}

/** The leaves of a tree, left to right, for a slicer that picks one. */
export function leavesOf(root: TreeNode): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (n: TreeNode) =>
    n.children ? n.children.forEach(walk) : out.push(n)
  walk(root)
  return out
}
