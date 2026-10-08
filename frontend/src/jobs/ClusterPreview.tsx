import { useMemo } from 'react'
import { l } from '../i18n'
import { projectCoordinates, useClusterPreview } from './clusterData'

// Display-space density of real points; these contours are not cluster boundaries.
function densityContours(coords: Map<string, number[]>) {
  const step = 6,
    nx = 121,
    ny = 88,
    bandwidth = 28
  const field = new Float64Array(nx * ny)
  for (const [x, y] of coords.values()) {
    const x0 = Math.max(0, Math.floor((x - bandwidth * 3) / step))
    const x1 = Math.min(nx - 1, Math.ceil((x + bandwidth * 3) / step))
    const y0 = Math.max(0, Math.floor((y - bandwidth * 3) / step))
    const y1 = Math.min(ny - 1, Math.ceil((y + bandwidth * 3) / step))
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        field[j * nx + i] += Math.exp(
          -((i * step - x) ** 2 + (j * step - y) ** 2) / (2 * bandwidth ** 2),
        )
      }
  }
  const maximum = Math.max(...field)
  if (!maximum) return []
  return [0.025, 0.055, 0.1, 0.18, 0.3, 0.48].map((fraction) => {
    const level = fraction * maximum
    let path = ''
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const vertices = [
          [i, j],
          [i + 1, j],
          [i + 1, j + 1],
          [i, j + 1],
        ]
        const intersections: number[][] = []
        for (let edge = 0; edge < 4; edge++) {
          const [ax, ay] = vertices[edge],
            [bx, by] = vertices[(edge + 1) % 4]
          const a = field[ay * nx + ax],
            b = field[by * nx + bx]
          if (a >= level === b >= level) continue
          const t = (level - a) / (b - a)
          intersections.push([
            (ax + t * (bx - ax)) * step,
            (ay + t * (by - ay)) * step,
          ])
        }
        for (let k = 0; k + 1 < intersections.length; k += 2) {
          const [a, b] = [intersections[k], intersections[k + 1]]
          path += `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`
        }
      }
    return path
  })
}

export default function ClusterPreview({
  atmospheric = false,
}: {
  atmospheric?: boolean
}) {
  const points = useClusterPreview()
  const coords = useMemo(
    () =>
      projectCoordinates(
        points,
        atmospheric ? 720 : 600,
        atmospheric ? 520 : 220,
        points.filter((p) => p.cluster !== -1),
      ),
    [points, atmospheric],
  )
  const contours = useMemo(
    () => (atmospheric ? densityContours(coords) : []),
    [coords, atmospheric],
  )
  if (!points.length)
    return atmospheric ? null : (
      <p className="ds-small">
        {l(
          'The semantic map will appear when the analysis is published.',
          'Den semantiska kartan visas när analysen är publicerad.',
        )}
      </p>
    )
  return (
    <a
      className={`cluster-preview${atmospheric ? ' atmospheric' : ''}`}
      href="#jobb-kluster"
      aria-label={l(
        'Explore the semantic map of tech job advertisements',
        'Utforska den semantiska kartan över IT-annonser',
      )}
    >
      <svg
        viewBox={atmospheric ? '0 0 720 520' : '0 0 600 220'}
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth=".6"
          opacity=".5"
        >
          {contours.map((path, i) => (
            <path key={i} d={path} />
          ))}
        </g>
        {points.map((p) => {
          const [x, y] = coords.get(p.id)!
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={atmospheric ? 1.05 : 1.5}
              style={{
                fill: p.cluster === -1 ? 'var(--line-strong)' : 'var(--ink-2)',
              }}
              opacity={p.cluster === -1 ? 0.35 : 0.7}
            />
          )
        })}
      </svg>
      {!atmospheric && (
        <span className="ds-label">
          {l(
            'JobTech, UMAP, Sample of real advertisements',
            'JobTech, UMAP, Urval av verkliga annonser',
          )}{' '}
        </span>
      )}
    </a>
  )
}
