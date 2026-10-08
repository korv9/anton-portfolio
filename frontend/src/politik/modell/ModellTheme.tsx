/**
 * The model page: gradient boosting that predicts each party's vote from the other parties'
 * positions and the committee, trained on one riksmöte and tested on the next. One figure (the
 * chosen party in the middle, the others around it, each ray as thick as the information its
 * positions carry), the accuracy as trees are added, and slicers for party and committee. From
 * politics/parliament/boost.json (platform/publish/politics_boost.py). Descriptive only.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { load } from '../../parliament/data'
import { partyFill, partyName } from '../../parties/identity'
import type { Route } from '../../router'
import { useViewParams } from '../useViewParams'
import { useParties } from '../partySelection'
import { Stage, StageBlock, StageFacts, StageTools } from '../../ui/Stage'
import '../../products/mlviz.css'
import './modell.css'

type PartyModel = {
  party: string
  train_points: number
  test_points: number
  share_ja_train: number
  accuracy: number
  baseline: number
  roc_auc: number | null
  staged: number[]
  importance: Record<string, number>
  by_committee: Record<string, { n: number; accuracy: number }>
}
type Boost = {
  method: Record<string, string>
  train_session: string
  test_session: string
  committees: string[]
  staged_step: number
  parties: PartyModel[]
}

const DEFAULTS = { parti: '', utskott: '' }
const C = 300
const pct = (v: number, d = 0) =>
  `${(v * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: d, minimumFractionDigits: d })} %`

function Rays({ model }: { model: PartyModel }) {
  const others = Object.entries(model.importance)
  const max = Math.max(...others.map(([, v]) => v), 0.0001)
  return (
    <svg
      viewBox="0 0 600 600"
      className="modell-rays"
      role="img"
      aria-label={l(
        `What predicts ${partyName(model.party)}'s vote: ${others.map(([k, v]) => `${k === 'committee' ? 'committee' : k} ${pct(v)}`).join(', ')}.`,
        `Vad som förutsäger ${partyName(model.party)}s röst: ${others.map(([k, v]) => `${k === 'committee' ? 'utskottet' : k} ${pct(v)}`).join(', ')}.`,
      )}
    >
      <rect width="600" height="600" className="dtree-ground" />
      {[90, 170, 250].map((r) => (
        <circle key={r} cx={C} cy={C} r={r} className="sieve-ring" />
      ))}
      {others.map(([key, v], i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / others.length
        const [x, y] = [C + 230 * Math.cos(a), C + 230 * Math.sin(a)]
        const colour = key === 'committee' ? 'var(--subtle)' : partyFill(key)
        const w = 1 + 22 * (v / max)
        return (
          <g key={key} className="modell-ray" style={{ ['--i' as string]: i }}>
            <line
              x1={C}
              y1={C}
              x2={x}
              y2={y}
              style={{ stroke: colour }}
              strokeWidth={w}
              strokeLinecap="round"
              opacity={0.25 + 0.6 * (v / max)}
            />
            <circle
              cx={x}
              cy={y}
              r={20}
              style={{ fill: 'var(--paper-strong)', stroke: colour }}
              strokeWidth={2}
            />
            <text x={x} y={y + 4} textAnchor="middle" className="modell-node">
              {key === 'committee' ? l('Cttee', 'Utsk.') : key}
            </text>
            <text
              x={C + 262 * Math.cos(a)}
              y={C + 262 * Math.sin(a) + 4}
              textAnchor={
                Math.cos(a) > 0.3
                  ? 'start'
                  : Math.cos(a) < -0.3
                    ? 'end'
                    : 'middle'
              }
              className="modell-share"
            >
              {pct(v)}
            </text>
          </g>
        )
      })}
      <circle cx={C} cy={C} r={46} fill={partyFill(model.party)} />
      <text x={C} y={C + 7} textAnchor="middle" className="modell-centre">
        {model.party}
      </text>
    </svg>
  )
}

function Curve({ model, step }: { model: PartyModel; step: number }) {
  const W = 600
  const H = 180
  const pts = model.staged
  const lo = Math.min(model.baseline, ...pts) - 0.02
  const hi = Math.max(model.baseline, ...pts) + 0.02
  const x = (i: number) => 40 + (i / Math.max(pts.length - 1, 1)) * (W - 60)
  const y = (v: number) => H - 24 - ((v - lo) / (hi - lo || 1)) * (H - 44)
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="modell-curve"
      role="img"
      aria-label={l(
        `Test accuracy as trees are added, from ${pct(pts[0], 1)} to ${pct(pts.at(-1)!, 1)}; always guessing the majority gives ${pct(model.baseline, 1)}.`,
        `Testträffsäkerhet när träd läggs till, från ${pct(pts[0], 1)} till ${pct(pts.at(-1)!, 1)}; att alltid gissa majoriteten ger ${pct(model.baseline, 1)}.`,
      )}
    >
      <line
        x1={40}
        x2={W - 20}
        y1={y(model.baseline)}
        y2={y(model.baseline)}
        className="modell-base"
      />
      <text
        x={W - 20}
        y={y(model.baseline) - 6}
        textAnchor="end"
        className="modell-axis"
      >
        {l('always the majority', 'alltid majoriteten')}{' '}
        {pct(model.baseline, 1)}
      </text>
      <path
        d={`M ${pts.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' L ')}`}
        className="modell-line"
        stroke={partyFill(model.party)}
        pathLength={1}
      />
      <text x={40} y={H - 6} className="modell-axis">
        1 {l('tree', 'träd')}
      </text>
      <text x={W - 20} y={H - 6} textAnchor="end" className="modell-axis">
        {(pts.length - 1) * step} {l('trees', 'träd')} · {pct(pts.at(-1)!, 1)}
      </text>
    </svg>
  )
}

export default function ModellTheme({ route }: { route: Route }) {
  const [data, setData] = useState<Boost | null>(null)
  const [view, setView] = useViewParams(route, DEFAULTS)
  // The party chosen in the party bar, unless the model's own slicer says otherwise.
  const { selected } = useParties(route)
  useEffect(() => {
    load<Boost>('politics/parliament/boost.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])
  if (!data) return <p className="theme-loading">{l('Loading…', 'Laddar…')}</p>
  const chosen =
    view.parti ||
    selected.find((p) => data.parties.some((m) => m.party === p)) ||
    'S'
  const model = data.parties.find((p) => p.party === chosen) ?? data.parties[0]
  const committees = Object.entries(model.by_committee).sort(
    (a, b) => b[1].accuracy - a[1].accuracy,
  )
  const trivial = model.baseline >= 0.995

  return (
    <div className="modell">
      <Stage
        id="modell"
        level={1}
        kicker={l(
          'Politics · gradient boosting',
          'Politik · gradient boosting',
        )}
        title={l(
          'Can a model learn how a party votes?',
          'Kan en modell lära sig hur ett parti röstar?',
        )}
        lead={l(
          `Trained on ${data.train_session}, tested on ${data.test_session}: for each party, 150 small trees learn from the other parties' positions and the committee. A description of voting patterns, not of cooperation.`,
          `Tränad på ${data.train_session}, testad på ${data.test_session}: för varje parti lär sig 150 små träd av de andra partiernas ståndpunkter och utskottet. En beskrivning av röstmönster, inte av samarbete.`,
        )}
        figure={
          <div className="modell-figure">
            <div
              className="modell-slicers"
              role="group"
              aria-label={l('Party', 'Parti')}
            >
              {data.parties.map((p) => (
                <button
                  key={p.party}
                  type="button"
                  aria-pressed={p.party === model.party}
                  onClick={() => setView({ parti: p.party })}
                  style={{ ['--c' as string]: partyFill(p.party) }}
                >
                  {p.party}
                </button>
              ))}
            </div>
            <Rays model={model} />
            <Curve model={model} step={data.staged_step} />
            {trivial && (
              <p className="modell-note">
                {l(
                  `${partyName(model.party)} voted Ja on every decision point in ${data.test_session}, so there is nothing for the model to predict.`,
                  `${partyName(model.party)} röstade Ja på varje beslutspunkt ${data.test_session}, så det finns inget för modellen att förutsäga.`,
                )}
              </p>
            )}
          </div>
        }
        left={
          <>
            <StageBlock title={l('Slicers', 'Filter')}>
              <label className="modell-select">
                <span>{l('Party', 'Parti')}</span>
                <select
                  value={model.party}
                  onChange={(e) => setView({ parti: e.target.value })}
                >
                  {data.parties.map((p) => (
                    <option key={p.party} value={p.party}>
                      {partyName(p.party)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modell-select">
                <span>{l('Committee', 'Utskott')}</span>
                <select
                  value={view.utskott}
                  onChange={(e) => setView({ utskott: e.target.value })}
                >
                  <option value="">
                    {l('All committees', 'Alla utskott')}
                  </option>
                  {committees.map(([c]) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </StageBlock>
            <StageBlock title={l('Method', 'Metod')}>
              <ol className="stage-steps">
                <li>
                  {l('One row per decision point', 'En rad per beslutspunkt')}
                </li>
                <li>
                  {l('Label: the party votes Ja', 'Etikett: partiet röstar Ja')}
                </li>
                <li>
                  {l(
                    'Features: the other parties (Ja 1, Avstår 0, Nej −1) and the committee',
                    'Egenskaper: de andra partierna (Ja 1, Avstår 0, Nej −1) och utskottet',
                  )}
                </li>
                <li>
                  {l(
                    '150 trees, depth 2, learning rate 0.1',
                    '150 träd, djup 2, inlärningstakt 0,1',
                  )}
                </li>
                <li>
                  {l(
                    `Test on ${data.test_session}, a later session`,
                    `Test på ${data.test_session}, ett senare riksmöte`,
                  )}
                </li>
              </ol>
            </StageBlock>
            <StageBlock title={l('Tools', 'Verktyg')}>
              <StageTools
                items={[
                  'Python',
                  'scikit-learn',
                  'GradientBoosting',
                  'React',
                  'SVG',
                ]}
              />
            </StageBlock>
          </>
        }
        right={
          <>
            <StageBlock title={partyName(model.party)}>
              <StageFacts
                rows={[
                  [
                    l('Test accuracy', 'Testträffsäkerhet'),
                    pct(model.accuracy, 1),
                  ],
                  [
                    l('Always the majority', 'Alltid majoriteten'),
                    pct(model.baseline, 1),
                  ],
                  [
                    'ROC AUC',
                    model.roc_auc == null ? '–' : model.roc_auc.toFixed(3),
                  ],
                  [
                    l('Training points', 'Träningspunkter'),
                    String(model.train_points),
                  ],
                  [l('Test points', 'Testpunkter'), String(model.test_points)],
                ]}
              />
            </StageBlock>
            <StageBlock
              title={l('Accuracy by committee', 'Träffsäkerhet per utskott')}
            >
              {committees.map(([c, v]) => (
                <div
                  key={c}
                  className={`modell-cttee${view.utskott && view.utskott !== c ? ' is-dim' : ''}`}
                >
                  <span>
                    {c} <small>({v.n})</small>
                  </span>
                  <div className="stage-bar">
                    <span>
                      <i style={{ width: `${v.accuracy * 100}%` }} />
                    </span>
                    <b>{pct(v.accuracy)}</b>
                  </div>
                </div>
              ))}
            </StageBlock>
          </>
        }
      />
      <details className="modell-all">
        <summary>
          {l('All parties as a table', 'Alla partier som tabell')}
        </summary>
        <table className="board-table">
          <thead>
            <tr>
              <th scope="col">{l('Party', 'Parti')}</th>
              <th scope="col" className="num">
                {l('Accuracy', 'Träffsäkerhet')}
              </th>
              <th scope="col" className="num">
                {l('Majority', 'Majoritet')}
              </th>
              <th scope="col" className="num">
                ROC AUC
              </th>
              <th scope="col">{l('Most informative', 'Mest informativ')}</th>
            </tr>
          </thead>
          <tbody>
            {data.parties.map((p) => {
              const top = Object.entries(p.importance).sort(
                (a, b) => b[1] - a[1],
              )[0]
              return (
                <tr key={p.party}>
                  <td>{partyName(p.party)}</td>
                  <td className="num">{pct(p.accuracy, 1)}</td>
                  <td className="num">{pct(p.baseline, 1)}</td>
                  <td className="num">
                    {p.roc_auc == null ? '–' : p.roc_auc.toFixed(3)}
                  </td>
                  <td>
                    {top[0] === 'committee'
                      ? l('the committee', 'utskottet')
                      : top[0]}{' '}
                    ({pct(top[1])})
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </details>
    </div>
  )
}
