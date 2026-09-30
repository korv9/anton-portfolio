/**
 * The government's budget for a year as a flow: one bundle leaves the total and splits into
 * the expenditure areas, each as wide as its money. The colour answers one question for one
 * opposition party: does it want more (blue) or less (red) than the government in that area?
 * Pick the party; hover an area for the amounts.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import { partyName } from '../../parties/identity'
import { Feature, Pick, useTip, useWidth } from '../../charts/feature/Feature'
import type { BudgetRow } from '../themes/BudgetTheme'
import { num, signed } from '../controls'
import './features.css'

const MORE = '#1f78b4'
const LESS = '#c8413b'
const SAME = '#b9b9b3'
const bn = (msek: number) => `${num(msek / 1000, 1)} ${l('bn', 'mdkr')}`

export default function BudgetFlow({
  rows,
  year,
  parties,
  names,
  preferred,
}: {
  rows: BudgetRow[]
  year: number
  /** Parties with a budget motion this year. */
  parties: string[]
  names: Map<number, string>
  /** The party chosen in the party bar, if it has a budget. */
  preferred?: string
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [ref, width] = useWidth<HTMLDivElement>()
  const { box, show, hide, tip } = useTip()
  const gov = rows
    .filter((r) => r.budget_year === year && r.actor === 'GOV')
    .sort((a, b) => b.amount_msek - a.amount_msek)
  if (!gov.length || !parties.length) return null
  const party =
    picked && parties.includes(picked)
      ? picked
      : preferred && parties.includes(preferred)
        ? preferred
        : parties[0]
  const dev = (area: number) =>
    rows.find(
      (r) =>
        r.budget_year === year &&
        r.actor === party &&
        r.expenditure_area === area,
    )?.deviation_msek ?? 0
  const total = gov.reduce((s, r) => s + r.amount_msek, 0)
  const more = gov.filter((r) => dev(r.expenditure_area) > 0)
  const less = gov.filter((r) => dev(r.expenditure_area) < 0)
  const biggest = [...gov].sort(
    (a, b) =>
      Math.abs(dev(b.expenditure_area)) - Math.abs(dev(a.expenditure_area)),
  )[0]
  const name = (area: number) => names.get(area) ?? String(area)

  const narrow = width < 640
  const rowH = narrow ? 17 : 16
  const labelW = narrow ? 160 : 290
  const x0 = narrow ? 14 : 120
  const x1 = width - labelW
  const money = 340
  const k = money / total
  // The bundles leave the total stacked tight and end one row each (at least a label's
  // height), so every label sits at its own band.
  let s = 0
  let e = 10
  const flows = gov.map((r) => {
    const h = Math.max(1, r.amount_msek * k)
    const f = { r, s0: s, s1: s + h, e0: e, e1: e + h }
    s += h
    e += Math.max(h + 2, rowH)
    return f
  })
  const H = e + 6
  const shift = H / 2 - money / 2
  for (const f of flows) {
    f.s0 += shift
    f.s1 += shift
  }
  const chars = Math.floor((labelW - 40) / 6.2)
  const short = (t: string) =>
    t.length > chars ? `${t.slice(0, chars - 1)}…` : t
  const labels = flows.map((f) => ({
    area: f.r.expenditure_area,
    y: (f.e0 + f.e1) / 2,
  }))
  const tipFor = (f: (typeof flows)[number]) => (
    <>
      <b>
        {f.r.expenditure_area}. {name(f.r.expenditure_area)}
      </b>
      {l('Government', 'Regeringen')}: {bn(f.r.amount_msek)}
      <br />
      {partyName(party)}: {signed(dev(f.r.expenditure_area) / 1000, 1)}{' '}
      {l('bn', 'mdkr')}
    </>
  )
  const colour = (area: number) => {
    const d = dev(area)
    return d > 0 ? MORE : d < 0 ? LESS : SAME
  }

  return (
    <Feature
      id="budgetflode"
      title={l(
        `${partyName(party)} wants more than the government in ${more.length} of ${gov.length} areas and less in ${less.length}; the biggest difference is ${name(biggest.expenditure_area)} (${signed(dev(biggest.expenditure_area) / 1000, 1)} bn).`,
        `${partyName(party)} vill ha mer än regeringen i ${more.length} av ${gov.length} områden och mindre i ${less.length}; störst skillnad gäller ${name(biggest.expenditure_area)} (${signed(dev(biggest.expenditure_area) / 1000, 1)} mdkr).`,
      )}
      lead={l(
        `The government's budget for ${year}, ${bn(total)}, flows out into the expenditure areas, each as wide as its money. Blue: the party wants more there, red: less, grey: the same. Hover an area for the amounts.`,
        `Regeringens budget för ${year}, ${bn(total)}, flödar ut i utgiftsområdena, vart och ett lika brett som sina pengar. Blått: partiet vill ha mer där, rött: mindre, grått: lika mycket. Håll över ett område för beloppen.`,
      )}
      controls={
        <Pick
          label={l('Party', 'Parti')}
          value={party}
          options={parties.map((p) => ({ value: p, label: p }))}
          onChange={setPicked}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Expenditure area', 'Utgiftsområde')}</th>
              <th className="num">
                {l('Government, SEK m', 'Regeringen, mnkr')}
              </th>
              <th className="num">
                {party} {l('difference, SEK m', 'skillnad, mnkr')}
              </th>
            </tr>
          </thead>
          <tbody>
            {gov.map((r) => (
              <tr key={r.expenditure_area}>
                <td>
                  {r.expenditure_area}. {name(r.expenditure_area)}
                </td>
                <td className="num">{num(r.amount_msek)}</td>
                <td className="num">{signed(dev(r.expenditure_area))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'The Riksdag Finance Committee’s report on the budget (FiU1), the parties’ motions',
        'Riksdagens finansutskotts betänkande om budgeten (FiU1), partiernas motioner',
      )}
    >
      <ul className="feature-legend">
        <li style={{ ['--c' as string]: MORE }}>
          {l('Wants more', 'Vill ha mer')} ({more.length})
        </li>
        <li style={{ ['--c' as string]: LESS }}>
          {l('Wants less', 'Vill ha mindre')} ({less.length})
        </li>
        <li style={{ ['--c' as string]: SAME }}>
          {l('The same', 'Lika')} ({gov.length - more.length - less.length})
        </li>
      </ul>
      <div
        className="budgetflow"
        ref={(el) => {
          ref(el)
          box.current = el
        }}
        onMouseLeave={() => {
          setHover(null)
          hide()
        }}
      >
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={l(
            `The government's budget ${year} by expenditure area`,
            `Regeringens budget ${year} per utgiftsområde`,
          )}
        >
          {!narrow && (
            <text
              className="budgetflow-total"
              x={x0 - 10}
              y={H / 2}
              textAnchor="end"
            >
              <tspan x={x0 - 10} dy="-0.4em" fontWeight={700}>
                {bn(total)}
              </tspan>
              <tspan x={x0 - 10} dy="1.3em">
                {l('the government', 'regeringen')}
              </tspan>
            </text>
          )}
          {flows.map((f) => {
            const m = (x0 + x1) / 2
            const area = f.r.expenditure_area
            return (
              <path
                key={area}
                className={`budgetflow-band${hover == null ? '' : hover === area ? ' on' : ' off'}`}
                style={{ fill: colour(area) }}
                d={`M${x0} ${f.s0} C${m} ${f.s0} ${m} ${f.e0} ${x1} ${f.e0} L${x1} ${f.e1} C${m} ${f.e1} ${m} ${f.s1} ${x0} ${f.s1} Z`}
                onPointerDown={(e) => {
                  setHover(area)
                  show(e, tipFor(f))
                }}
                onPointerMove={(e) => {
                  setHover(area)
                  show(e, tipFor(f))
                }}
              />
            )
          })}
          <rect
            className="budgetflow-source"
            x={x0 - 4}
            y={flows[0].s0}
            width={4}
            height={flows.at(-1)!.s1 - flows[0].s0}
          />
          {labels.map((lab) => {
            const f = flows.find((x) => x.r.expenditure_area === lab.area)!
            return (
              <g
                key={lab.area}
                className={`budgetflow-label${hover == null || hover === lab.area ? '' : ' off'}`}
                onPointerEnter={() => setHover(lab.area)}
              >
                <line x1={x1} x2={x1 + 6} y1={(f.e0 + f.e1) / 2} y2={lab.y} />
                <text x={x1 + 9} y={lab.y} dy="0.32em">
                  {short(name(lab.area))}{' '}
                  <tspan className="budgetflow-num">
                    {num(f.r.amount_msek / 1000, 0)}
                  </tspan>
                </text>
              </g>
            )
          })}
        </svg>
        {tip}
      </div>
    </Feature>
  )
}
