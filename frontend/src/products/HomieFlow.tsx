/**
 * Homie API as a system drawing: the database at the core, the aggregation views around it, and
 * the API's route groups on the outer ring. Solid marks are implemented, dashed ones are
 * documented stubs, as the project's own status says; events flow in from the left. No household
 * data exists, so nothing here is a measurement.
 */
import { l } from '../i18n'

const C = 400
const polar = (r: number, a: number) => [
  C + r * Math.cos(a),
  C + r * Math.sin(a),
]

const ROUTES: { en: string; sv: string; done: boolean }[] = [
  { en: 'Auth', sv: 'Inloggning', done: true },
  { en: 'Password hashing', sv: 'Lösenordshashning', done: true },
  { en: 'Health checks', sv: 'Hälsokontroller', done: true },
  { en: 'Households', sv: 'Hushåll', done: false },
  { en: 'Tasks', sv: 'Uppgifter', done: false },
  { en: 'Completions', sv: 'Utförda sysslor', done: false },
  { en: 'Analytics', sv: 'Analys', done: false },
]
const VIEWS = [
  { en: 'Weekly workload', sv: 'Veckobelastning' },
  { en: 'Fairness', sv: 'Rättvisa' },
  { en: 'Cadence', sv: 'Rytm' },
]

export default function HomieFlow() {
  return (
    <div className="sieve">
      <svg
        viewBox="0 0 800 800"
        role="img"
        aria-label={l(
          'Homie API: PostgreSQL at the core, three aggregation views, seven route groups; three implemented, four documented stubs.',
          'Homie API: PostgreSQL i kärnan, tre aggregeringsvyer, sju ruttgrupper; tre klara, fyra dokumenterade stubbar.',
        )}
      >
        <rect width="800" height="800" className="dtree-ground" />
        {[300, 200, 110].map((r) => (
          <circle key={r} cx={C} cy={C} r={r} className="sieve-ring" />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M 0 ${300 + i * 25} C 160 ${300 + i * 25} 200 ${C} ${C - 110} ${C}`}
            className="homie-event"
            style={{ ['--i' as string]: i }}
          />
        ))}
        <circle cx={C} cy={C} r={70} className="sieve-core" />
        <text x={C} y={C - 4} textAnchor="middle" className="homie-core">
          PostgreSQL
        </text>
        <text x={C} y={C + 16} textAnchor="middle" className="sieve-small">
          {l('immutable events', 'oföränderliga händelser')}
        </text>
        {VIEWS.map((v, i) => {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / VIEWS.length
          const [x, y] = polar(160, a)
          return (
            <g key={v.en}>
              <line x1={C} y1={C} x2={x} y2={y} className="homie-spoke" />
              <circle cx={x} cy={y} r={7} className="homie-view" />
              <text
                x={x}
                y={y - 14}
                textAnchor="middle"
                className="sieve-small"
              >
                {l(v.en, v.sv)}
              </text>
            </g>
          )
        })}
        {ROUTES.map((r, i) => {
          const a = -Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / ROUTES.length
          const [x, y] = polar(300, a)
          const [lx, ly] = polar(340, a)
          return (
            <g key={r.en} className={r.done ? 'homie-done' : 'homie-stub'}>
              <circle cx={x} cy={y} r={10} />
              <text
                x={lx}
                y={ly + 4}
                textAnchor={
                  Math.cos(a) > 0.2
                    ? 'start'
                    : Math.cos(a) < -0.2
                      ? 'end'
                      : 'middle'
                }
              >
                {l(r.en, r.sv)}
              </text>
            </g>
          )
        })}
        <text x={C} y={40} textAnchor="middle" className="sieve-small">
          {l(
            'solid: implemented · dashed: documented stub',
            'hel: klar · streckad: dokumenterad stubbe',
          )}
        </text>
      </svg>
    </div>
  )
}
