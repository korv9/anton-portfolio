/**
 * Atlas start: Sweden's municipalities in 3D, coloured by similarity group and raised by
 * population, with the same country hanging below as an outline only (what no indicator
 * fills). The five studies float around it as doors.
 */
import { useState } from 'react'
import * as THREE from 'three'
import type { Geometry } from '../map'
import { AtlasPage } from './AtlasPage'
import { MuniSelect } from './controls'
import { extrude, municipalityShapes } from './geo'
import { slot, useSlots } from './slots'
import { WARM, type Space, type Tag } from './space'

export const GROUP_HEX = ['#E07A5F', '#3D9A8B', '#9B8BE0', '#C9A227']

type Sim = {
  summary?: { analysed: number }
  municipalities: {
    code: string
    name: string
    population: number | null
    finer?: number
  }[]
}

export const STUDIES = [
  {
    id: 'A',
    href: '#sweden-atlas-a',
    title: 'The Measured Society',
    q: 'What does Sweden measure, and what does it overlook?',
  },
  {
    id: 'B',
    href: '#sweden-atlas-b',
    title: 'The Quantified Worker',
    q: 'What kind of person does the labour market expect?',
  },
  {
    id: 'C',
    href: '#sweden-atlas-c',
    title: 'The Modelled Country',
    q: 'How does a definition of similarity change Sweden?',
  },
  {
    id: 'D',
    href: '#sweden-atlas-d',
    title: 'The Geography of Belonging',
    q: 'Can access to community be measured?',
  },
  {
    id: 'E',
    href: '#sweden-atlas-e',
    title: 'The Imagined Future',
    q: 'Different futures, or the present projected forward?',
  },
]

export default function AtlasHub() {
  const { states, loading } = useSlots([
    'geometry',
    'similarity',
    'similarityGroups',
  ])
  const [pick, setPick] = useState<string | null>(null)
  const names = slot<{
    splits: { role: string; names?: Record<string, [string, string]> }[]
  }>(states, 'similarityGroups')?.splits.find(
    (x) => x.role === 'finer split',
  )?.names
  const geo = slot<Geometry>(states, 'geometry')
  const sim = slot<Sim>(states, 'similarity')

  const chosen = sim?.municipalities.find((m) => m.code === pick)

  const build = (s: Space): Tag[] => {
    const tags: Tag[] = []
    const byCode = new Map((sim?.municipalities ?? []).map((m) => [m.code, m]))
    const pops = (sim?.municipalities ?? []).map((m) =>
      Math.log10(m.population || 1000),
    )
    const p0 = Math.min(...pops)
    const p1 = Math.max(...pops)
    if (geo) {
      const { munis } = municipalityShapes(geo, 0.04)
      for (const m of munis) {
        const d = byCode.get(m.code)
        // Without the similarity file the country is drawn flat and neutral, never guessed.
        const h = d?.population
          ? 3 + ((Math.log10(d.population) - p0) / (p1 - p0)) * 22
          : 2
        const colour =
          m.code === pick
            ? '#f2a65a'
            : d?.finer != null
              ? GROUP_HEX[d.finer]
              : '#4a4852'
        s.scene.add(
          s.pickable(
            new THREE.Mesh(
              extrude(m, h),
              new THREE.MeshStandardMaterial({
                color: colour,
                roughness: 0.85,
              }),
            ),
            () => setPick((c) => (c === m.code ? null : m.code)),
          ),
        )
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(extrude(m, 1, -230), 20),
          new THREE.LineBasicMaterial({
            color: 0x8e9ab6,
            transparent: true,
            opacity: 0.16,
          }),
        )
        s.scene.add(edge)
      }
      for (let i = 0; i < 70; i++) {
        const [x, z] = munis[Math.floor(s.rnd() * munis.length)].c
        s.line(
          [new THREE.Vector3(x, -4, z), new THREE.Vector3(x, -226, z)],
          0x8e9ab6,
          0.22,
          [3, 5],
        )
      }
      tags.push({
        at: new THREE.Vector3(40, 10, 330),
        lines: [
          'MEASURED',
          `${sim?.summary?.analysed ?? 'All'} municipalities · colour: similarity group`,
          'height: population',
        ],
        head: true,
        anchor: 'left',
        dy: 20,
      })
      tags.push({
        at: new THREE.Vector3(-40, -232, 330),
        lines: [
          'THE SAME COUNTRY, UNMEASURED',
          'outline only: what no indicator fills',
        ],
        tone: 'gap',
        anchor: 'right',
      })
    }
    s.web(-232, 420, 0.04)
    STUDIES.forEach((st, i) => {
      const a = -Math.PI * 0.1 + (i / 5) * Math.PI * 2
      const v = new THREE.Vector3(
        Math.cos(a) * 400 + 60,
        120,
        Math.sin(a) * 360,
      )
      s.glow(v, 46, WARM)
      s.line(
        [v, new THREE.Vector3(v.x * 0.35, 10, v.z * 0.35)],
        WARM,
        0.3,
        [5, 4],
      )
      tags.push({
        at: v,
        lines: [`${st.id}  ${st.title.toUpperCase()}`, st.q],
        head: true,
        tone: 'title',
        anchor: v.x > 330 ? 'right' : 'left',
        href: st.href,
      })
    })
    return tags
  }

  return (
    <AtlasPage
      current="#sweden-atlas"
      kicker="SWEDEN · Research atlas"
      question="What can data reveal about Swedish society, and what remains invisible?"
      line="Five studies of how Sweden is measured, categorised and modelled."
      revealed="Patterns, changes and differences that public data can show, each study with its own question."
      revealedFrom="the studies"
      gap="What the indicators leave out: missing years, choices of category, model assumptions, and experience no table records."
      foot="× Connections: how the five studies agree, contradict and leave gaps"
      view={{ camera: [420, 700, 1180], target: [60, -60, -20] }}
      slots={states}
      loading={loading}
      build={build}
      rebuild={pick ?? ''}
      info={
        sim && (
          <>
            {chosen ? (
              <>
                <span className="is-head">{chosen.name.toUpperCase()}</span>
                <span>
                  {chosen.finer != null
                    ? (names?.[String(chosen.finer)]?.[0] ??
                      `group ${chosen.finer}`)
                    : 'not in the similarity analysis'}
                </span>
                <a href={`#sweden-atlas-c?kommun=${chosen.code}`}>
                  See its nearest in C →
                </a>
              </>
            ) : (
              <span>Click a municipality to see its similarity group.</span>
            )}
            <MuniSelect
              label="Choose a municipality"
              options={sim.municipalities}
              value={pick}
              onChange={setPick}
            />
          </>
        )
      }
    />
  )
}
