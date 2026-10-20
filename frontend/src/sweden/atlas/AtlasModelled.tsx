/**
 * C · The Modelled Country: the same municipalities on three floors. Bottom: the map. Middle:
 * similarity space (first two principal components), threads joining each municipality to its
 * place. Top: an alternative model specification (alternatives.json); until one is published
 * the floor is a ghost ring. The chosen municipality (?kommun=, default Kiruna) and its three
 * nearest neighbours are lit.
 */
import * as THREE from 'three'
import { useRoute } from '../../router'
import type { Geometry } from '../map'
import { GROUP_HEX } from './AtlasHub'
import { AtlasPage } from './AtlasPage'
import { extrude, municipalityShapes } from './geo'
import { slot, SLOTS, useSlots } from './slots'
import { GAP, WARM, type Space, type Tag } from './space'

type M = {
  code: string
  name: string
  finer?: number
  pc?: [number, number]
  neighbours?: [string, number, number][]
}
type Sim = {
  summary: {
    analysed: number
    nearest_in_other_county: number
    nearest_km_median: number
  }
  municipalities: M[]
}
type Alt = {
  specs: {
    id: string
    label: string
    municipalities: { code: string; pc: [number, number]; group: number }[]
  }[]
}

type Groups = {
  splits: { role: string; names?: Record<string, [string, string]> }[]
}
const L1 = 190
const L2 = 380
const R = 210

/** Points on a floor from 2D coordinates, centred and scaled to the floor's radius. */
function layout(points: { code: string; pc: [number, number] }[], y: number) {
  const xs = points.map((p) => p.pc[0])
  const ys = points.map((p) => p.pc[1])
  const half =
    Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ) / 2 || 1
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2
  const my = (Math.max(...ys) + Math.min(...ys)) / 2
  return new Map(
    points.map((p) => [
      p.code,
      new THREE.Vector3(
        ((p.pc[0] - mx) / half) * R,
        y,
        (-(p.pc[1] - my) / half) * R,
      ),
    ]),
  )
}

export default function AtlasModelled() {
  const route = useRoute()
  const { states, loading } = useSlots([
    'geometry',
    'similarity',
    'similarityGroups',
    'similarityAlternatives',
  ])
  const geo = slot<Geometry>(states, 'geometry')
  const sim = slot<Sim>(states, 'similarity')
  const alt = slot<Alt>(states, 'similarityAlternatives')
  const sm = sim?.summary
  const names = slot<Groups>(states, 'similarityGroups')?.splits.find(
    (x) => x.role === 'finer split',
  )?.names
  const pick = route.params.get('kommun') ?? '2584'
  const revealed = sm
    ? `For ${sm.nearest_in_other_county} of ${sm.analysed} municipalities, the most similar one lies in another county; the median distance to it is ${sm.nearest_km_median} km.`
    : null

  const build = (s: Space): Tag[] => {
    const tags: Tag[] = []
    if (!geo || !sim) return tags
    const { munis } = municipalityShapes(geo, 0.034)
    const cen = new Map(munis.map((m) => [m.code, m.c]))
    for (const m of munis)
      s.scene.add(
        new THREE.Mesh(
          extrude(m, 1.2),
          new THREE.MeshStandardMaterial({ color: '#2c2b33', roughness: 1 }),
        ),
      )
    const ms = sim.municipalities.filter((m) => m.pc && m.finer != null)
    const mid = layout(ms as { code: string; pc: [number, number] }[], L1)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(260, 96),
      new THREE.MeshBasicMaterial({
        color: 0xc9bcf2,
        transparent: true,
        opacity: 0.035,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.y = L1
    s.scene.add(disc)
    s.web(L1, 260, 0.05, 4, 24)
    const ground = new Map<string, THREE.Vector3>()
    for (const m of ms) {
      const c = cen.get(m.code)
      const b = mid.get(m.code)
      if (!c || !b) continue
      const a = new THREE.Vector3(c[0], 2, c[1])
      ground.set(m.code, a)
      const colour = new THREE.Color(GROUP_HEX[m.finer!])
      for (const [p, r] of [
        [a, 2.6],
        [b, 3.2],
      ] as const) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(r, 10, 10),
          new THREE.MeshBasicMaterial({ color: colour }),
        )
        dot.position.copy(p)
        s.scene.add(dot)
      }
      const bend = a.clone().lerp(b, 0.5)
      bend.x *= 0.7
      bend.z *= 0.7
      s.line(
        new THREE.QuadraticBezierCurve3(a, bend, b).getPoints(20),
        colour.getHex(),
        0.1,
      )
    }
    // Top floor: an alternative specification, or its ghost.
    if (alt?.specs.length) {
      const spec = alt.specs[0]
      const top = layout(spec.municipalities, L2)
      for (const m of spec.municipalities) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(3, 10, 10),
          new THREE.MeshBasicMaterial({ color: GROUP_HEX[m.group % 4] }),
        )
        dot.position.copy(top.get(m.code)!)
        s.scene.add(dot)
        const b = mid.get(m.code)
        if (b) s.line([b, top.get(m.code)!], 0x8e9ab6, 0.06)
      }
      tags.push({
        at: new THREE.Vector3(-270, L2, 0),
        lines: ['ALTERNATIVE SPECIFICATION', spec.label],
        head: true,
        anchor: 'right',
      })
    } else {
      const ring = new THREE.LineSegments(
        new THREE.EdgesGeometry(
          new THREE.CylinderGeometry(260, 260, 1, 64, 1, true),
        ),
        new THREE.LineDashedMaterial({
          color: GAP,
          transparent: true,
          opacity: 0.5,
          dashSize: 4,
          gapSize: 4,
        }),
      )
      ring.computeLineDistances()
      ring.position.y = L2
      s.scene.add(ring)
      tags.push({
        at: new THREE.Vector3(-270, L2, 0),
        lines: [
          'ALTERNATIVE SPECIFICATION',
          'other variables, other scaling',
          `awaiting ${SLOTS.similarityAlternatives.path.split('/').pop()}`,
        ],
        head: true,
        tone: 'gap',
        anchor: 'right',
      })
    }
    s.web(L2, 260, 0.035, 4, 24)
    // The chosen municipality and its nearest neighbours.
    const byCode = new Map(sim.municipalities.map((m) => [m.code, m]))
    const chosen = byCode.get(pick)
    if (chosen && ground.has(pick)) {
      const nb = (chosen.neighbours ?? []).slice(0, 3)
      for (const code of [pick, ...nb.map((n) => n[0])]) {
        const a = ground.get(code)
        const b = mid.get(code)
        if (!a || !b) continue
        s.glow(a, 26, WARM)
        s.glow(b, 30, WARM)
        const bend = a.clone().lerp(b, 0.5).multiplyScalar(0.7)
        bend.y = (a.y + b.y) / 2
        s.line(
          new THREE.QuadraticBezierCurve3(a, bend, b).getPoints(30),
          WARM,
          0.9,
        )
        tags.push({
          at: b,
          lines: [byCode.get(code)!.name],
          tone: 'warm',
          anchor: 'right',
          dy: ([pick, ...nb.map((n) => n[0])].indexOf(code) - 1.5) * 16,
        })
      }
      tags.push({
        at: ground.get(pick)!,
        lines: [
          `${chosen.name.toUpperCase()} · its nearest in indicators:`,
          ...nb.map(
            (n) => `${byCode.get(n[0])?.name} · ${Math.round(n[2])} km away`,
          ),
        ],
        head: true,
        tone: 'warm',
        anchor: 'left',
        dy: 30,
      })
    }
    tags.push({
      at: new THREE.Vector3(200, 0, 60),
      lines: ['GEOGRAPHY', 'where they are'],
      head: true,
      anchor: 'left',
    })
    tags.push({
      at: new THREE.Vector3(270, L1, 0),
      lines: ['SIMILARITY', '12 indicators, PCA, k = 4 groups'],
      head: true,
      anchor: 'left',
    })
    return tags
  }

  return (
    <AtlasPage
      current="#sweden-atlas-c"
      kicker={
        <>
          <b>C</b> · The Modelled Country
        </>
      }
      question="How does the statistical definition of similarity change our understanding of Sweden?"
      line="The same municipalities, drawn three times. Below: where they are. Middle: where twelve indicators put them. Above: another defensible model."
      revealed={revealed}
      revealedFrom={SLOTS.similarity.path}
      gap="Groups are constructed, not identities. Another defensible set of variables would draw another country."
      keyItems={
        names
          ? Object.entries(names).map(([g, n]) => ({
              label: n[0],
              colour: GROUP_HEX[Number(g)],
            }))
          : undefined
      }
      foot="Source: SCB and Kolada · threads join each municipality to its place in similarity space"
      view={{ camera: [760, 560, 980], target: [40, 160, 0] }}
      slots={states}
      loading={loading}
      build={build}
    />
  )
}
