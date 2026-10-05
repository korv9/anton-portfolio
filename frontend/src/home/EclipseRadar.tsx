/**
 * The eclipse radar: a dark disc with a burning rim, and from the rim one bundle of threads per
 * headline skill. Every thread is one real thing (the skill in the CV, or a job or project that
 * uses it), so a bundle reaches as far as its evidence; the tips are joined into a radar shape.
 * The threads grow out of the rim when the disc comes into view, then breathe; pointing at a
 * skill names where it is used, and choosing it opens the skills.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import { EXPERIENCE, SKILLS } from './orbitContent'
import { PROJECTS } from '../projects/projectRegistry'
import { skillAxes, type Axis } from './radar'

const C = 400
const RIM = 82
const REACH = 250
const DISC = 292

const polar = (r: number, a: number): [number, number] => [
  C + r * Math.cos(a),
  C + r * Math.sin(a),
]
const fmt = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`

/** A small seeded generator, so the threads look the same on every visit. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

type Thread = { d: string; branches: string[]; end: [number, number] }

/** One thread: a jittered walk outwards from the rim, with a few short offshoots. */
function thread(angle: number, length: number, rand: () => number): Thread {
  const steps = 16
  const normal = angle + Math.PI / 2
  let drift = 0
  const pts: [number, number][] = []
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    drift += (rand() - 0.5) * (1.5 + 6 * t)
    drift *= 0.82
    const [x, y] = polar(RIM + 1 + t * length, angle)
    pts.push([x + Math.cos(normal) * drift, y + Math.sin(normal) * drift])
  }
  const branches: string[] = []
  const count = length > 60 ? 2 + Math.floor(rand() * 2) : 1
  for (let b = 0; b < count; b++) {
    const at = pts[Math.floor((0.35 + rand() * 0.5) * steps)]
    const side = rand() > 0.5 ? 1 : -1
    const a = angle + side * (0.45 + rand() * 0.5)
    const len = 7 + rand() * 18
    const mid: [number, number] = [
      at[0] + Math.cos(a) * len * 0.5 + (rand() - 0.5) * 3,
      at[1] + Math.sin(a) * len * 0.5 + (rand() - 0.5) * 3,
    ]
    const end: [number, number] = [
      at[0] + Math.cos(a + side * 0.2) * len,
      at[1] + Math.sin(a + side * 0.2) * len,
    ]
    branches.push(`M ${fmt(at)} L ${fmt(mid)} L ${fmt(end)}`)
  }
  return {
    d: `M ${pts.map(fmt).join(' L ')}`,
    branches,
    end: pts[pts.length - 1],
  }
}

function useAxes(): Axis[] {
  return useMemo(() => {
    const evidence = [
      ...EXPERIENCE.map((j) => ({
        name: j.org,
        text: [...j.tech, ...j.did.map((d) => d.en), j.effect.en].join(' · '),
      })),
      ...PROJECTS.map((p) => ({
        name: l(p.title.en, p.title.sv),
        text: [...p.tech, p.built.en].join(' · '),
      })),
    ]
    return skillAxes(
      SKILLS.map((g) => ({ group: l(g.group.en, g.group.sv), skills: g.top })),
      evidence,
    )
  }, [])
}

export default function EclipseRadar({ onChoose }: { onChoose: () => void }) {
  const id = useId().replace(/:/g, '')
  const axes = useAxes()
  const root = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  const n = axes.length
  const max = Math.max(...axes.map((a) => a.value))
  const unit = (REACH - RIM) / max
  const angleOf = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / n

  const drawn = useMemo(() => {
    const rand = seeded(29)
    return axes.map((axis, i) => {
      const angle = angleOf(i)
      const length = axis.value * unit
      // One thread per piece of evidence; the first reaches the tip, the rest fall short.
      const threads = Array.from({ length: axis.value }, (_, j) => {
        const spread = axis.value === 1 ? 0 : j / (axis.value - 1) - 0.5
        const a = angle + spread * 0.16 + (rand() - 0.5) * 0.03
        const len = j === 0 ? length : length * (0.55 + rand() * 0.4)
        return thread(a, len, rand)
      })
      return { tip: polar(RIM + length, angle), threads }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axes])

  // Threads from the same job or project are joined, like a constellation across the disc.
  const links = useMemo(() => {
    const byUse = new Map<string, { axis: number; end: [number, number] }[]>()
    axes.forEach((axis, i) =>
      axis.uses.forEach((use, k) => {
        const list = byUse.get(use) ?? []
        list.push({ axis: i, end: drawn[i].threads[k + 1].end })
        byUse.set(use, list)
      }),
    )
    return [...byUse.entries()].flatMap(([use, stars]) =>
      stars.slice(1).map((b, k) => {
        const a = stars[k]
        const mid: [number, number] = [
          (a.end[0] + b.end[0]) / 2,
          (a.end[1] + b.end[1]) / 2,
        ]
        const pull: [number, number] = [
          C + (mid[0] - C) * 0.6,
          C + (mid[1] - C) * 0.6,
        ]
        return {
          use,
          axes: [a.axis, b.axis],
          d: `M ${fmt(a.end)} Q ${fmt(pull)} ${fmt(b.end)}`,
        }
      }),
    )
  }, [axes, drawn])

  // Stars in the outer band, placed by the same seeded generator, so they never move.
  const stars = useMemo(() => {
    const rand = seeded(101)
    return Array.from({ length: 28 }, () => {
      const r = REACH + 8 + rand() * (DISC - REACH - 24)
      const [x, y] = polar(r, rand() * Math.PI * 2)
      return { x, y, s: 1.5 + rand() * 3, delay: rand() * 6 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axes])

  useEffect(() => {
    const node = root.current
    if (!node || !('IntersectionObserver' in window)) return setOn(true)
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        setOn(true)
      },
      { threshold: 0.25 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // The group names, written along the inside of the disc like an inscription.
  const groups = [...new Set(axes.map((a) => a.group))].map((group) => {
    const idx = axes.flatMap((a, i) => (a.group === group ? [i] : []))
    const mid = (idx[0] + idx[idx.length - 1]) / 2
    return { group, offset: ((mid / n) * 100 + 100) % 100 }
  })
  const step = (Math.PI * 2) / n
  const groupSpans = [...new Set(axes.map((a) => a.group))].map((group) => {
    const idx = axes.flatMap((a, i) => (a.group === group ? [i] : []))
    const a0 = angleOf(idx[0]) - step / 2 + 0.04
    const a1 = angleOf(idx[idx.length - 1]) + step / 2 - 0.04
    const from = polar(276, a0)
    const to = polar(276, a1)
    const large = a1 - a0 > Math.PI ? 1 : 0
    return {
      group,
      from,
      to,
      gap: polar(276, a1 + 0.04),
      d: `M ${fmt(from)} A 276 276 0 ${large} 1 ${fmt(to)}`,
    }
  })
  const ring = 266
  const ringPath = `M ${C} ${C - ring} A ${ring} ${ring} 0 1 1 ${C - 0.01} ${C - ring}`
  const active = hover === null ? null : axes[hover]
  const total = axes.reduce((s, a) => s + a.value, 0)

  return (
    <div
      ref={root}
      className={`eclipse${on ? ' is-on' : ''}${active ? ' has-focus' : ''}`}
    >
      <svg
        className="eclipse-chart"
        viewBox="0 0 800 800"
        role="img"
        aria-label={l(
          `Radar of ${n} skills. Each thread is one real thing: the skill, or a job or project that uses it, ${total} in all.`,
          `Radar över ${n} kompetenser. Varje tråd är en riktig sak: kompetensen, eller ett jobb eller projekt där den används, ${total} totalt.`,
        )}
      >
        <defs>
          <radialGradient id={`${id}-void`}>
            <stop offset="0" stopColor="#000" />
            <stop offset="0.7" stopColor="#060607" />
            <stop offset="1" stopColor="#131315" />
          </radialGradient>
          <filter
            id={`${id}-chalk`}
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              seed="7"
            />
            <feDisplacementMap in="SourceGraphic" scale="2.6" result="rough" />
            <feGaussianBlur in="rough" stdDeviation="2.4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="rough" />
            </feMerge>
          </filter>
          <path id={`${id}-ring`} d={ringPath} />
        </defs>

        <circle cx={C} cy={C} r={DISC} fill={`url(#${id}-void)`} />
        <g className="eclipse-grid">
          {Array.from({ length: max }, (_, v) => (
            <circle key={v} cx={C} cy={C} r={RIM + (v + 1) * unit} />
          ))}
          {axes.map((_, i) => {
            const [x1, y1] = polar(RIM, angleOf(i))
            const [x2, y2] = polar(REACH, angleOf(i))
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          })}
        </g>
        <g className="eclipse-ticks">
          {Array.from({ length: 120 }, (_, k) => {
            const a = (k / 120) * Math.PI * 2
            const long = k % 10 === 0
            const [x1, y1] = polar(DISC - 1, a)
            const [x2, y2] = polar(DISC - (long ? 11 : 5), a)
            return (
              <line
                key={k}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={long ? 'is-long' : undefined}
              />
            )
          })}
        </g>
        <g className="eclipse-band">
          {groupSpans.map((g) => (
            <g key={g.group}>
              <path d={g.d} />
            </g>
          ))}
        </g>
        <g className="eclipse-numerals">
          {Array.from({ length: max }, (_, v) => (
            <text
              key={v}
              x={C - 7}
              y={C - RIM - (v + 1) * unit + 3}
              textAnchor="end"
            >
              {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][v]}
            </text>
          ))}
        </g>
        <g className="eclipse-glyphs">
          {groupSpans.map((g, k) => {
            const [x, y] = g.gap
            return (
              <g
                key={g.group}
                transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
              >
                <circle r={7} />
                {k % 5 === 0 && <circle r={2} className="is-fill" />}
                {k % 5 === 1 && (
                  <path
                    d="M -3 -6 A 6 6 0 1 0 -3 6 A 4.5 4.5 0 1 1 -3 -6 Z"
                    className="is-fill"
                  />
                )}
                {k % 5 === 2 && (
                  <path
                    d="M 0 -5 L 1.2 -1.2 L 5 0 L 1.2 1.2 L 0 5 L -1.2 1.2 L -5 0 L -1.2 -1.2 Z"
                    className="is-fill"
                  />
                )}
                {k % 5 === 3 && (
                  <path d="M 0 -7 A 7 7 0 0 1 0 7 Z" className="is-fill" />
                )}
                {k % 5 === 4 && <circle r={3.5} />}
              </g>
            )
          })}
        </g>
        <circle className="eclipse-corona" cx={C} cy={C} r={RIM + 11} />
        <g className="eclipse-stars">
          {stars.map((st, k) => (
            <path
              key={k}
              style={{ ['--d' as string]: `${st.delay.toFixed(2)}s` }}
              d={`M ${st.x.toFixed(1)} ${(st.y - st.s).toFixed(1)} L ${(st.x + st.s * 0.25).toFixed(1)} ${(st.y - st.s * 0.25).toFixed(1)} L ${(st.x + st.s).toFixed(1)} ${st.y.toFixed(1)} L ${(st.x + st.s * 0.25).toFixed(1)} ${(st.y + st.s * 0.25).toFixed(1)} L ${st.x.toFixed(1)} ${(st.y + st.s).toFixed(1)} L ${(st.x - st.s * 0.25).toFixed(1)} ${(st.y + st.s * 0.25).toFixed(1)} L ${(st.x - st.s).toFixed(1)} ${st.y.toFixed(1)} L ${(st.x - st.s * 0.25).toFixed(1)} ${(st.y - st.s * 0.25).toFixed(1)} Z`}
            />
          ))}
        </g>
        <circle className="eclipse-orbit" cx={C} cy={C} r={DISC - 10} />
        <g className="eclipse-satellite is-slow">
          <circle cx={C} cy={C - (DISC - 10)} r={4} />
        </g>
        <circle
          className="eclipse-orbit is-inner"
          cx={C}
          cy={C}
          r={REACH + 6}
        />
        <g className="eclipse-satellite is-fast">
          <circle cx={C} cy={C + REACH + 6} r={2.6} />
        </g>
        <text className="eclipse-inscription">
          {groups.map((g) => (
            <textPath
              key={g.group}
              href={`#${id}-ring`}
              startOffset={`${g.offset}%`}
              textAnchor="middle"
            >
              {g.group.toUpperCase()}
            </textPath>
          ))}
        </text>

        <polygon
          className="eclipse-shape"
          points={drawn.map((d) => fmt(d.tip)).join(' ')}
        />

        <g className="eclipse-links">
          {links.map((link, k) => (
            <path
              key={k}
              d={link.d}
              pathLength={1}
              style={{ ['--k' as string]: k }}
              className={
                hover !== null && link.axes.includes(hover)
                  ? 'is-active'
                  : undefined
              }
            />
          ))}
        </g>
        <g className="eclipse-threads" filter={`url(#${id}-chalk)`}>
          {drawn.map((d, i) => (
            <g
              key={axes[i].skill}
              className={`eclipse-axis${hover === i ? ' is-active' : ''}`}
              style={{ ['--i' as string]: i }}
            >
              {d.threads.map((t, j) => (
                <g key={j} style={{ ['--j' as string]: j }}>
                  <path className="eclipse-thread" d={t.d} pathLength={1} />
                  {t.branches.map((b, k) => (
                    <path
                      key={k}
                      className="eclipse-branch"
                      d={b}
                      pathLength={1}
                    />
                  ))}
                </g>
              ))}
              <circle
                className="eclipse-tip"
                cx={d.tip[0]}
                cy={d.tip[1]}
                r={2.6}
              />
              {d.threads.slice(1).map((t, k) => (
                <circle
                  key={k}
                  className="eclipse-node"
                  cx={t.end[0]}
                  cy={t.end[1]}
                  r={3.2}
                />
              ))}
            </g>
          ))}
          <circle className="eclipse-rim" cx={C} cy={C} r={RIM} />
        </g>
        <circle cx={C} cy={C} r={RIM - 3} fill="#000" />

        {axes.map((axis, i) => {
          const a = angleOf(i)
          const [x, y] = polar(DISC + 16, a)
          const cos = Math.cos(a)
          const anchor =
            Math.abs(cos) < 0.06 ? 'middle' : cos > 0 ? 'start' : 'end'
          const half = Math.PI / n
          const hit = `M ${fmt(polar(RIM, a - half))} L ${fmt(polar(DISC + 60, a - half))} A ${DISC + 60} ${DISC + 60} 0 0 1 ${fmt(polar(DISC + 60, a + half))} L ${fmt(polar(RIM, a + half))} Z`
          return (
            <g
              key={axis.skill}
              className={`eclipse-label${hover === i ? ' is-active' : ''}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={onChoose}
            >
              <path className="eclipse-hit" d={hit} />
              <text
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline={
                  Math.sin(a) > 0.6
                    ? 'hanging'
                    : Math.sin(a) < -0.6
                      ? 'auto'
                      : 'middle'
                }
              >
                {axis.skill}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="eclipse-caption" aria-live="polite">
        {active ? (
          <>
            <b>{active.skill}</b> ·{' '}
            {active.uses.length
              ? active.uses.join(' · ')
              : l('in the CV', 'i CV:t')}
          </>
        ) : (
          l('Point at a skill.', 'Peka på en kompetens.')
        )}
      </p>
      <ul className="eclipse-list">
        {axes.map((a) => (
          <li key={a.skill}>
            {a.skill}:{' '}
            {a.uses.length ? a.uses.join(', ') : l('in the CV', 'i CV:t')}
          </li>
        ))}
      </ul>
    </div>
  )
}
