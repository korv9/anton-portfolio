/**
 * How well the synergy model's predictions hold, as a scatter with zones: every point is a
 * tenth of the test pairs, the model's mean prediction across, the measured mean up, with the
 * middle half of the measurements as a whisker. On the diagonal the model is right; the shaded
 * zones above and below mark where it is too cautious or promises too much. One colour per
 * way of splitting train and test; pick one to bring it forward.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { Feature, Pick, useTip, useWidth } from '../charts/feature/Feature'

type Point = {
  decile: number
  pred: number
  obs: number
  obs_q25?: number
  obs_q75?: number
  n?: number
  scheme: string
}
// The site's data-series tokens, in fixed order.
const COLOURS = [
  'var(--data-blue)',
  'var(--data-rust)',
  'var(--data-green)',
  'var(--data-purple)',
]
const TOLERANCE = 1
const f1 = (v: number) =>
  v.toLocaleString('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

export default function CalibrationScatter({
  points,
  splits,
}: {
  points: Point[]
  /** [key, English, Swedish] per split, in order. */
  splits: [string, string, string][]
}) {
  const shown = splits.filter(([k]) => points.some((p) => p.scheme === k))
  const [focus, setFocus] = useState<string>('all')
  const [ref, width] = useWidth<HTMLDivElement>()
  const { box, show, hide, tip } = useTip()
  if (!shown.length) return null
  const name = (k: string) => {
    const s = shown.find(([key]) => key === k)
    return s ? l(s[1], s[2]) : k
  }
  const colour = (k: string) =>
    COLOURS[shown.findIndex(([key]) => key === k) % COLOURS.length]
  const error = (k: string) => {
    const ps = points.filter((p) => p.scheme === k)
    return ps.reduce((s, p) => s + Math.abs(p.obs - p.pred), 0) / ps.length
  }
  const best = [...shown].sort((a, b) => error(a[0]) - error(b[0]))[0][0]
  const worst = [...shown].sort((a, b) => error(b[0]) - error(a[0]))[0][0]

  const narrow = width < 560
  const H = narrow ? 320 : 400
  const pad = { l: 44, r: 12, t: 12, b: 38 }
  const values = points.flatMap((p) => [
    p.pred,
    p.obs,
    p.obs_q25 ?? p.obs,
    p.obs_q75 ?? p.obs,
  ])
  const lo = Math.floor(Math.min(...values) / 5) * 5
  const hi = Math.ceil(Math.max(...values) / 5) * 5
  const x = (v: number) =>
    pad.l + ((v - lo) / (hi - lo)) * (width - pad.l - pad.r)
  const y = (v: number) =>
    pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
  const ticks = Array.from({ length: (hi - lo) / 5 + 1 }, (_, i) => lo + i * 5)

  return (
    <Feature
      id="kalibrering"
      title={l(
        `On the diagonal the model is right: ${name(best).toLowerCase()} is off by ${f1(error(best))} ZIP on average, ${name(worst).toLowerCase()} by ${f1(error(worst))}.`,
        `På diagonalen har modellen rätt: ${name(best).toLowerCase()} missar med ${f1(error(best))} ZIP i snitt, ${name(worst).toLowerCase()} med ${f1(error(worst))}.`,
      )}
      lead={l(
        `Each point is a tenth of the test pairs: across, the model's mean predicted synergy (ZIP); up, what the lab measured, with a whisker for the middle half of the measurements. Within ±${TOLERANCE} of the diagonal counts as right; above it the model was too cautious, below it promised too much. One colour per test: pick one to bring it forward.`,
        `Varje punkt är en tiondel av testparen: i sidled modellens förutsagda synergi i snitt (ZIP), i höjdled vad labbet mätte, med ett streck för mittersta hälften av mätningarna. Inom ±${TOLERANCE} från diagonalen räknas som rätt; ovanför var modellen för försiktig, nedanför lovade den för mycket. En färg per test: välj ett för att lyfta fram det.`,
      )}
      controls={
        <Pick
          label={l('Test', 'Test')}
          value={focus}
          options={[
            { value: 'all', label: l('All', 'Alla') },
            ...shown.map(([k]) => ({ value: k, label: name(k) })),
          ]}
          onChange={setFocus}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Test', 'Test')}</th>
              <th className="num">{l('Tenth', 'Tiondel')}</th>
              <th className="num">{l('Predicted', 'Förutsagt')}</th>
              <th className="num">{l('Measured', 'Uppmätt')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={`${p.scheme}-${p.decile}`}>
                <td>{name(p.scheme)}</td>
                <td className="num">{p.decile + 1}</td>
                <td className="num">{f1(p.pred)}</td>
                <td className="num">{f1(p.obs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'DrugCombDB and DepMap; the model’s held-out test sets (eval_calibration)',
        'DrugCombDB och DepMap; modellens undanhållna testmängder (eval_calibration)',
      )}
    >
      <ul className="feature-legend">
        {shown.map(([k]) => (
          <li key={k} style={{ ['--c' as string]: colour(k) }}>
            {name(k)} · {l('off by', 'missar')} {f1(error(k))}
          </li>
        ))}
      </ul>
      <div
        className="calib"
        ref={(el) => {
          ref(el)
          box.current = el
        }}
        onMouseLeave={hide}
      >
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={l(
            'Predicted against measured synergy',
            'Förutsagd mot uppmätt synergi',
          )}
        >
          <defs>
            <clipPath id="calib-clip">
              <rect
                x={pad.l}
                y={pad.t}
                width={width - pad.l - pad.r}
                height={H - pad.t - pad.b}
              />
            </clipPath>
          </defs>
          <g clipPath="url(#calib-clip)">
            {/* Above the band: measured more than predicted. Below: less. */}
            <polygon
              className="calib-zone above"
              points={`${x(lo)},${y(lo + TOLERANCE)} ${x(hi)},${y(hi + TOLERANCE)} ${x(hi)},${y(hi + 50)} ${x(lo)},${y(hi + 50)}`}
            />
            <polygon
              className="calib-zone below"
              points={`${x(lo)},${y(lo - TOLERANCE)} ${x(hi)},${y(hi - TOLERANCE)} ${x(hi)},${y(lo - 50)} ${x(lo)},${y(lo - 50)}`}
            />
          </g>
          {ticks.map((t) => (
            <g key={t} className="calib-grid">
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {t}
              </text>
              <text x={x(t)} y={H - pad.b + 14} textAnchor="middle">
                {t}
              </text>
            </g>
          ))}
          <line
            className="calib-diagonal"
            x1={x(lo)}
            y1={y(lo)}
            x2={x(hi)}
            y2={y(hi)}
          />
          <text className="calib-zone-label" x={pad.l + 8} y={pad.t + 14}>
            {l('too cautious', 'för försiktig')} ↑
          </text>
          <text
            className="calib-zone-label"
            x={width - pad.r - 8}
            y={H - pad.b - 8}
            textAnchor="end"
          >
            ↓ {l('promised too much', 'lovade för mycket')}
          </text>
          <text
            className="calib-axis"
            x={(pad.l + width - pad.r) / 2}
            y={H - 4}
            textAnchor="middle"
          >
            {l('Predicted synergy (ZIP)', 'Förutsagd synergi (ZIP)')} →
          </text>
          <text
            className="calib-axis"
            transform={`translate(12 ${(pad.t + H - pad.b) / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {l('Measured (ZIP)', 'Uppmätt (ZIP)')} →
          </text>
          {points.map((p) => {
            const off = focus !== 'all' && focus !== p.scheme
            return (
              <g
                key={`${p.scheme}-${p.decile}`}
                className={`calib-point${off ? ' off' : ''}`}
                style={{ ['--c' as string]: colour(p.scheme) }}
                onPointerMove={(e) =>
                  show(
                    e,
                    <>
                      <b>
                        {name(p.scheme)} · {l('tenth', 'tiondel')}{' '}
                        {p.decile + 1}
                      </b>
                      {l('Predicted', 'Förutsagt')} {f1(p.pred)} ·{' '}
                      {l('measured', 'uppmätt')} {f1(p.obs)}
                      {p.obs_q25 != null && p.obs_q75 != null && (
                        <>
                          <br />
                          {l('middle half', 'mittersta hälften')}{' '}
                          {f1(p.obs_q25)} – {f1(p.obs_q75)}
                        </>
                      )}
                    </>,
                  )
                }
                onPointerDown={(e) =>
                  show(
                    e,
                    <>
                      <b>
                        {name(p.scheme)} · {l('tenth', 'tiondel')}{' '}
                        {p.decile + 1}
                      </b>
                      {l('Predicted', 'Förutsagt')} {f1(p.pred)} ·{' '}
                      {l('measured', 'uppmätt')} {f1(p.obs)}
                      {p.obs_q25 != null && p.obs_q75 != null && (
                        <>
                          <br />
                          {l('middle half', 'mittersta hälften')}{' '}
                          {f1(p.obs_q25)} – {f1(p.obs_q75)}
                        </>
                      )}
                    </>,
                  )
                }
              >
                {p.obs_q25 != null && p.obs_q75 != null && (
                  <line
                    x1={x(p.pred)}
                    x2={x(p.pred)}
                    y1={y(p.obs_q25)}
                    y2={y(p.obs_q75)}
                  />
                )}
                <circle cx={x(p.pred)} cy={y(p.obs)} r={5} />
              </g>
            )
          })}
        </svg>
        {tip}
      </div>
    </Feature>
  )
}
