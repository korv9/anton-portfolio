/**
 * Homie API as its data model, drawn top to bottom like the README's architecture diagram:
 * immutable completion events, one enriched view, the five materialized views (fairness reads
 * workload), then the 16 operations of the OpenAPI contract grouped by tag. Filled dots are
 * built and tested in CI, open ones return contract-exact previews. The drawing is 360 units wide
 * so its labels stay at reading size on a phone. No household data exists, so nothing here is a
 * measurement.
 */
import { l } from '../i18n'

const W = 360
const H = 600
const ink = { fill: 'var(--ink)' }
const box = { fill: 'none', stroke: 'var(--focus)', strokeWidth: 1.2 }

const VIEWS = [
  { name: 'mv_workload_week', en: 'weekly workload', sv: 'veckobelastning' },
  { name: 'mv_fairness_week', en: 'balance index', sv: 'balansindex' },
  { name: 'mv_task_cadence', en: 'task cadence', sv: 'uppgiftsrytm' },
  { name: 'mv_category_split', en: 'category split', sv: 'kategorifördelning' },
  {
    name: 'mv_completion_heatmap',
    en: 'weekday × hour',
    sv: 'veckodag × timme',
  },
]
const TRUNK = 48
const viewY = (i: number) => 214 + i * 40

// The 16 operations in openapi.json, by tag; `built` ones are live and covered by CI.
export const GROUPS: { en: string; sv: string; n: number; built: boolean }[] = [
  { en: 'Auth', sv: 'Inloggning', n: 3, built: true },
  { en: 'Health', sv: 'Hälsa', n: 1, built: true },
  { en: 'Completions', sv: 'Utföranden', n: 2, built: false },
  { en: 'Tasks', sv: 'Uppgifter', n: 3, built: false },
  { en: 'Households', sv: 'Hushåll', n: 3, built: false },
  { en: 'Analytics', sv: 'Analys', n: 4, built: false },
]
const API_Y = 450

function Dot({ x, y, built }: { x: number; y: number; built: boolean }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={5}
      style={
        built ? ink : { fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.2 }
      }
    />
  )
}

export default function HomieFlow() {
  return (
    <div className="sieve">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={l(
          'Homie API data model: immutable chore_completion events feed v_completion_enriched, which feeds five materialized views (weekly workload, balance index, task cadence, category split, weekday by hour heatmap). On top sits an OpenAPI contract of 16 operations; 4 (auth and health) are built and tested on PostgreSQL 16 in CI, 12 return contract-exact previews.',
          'Homie API:s datamodell: oföränderliga chore_completion-händelser matar v_completion_enriched, som matar fem materialiserade vyer (veckobelastning, balansindex, uppgiftsrytm, kategorifördelning, värmekarta per veckodag och timme). Ovanpå ligger ett OpenAPI-kontrakt med 16 operationer; 4 (inloggning och hälsa) är byggda och testade mot PostgreSQL 16 i CI, 12 returnerar kontraktsexakta förhandsvisningar.',
        )}
      >
        <rect width={W} height={H} className="dtree-ground" />
        {Array.from({ length: 6 }, (_, i) => (
          <path
            key={i}
            d={`M ${80 + i * 40} 0 L ${80 + i * 40} 36`}
            className="homie-event"
            style={{ ['--i' as string]: i }}
          />
        ))}

        {/* layer 1: events */}
        <rect x={24} y={36} width={W - 48} height={58} rx={6} style={box} />
        <text
          x={W / 2}
          y={60}
          textAnchor="middle"
          className="homie-core"
          style={{ fontSize: 16 }}
        >
          chore_completion
        </text>
        <text x={W / 2} y={80} textAnchor="middle" className="sieve-small">
          {l('immutable events, no edits', 'oföränderliga händelser')}
        </text>
        <line x1={W / 2} y1={94} x2={W / 2} y2={124} className="homie-spoke" />

        {/* layer 2: enriched view */}
        <rect
          x={24}
          y={124}
          width={W - 48}
          height={52}
          rx={6}
          style={{ ...box, stroke: 'var(--ink)', opacity: 0.6 }}
        />
        <text
          x={W / 2}
          y={146}
          textAnchor="middle"
          style={{ ...ink, fontSize: 15 }}
        >
          v_completion_enriched
        </text>
        <text x={W / 2} y={164} textAnchor="middle" className="sieve-small">
          {l('+ household, task, member', '+ hushåll, uppgift, medlem')}
        </text>

        {/* layer 3: materialized views */}
        <line
          x1={TRUNK}
          y1={176}
          x2={TRUNK}
          y2={viewY(VIEWS.length - 1)}
          className="homie-spoke"
        />
        {VIEWS.map((v, i) => {
          const y = viewY(i)
          // mv_fairness_week is computed from mv_workload_week, not from the enriched view.
          const x = i === 1 ? TRUNK + 26 : TRUNK
          return (
            <g key={v.name}>
              {i === 1 ? (
                <path
                  d={`M ${TRUNK} ${viewY(0)} Q ${x} ${viewY(0)} ${x} ${y - 7}`}
                  fill="none"
                  className="homie-spoke"
                />
              ) : null}
              <circle cx={x} cy={y} r={7} className="homie-view" />
              <text x={x + 16} y={y - 2} style={{ ...ink, fontSize: 14 }}>
                {v.name}
              </text>
              <text x={x + 16} y={y + 14} className="sieve-small">
                {l(v.en, v.sv)}
              </text>
            </g>
          )
        })}
        <line
          x1={W / 2}
          y1={viewY(VIEWS.length - 1) + 26}
          x2={W / 2}
          y2={API_Y - 26}
          className="homie-spoke"
        />

        {/* layer 4: the contract */}
        <text
          x={W / 2}
          y={API_Y - 6}
          textAnchor="middle"
          className="homie-core"
          style={{ fontSize: 16 }}
        >
          {l(
            'OpenAPI contract: 16 operations',
            'OpenAPI-kontrakt: 16 operationer',
          )}
        </text>
        {GROUPS.map((g, i) => {
          const x = i % 2 === 0 ? 24 : 196
          const y = API_Y + 24 + Math.floor(i / 2) * 28
          return (
            <g key={g.en}>
              {Array.from({ length: g.n }, (_, k) => (
                <Dot key={k} x={x + 5 + k * 13} y={y} built={g.built} />
              ))}
              <text
                x={x + 58}
                y={y + 5}
                style={{ ...ink, fontSize: 13, opacity: g.built ? 1 : 0.7 }}
              >
                {l(g.en, g.sv)}
              </text>
            </g>
          )
        })}
        <Dot x={29} y={API_Y + 118} built />
        <text x={42} y={API_Y + 122} className="sieve-small">
          {l(
            'built, tested on PostgreSQL 16',
            'byggd, testad mot PostgreSQL 16',
          )}
        </text>
        <Dot x={29} y={API_Y + 138} built={false} />
        <text x={42} y={API_Y + 142} className="sieve-small">
          {l('returns a contract preview', 'ger en kontraktsförhandsvisning')}
        </text>
      </svg>
    </div>
  )
}
