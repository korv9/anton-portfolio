/**
 * The degree project as a sieve: an outer ring of points for the 21,000+ incidents (one point per
 * hundred), drawn inward to the 121 clusters HDBSCAN found, and at the centre the 72 clusters
 * without a link to an existing problem record, the review candidates. The figures are the case
 * study's; the incident texts are internal and not shown, so the points stand for counts only.
 */
import { l } from '../i18n'

const C = 400
const INCIDENTS = 21000
const CLUSTERS = 121
const CANDIDATES = 72

const polar = (r: number, a: number) => [
  C + r * Math.cos(a),
  C + r * Math.sin(a),
]

export default function ThesisSieve() {
  const outer = Array.from({ length: INCIDENTS / 100 }, (_, i) => {
    const a = (i / (INCIDENTS / 100)) * Math.PI * 2
    const r = 330 + ((i * 37) % 11) * 3
    return { a, r }
  })
  const clusters = Array.from({ length: CLUSTERS }, (_, i) => {
    const a = (i / CLUSTERS) * Math.PI * 2 + 0.013
    // Which clusters are candidates is not published; they are spread evenly round the ring.
    return { a, candidate: (i * CANDIDATES) % CLUSTERS < CANDIDATES }
  })
  return (
    <div className="sieve">
      <svg
        viewBox="0 0 800 800"
        role="img"
        aria-label={l(
          'More than 21,000 incidents, clustered into 121 groups, of which 72 had no link to an existing problem record.',
          'Över 21 000 incidenter, klustrade till 121 grupper, varav 72 saknade koppling till en befintlig problempost.',
        )}
      >
        <rect width="800" height="800" className="dtree-ground" />
        {[300, 220, 150].map((r) => (
          <circle key={r} cx={C} cy={C} r={r} className="sieve-ring" />
        ))}
        {outer.map((p, i) => {
          const [x, y] = polar(p.r, p.a)
          const target = clusters[i % CLUSTERS]
          const [tx, ty] = polar(220, target.a)
          return (
            <g key={i}>
              <path
                d={`M ${x.toFixed(1)} ${y.toFixed(1)} Q ${polar(
                  270,
                  (p.a + target.a) / 2,
                )
                  .map((v) => v.toFixed(1))
                  .join(' ')} ${tx.toFixed(1)} ${ty.toFixed(1)}`}
                className="sieve-thread"
                style={{ ['--i' as string]: i }}
              />
              <circle cx={x} cy={y} r={1.6} className="sieve-incident" />
            </g>
          )
        })}
        {clusters.map((c, i) => {
          const [x, y] = polar(220, c.a)
          const [ix, iy] = polar(150, c.a)
          return (
            <g
              key={i}
              className={c.candidate ? 'sieve-candidate' : 'sieve-cluster'}
            >
              {c.candidate && (
                <line
                  x1={x}
                  y1={y}
                  x2={ix}
                  y2={iy}
                  className="sieve-pull"
                  style={{ ['--i' as string]: i }}
                />
              )}
              <circle cx={x} cy={y} r={3.4} />
              {c.candidate && (
                <circle cx={ix} cy={iy} r={2.2} className="sieve-core-dot" />
              )}
            </g>
          )
        })}
        <circle cx={C} cy={C} r={112} className="sieve-core" />
        <text x={C} y={C - 14} textAnchor="middle" className="sieve-big">
          {CANDIDATES}
        </text>
        <text x={C} y={C + 14} textAnchor="middle" className="sieve-small">
          {l('review candidates', 'granskningskandidater')}
        </text>
        <text x={C} y={34} textAnchor="middle" className="sieve-small">
          {l(
            '21,000+ incidents · one point per hundred',
            '21 000+ incidenter · en punkt per hundra',
          )}
        </text>
        <text x={C} y={C - 230} textAnchor="middle" className="sieve-small">
          {l('121 clusters (HDBSCAN)', '121 kluster (HDBSCAN)')}
        </text>
      </svg>
    </div>
  )
}
