/**
 * × Connections: the five studies as nodes, and the threads between them typed by what they
 * are. Tested relationships hang below the floor with ρ and interval; rejected ones arc high in
 * red; conceptual links from the research brief are dotted until a tested relationship for the
 * same pair is published in connections.json, which then replaces the dotted thread.
 */
import { useState } from 'react'
import * as THREE from 'three'
import { AtlasPage } from './AtlasPage'
import { slot, SLOTS, useSlots } from './slots'
import { ACCENT, GAP, type Space, type Tag } from './space'

type Rel = {
  id: string
  products: string[]
  question: string
  assessment: string
  result: { rho: number; ci95: [number, number] }
}
type Conn = {
  relationships: Rel[]
  rejected: { id: string; products: string[]; reason: string }[]
}

const NAMES: Record<string, string> = {
  A: 'Measured Society',
  B: 'Quantified Worker',
  C: 'Modelled Country',
  D: 'Geography of Belonging',
  E: 'Imagined Future',
}
const POS: Record<string, [number, number]> = {
  D: [-260, 170],
  C: [260, 170],
  E: [-420, -320],
  A: [0, -520],
  B: [420, -320],
}
/** Links the research brief proposes; drawn dotted until tested. */
const CONCEPTUAL: [string, string, string][] = [
  ['A', 'D', 'which parts of belonging are measured?'],
  ['A', 'C', 'does coverage shape comparison?'],
  ['A', 'E', 'which feared futures have indicators?'],
  ['C', 'D', 'do similar municipalities differ in civic infrastructure?'],
  ['B', 'E', 'labour-market ideals and imagined futures'],
]
const COLOUR: Record<string, number> = {
  trivial: 0xede6d6,
  uncertain: ACCENT,
  robust: 0xf2a65a,
  not_supported: 0x8e9ab6,
}
const pair = (a: string, b: string) => [a, b].sort().join('')

export default function AtlasConnections() {
  const { states, loading } = useSlots(['connections'])
  const k = slot<Conn>(states, 'connections')
  const [sel, setSel] = useState<string | null>(null)
  const toggle = (id: string) => () => setSel((c) => (c === id ? null : id))
  const fade = (id: string) => (sel && sel !== id ? 0.15 : 1)
  const rels = k?.relationships ?? []
  const clear = rels.filter((r) => r.result.ci95[0] > 0 || r.result.ci95[1] < 0)
  const revealed = k
    ? `${rels.length} relationships are tested; ${clear.length} ${clear.length === 1 ? 'has an interval' : 'have intervals'} that exclude zero${clear.length ? ` (${clear.map((r) => r.assessment).join(', ')})` : ''}. ${k.rejected.length} were rejected before testing.`
    : null

  const build = (s: Space): Tag[] => {
    const tags: Tag[] = []
    const P = Object.fromEntries(
      Object.entries(POS).map(([id, [x, z]]) => [
        id,
        new THREE.Vector3(x, 0, z),
      ]),
    )
    s.web(-20, 600, 0.05, 5, 30)
    for (const [id, v] of Object.entries(P)) {
      s.glow(v, 42, ACCENT)
      tags.push({
        at: v,
        lines: [id, NAMES[id]],
        head: true,
        tone: 'title',
        href: `#sweden-atlas-${id.toLowerCase()}`,
        anchor: 'above',
        dy: -14,
      })
    }
    const tested = new Set<string>()
    const byPair = new Map<string, Rel[]>()
    for (const r of rels) {
      const key = pair(r.products[0], r.products[1] ?? r.products[0])
      byPair.set(key, [...(byPair.get(key) ?? []), r])
      tested.add(key)
    }
    for (const list of byPair.values())
      list.forEach((r, i) => {
        const a = P[r.products[0]]
        const b = P[r.products[1]]
        if (!a || !b) return
        const pts = s.arc(a, b, -70 - i * 90)
        s.line(pts, COLOUR[r.assessment] ?? ACCENT, 0.95 * fade(r.id))
        tags.push({
          pressed: sel === r.id,
          onClick: toggle(r.id),
          at: pts[20],
          lines: [
            `${r.assessment.toUpperCase().replace('_', ' ')} · ρ = ${r.result.rho.toFixed(2)} [${r.result.ci95[0].toFixed(2)}, ${r.result.ci95[1].toFixed(2)}]`,
            ((q) => (q.length > 44 ? q.slice(0, 42).trimEnd() + '…' : q))(
              r.question.split(/[:?]/)[0],
            ),
          ],
          head: true,
          anchor: 'below',
        })
      })
    const rejected = new Set<string>()
    for (const r of k?.rejected ?? []) {
      if (r.products.length < 2) continue
      const a = P[r.products[0]]
      const b = P[r.products[1]]
      rejected.add(pair(r.products[0], r.products[1]))
      const pts = s.arc(a, b, 380)
      const id = `rej:${r.id}`
      s.line(pts.slice(0, 16), 0xe07a5f, 0.8 * fade(id))
      s.line(pts.slice(24), 0xe07a5f, 0.8 * fade(id))
      tags.push({
        pressed: sel === id,
        onClick: toggle(id),
        at: pts[20],
        lines: [
          `${r.products.join(' × ')} · REJECTED`,
          r.reason.replace(/\s*\([^)]*\)/g, '').split(/[;.]/)[0],
        ],
        head: true,
        colour: '#E07A5F',
        anchor: 'above',
      })
    }
    for (const [a, b, q] of CONCEPTUAL) {
      const key = pair(a, b)
      if (tested.has(key) || rejected.has(key)) continue
      const pts = s.arc(P[a], P[b], 0)
      const id = `con:${key}`
      s.line(pts, GAP, 0.8 * fade(id), [3, 6])
      tags.push({
        pressed: sel === id,
        onClick: toggle(id),
        at: pts[20],
        lines: [`${a} × ${b} · untested`, q],
        tone: 'gap',
        dy: 18,
      })
    }
    return tags
  }

  const chosenRel = rels.find((r) => r.id === sel)
  const chosenRej = k?.rejected.find((r) => `rej:${r.id}` === sel)
  const chosenCon = CONCEPTUAL.find(([a, b]) => `con:${pair(a, b)}` === sel)
  const info = chosenRel ? (
    <>
      <span className="is-head">
        {chosenRel.products.join(' × ')} ·{' '}
        {chosenRel.assessment.toUpperCase().replace('_', ' ')}
      </span>
      <span>{chosenRel.question}</span>
      <span>
        Spearman ρ = {chosenRel.result.rho.toFixed(3)}, 95 % interval{' '}
        {chosenRel.result.ci95[0].toFixed(2)} to{' '}
        {chosenRel.result.ci95[1].toFixed(2)}
      </span>
    </>
  ) : chosenRej ? (
    <>
      <span className="is-head">
        {chosenRej.products.join(' × ')} · REJECTED
      </span>
      <span>{chosenRej.reason}</span>
    </>
  ) : chosenCon ? (
    <>
      <span className="is-head is-gap">
        {chosenCon[0]} × {chosenCon[1]} · UNTESTED
      </span>
      <span>{chosenCon[2]}</span>
      <span className="is-gap">
        A link from the research brief. It becomes a tested thread when a result
        for this pair is published.
      </span>
    </>
  ) : (
    <span>Choose a thread to read it.</span>
  )

  return (
    <AtlasPage
      current="#sweden-atlas-x"
      kicker={
        <>
          <b>×</b> · Connections
        </>
      }
      question="How do different representations of Sweden reinforce, contradict or leave gaps in one another?"
      line="Not a sixth study: the threads between the five. Each thread says what kind of link it is."
      revealed={revealed}
      revealedFrom={SLOTS.connections.path}
      gap="Most threads are ideas, not results. Data are joined only when their years, places and methods match."
      keyItems={[
        { label: 'tested, interval excludes zero', colour: '#ede6d6' },
        { label: 'tested, uncertain', colour: '#c9bcf2' },
        { label: 'conceptual, untested', colour: '#aab6cf', dashed: true },
        { label: 'rejected before testing', colour: '#E07A5F' },
      ]}
      foot="Spearman's ρ, bootstrap 95 % interval · no relationship is presented as causal"
      view={{ camera: [0, 300, 1000], target: [0, 20, 0], shift: -190 }}
      slots={states}
      loading={loading}
      build={build}
      rebuild={sel ?? ''}
      info={info}
    />
  )
}
