/**
 * D · The Geography of Belonging: four floors of Sweden, one per concept the study keeps apart.
 * Availability (service points per 10,000, libraries as lights), accessibility (travel time
 * from travel_time.json, else area per service point, labelled as distance), participation
 * (visits per inhabitant) and belonging (belonging.json). A floor without data is an outline.
 * One municipality (?kommun=, default Pajala) is traced up through all four.
 */
import { useState } from 'react'
import * as THREE from 'three'
import { useRoute } from '../../router'
import type { Geometry } from '../map'
import { AtlasPage } from './AtlasPage'
import { MuniSelect } from './controls'
import { extrude, municipalityShapes, ramp, ranks } from './geo'
import { slot, SLOTS, useSlots } from './slots'
import { GAP, WARM, type Space, type Tag } from './space'

type Row = {
  code: string
  year: number
  service_points_rate: number | null
  visits_rate: number | null
  km2_per_service_point: number | null
}
type Bel = { years: number[]; rows: Row[] }
type Libs = { libraries: { x: number; y: number }[] }
type ByCode = {
  rows: { code: string; minutes?: number; value?: number }[]
  measure?: string
  source?: string
  year?: number
}
type Floor = {
  name: string
  note: string
  values: Map<string, number> | null
  invert?: boolean
  fmt?: (v: number) => string
}

const S = 0.026

export default function AtlasBelonging() {
  const route = useRoute()
  const { states, loading } = useSlots([
    'geometry',
    'similarity',
    'belonging',
    'libraries',
    'travelTime',
    'belongingSurvey',
  ])
  const geo = slot<Geometry>(states, 'geometry')
  const bel = slot<Bel>(states, 'belonging')
  const libs = slot<Libs>(states, 'libraries')
  const travel = slot<ByCode>(states, 'travelTime')
  const names = new Map(
    (
      slot<{ municipalities: { code: string; name: string }[] }>(
        states,
        'similarity',
      )?.municipalities ?? []
    ).map((m) => [m.code, m.name]),
  )
  const survey = slot<ByCode>(states, 'belongingSurvey')
  const year = bel ? bel.years[bel.years.length - 1] : null
  const rows = (bel?.rows ?? []).filter((r) => r.year === year)
  const col = (k: keyof Row) =>
    new Map(
      rows.filter((r) => r[k] != null).map((r) => [r.code, r[k] as number]),
    )
  const fromFile = (f: ByCode | null, k: 'minutes' | 'value') =>
    f
      ? new Map(
          f.rows
            .filter((r) => r[k] != null)
            .map((r) => [r.code, r[k] as number]),
        )
      : null

  const floors: Floor[] = [
    {
      name: 'AVAILABILITY',
      note: 'staffed service points per 10,000',
      values: bel ? col('service_points_rate') : null,
      fmt: (v) => `${v.toFixed(1)} points per 10,000`,
    },
    travel
      ? {
          name: 'ACCESSIBILITY',
          note: 'travel time to the nearest library',
          values: fromFile(travel, 'minutes'),
          invert: true,
          fmt: (v) => `${Math.round(v)} min to a library`,
        }
      : {
          name: 'ACCESSIBILITY',
          note: 'km² per service point · distance, not travel time',
          values: bel ? col('km2_per_service_point') : null,
          invert: true,
          fmt: (v) => `${Math.round(v).toLocaleString('en')} km² per point`,
        },
    {
      name: 'PARTICIPATION',
      note: 'visits per inhabitant',
      values: bel ? col('visits_rate') : null,
      fmt: (v) => `${v.toFixed(1)} visits per inhabitant`,
    },
    survey
      ? {
          name: 'BELONGING',
          note: `${survey.measure ?? 'measure'} · ${survey.source ?? ''}`,
          values: fromFile(survey, 'value'),
          fmt: (v) => `belonging: ${v.toFixed(1)}`,
        }
      : {
          name: 'BELONGING',
          note: `not measured by any source here · awaiting ${SLOTS.belongingSurvey.path.split('/').pop()}`,
          values: null,
        },
  ]
  const avail = floors[0].values
  const area = col('km2_per_service_point')
  const revealed =
    avail && area.size
      ? `In ${year}, staffed service points per 10,000 residents range from ${Math.min(...avail.values()).toFixed(1)} to ${Math.max(...avail.values()).toFixed(1)}, and the area each serves from ${Math.round(Math.min(...area.values()))} to ${Math.round(Math.max(...area.values())).toLocaleString('en')} km².`
      : null
  const [pick, setPick] = useState(route.params.get('kommun') ?? '2521')
  const [solo, setSolo] = useState<number | null>(null)
  const dimFloor = (i: number) => solo != null && solo !== i

  const build = (s: Space): Tag[] => {
    const tags: Tag[] = []
    if (!geo) return tags
    const { munis, toWorld } = municipalityShapes(geo, S)
    floors.forEach((f, i) => {
      const y = i * 125
      const rank = f.values ? ranks([...f.values.values()]) : null
      let missing = 0
      for (const m of munis) {
        if (!f.values || !rank) {
          s.scene.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(extrude(m, 0.5, y), 20),
              new THREE.LineBasicMaterial({
                color: 0x8e9ab6,
                transparent: true,
                opacity: dimFloor(i) ? 0.06 : 0.28,
              }),
            ),
          )
          continue
        }
        const v = f.values.get(m.code)
        if (v == null) missing++
        const t = v == null ? 0 : f.invert ? 1 - rank(v) : rank(v)
        const op = (v == null ? 0.6 : 1) * (dimFloor(i) ? 0.1 : 1)
        s.scene.add(
          s.pickable(
            new THREE.Mesh(
              extrude(m, 3, y),
              new THREE.MeshStandardMaterial({
                color: v == null ? '#2b2a31' : ramp(t),
                roughness: 0.9,
                transparent: op < 1,
                opacity: op,
                depthWrite: op === 1,
              }),
            ),
            () => setPick(m.code),
          ),
        )
      }
      s.web(y - 2, 330, f.values ? 0.035 : 0.06, 4, 24)
      tags.push({
        at: new THREE.Vector3(150, y, -40),
        lines: [f.name, f.note + (missing ? ` · ${missing} not reported` : '')],
        head: true,
        tone: f.values ? 'mono' : 'gap',
        anchor: 'left',
        dx: 28,
        pressed: solo === i,
        onClick: () => setSolo((x) => (x === i ? null : i)),
      })
    })
    if (libs) {
      const pos = new Float32Array(libs.libraries.length * 3)
      libs.libraries.forEach((p, i) => {
        const [x, z] = toWorld(p.x, p.y)
        pos.set([x, 4.5, z], i * 3)
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      s.scene.add(
        new THREE.Points(
          g,
          new THREE.PointsMaterial({
            color: WARM,
            size: 2,
            sizeAttenuation: false,
            transparent: true,
            opacity: dimFloor(0) ? 0.1 : 1,
          }),
        ),
      )
    }
    const m = munis.find((x) => x.code === pick)
    if (m) {
      const [px, pz] = m.c
      floors.forEach((f, i) => {
        const has = f.values?.has(pick)
        s.glow(
          new THREE.Vector3(px, i * 125 + 5, pz),
          has ? 20 : 14,
          has ? WARM : GAP,
        )
        if (i < floors.length - 1) {
          const next = floors[i + 1].values?.has(pick)
          s.line(
            [
              new THREE.Vector3(px, i * 125 + 4, pz),
              new THREE.Vector3(px, (i + 1) * 125, pz),
            ],
            next ? WARM : 0x8e9ab6,
            0.8,
            next ? undefined : [4, 4],
          )
        }
      })
      tags.push({
        at: new THREE.Vector3(px, 3 * 125, pz),
        lines: [(names.get(pick) ?? pick).toUpperCase()],
        head: true,
        tone: 'warm',
        anchor: 'above',
        dy: -12,
      })
    }
    return tags
  }

  return (
    <AtlasPage
      current="#sweden-atlas-d"
      kicker={
        <>
          <b>D</b> · The Geography of Belonging
        </>
      }
      question="Can access to community and public participation be measured?"
      line={`Four layers that are easy to confuse. Each floor is one of them, for every municipality${year ? `, ${year}` : ''}.`}
      revealed={revealed}
      revealedFrom={SLOTS.belonging.path}
      gap={
        survey
          ? 'Belonging is measured here by one survey; it is not the same as using a library, and the floors are not added together.'
          : 'The top floor is empty. Library statistics cannot say whether anyone feels they belong.'
      }
      foot={`Lights: ${libs ? libs.libraries.length.toLocaleString('en') : 'no'} public libraries with coordinates · ramp: rank among municipalities, higher = more`}
      view={{ camera: [820, 640, 900], target: [60, 170, -60] }}
      slots={states}
      loading={loading}
      build={build}
      rebuild={`${pick}|${solo ?? ''}`}
      info={
        geo && (
          <>
            <span className="is-head">
              {(names.get(pick) ?? pick).toUpperCase()}
            </span>
            {floors.map((f) =>
              f.values?.has(pick) && f.fmt ? (
                <span key={f.name}>{f.fmt(f.values.get(pick)!)}</span>
              ) : (
                <span key={f.name} className="is-gap">
                  {f.name.toLowerCase()}: no data
                </span>
              ),
            )}
            <MuniSelect
              label="Choose a municipality"
              options={[...names].map(([code, name]) => ({ code, name }))}
              value={pick}
              onChange={(c) => c && setPick(c)}
            />
          </>
        )
      }
    />
  )
}
