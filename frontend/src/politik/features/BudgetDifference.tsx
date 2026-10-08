/**
 * One opposition party's budget against the government's, area by area: bars right of the
 * line where the party wants more money, left where it wants less. Pick the party; the table
 * has the government's amounts too.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import { partyName } from '../../parties/identity'
import { Feature, Pick } from '../../charts/feature/Feature'
import RankBars from '../../charts/RankBars'
import type { BudgetRow } from '../themes/BudgetTheme'
import { num, signed } from '../controls'
import './features.css'

const bn = (msek: number) => `${num(msek / 1000, 1)} ${l('bn', 'mdkr')}`

export default function BudgetDifference({
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

  return (
    <Feature
      id="budgetflode"
      title={l(
        `${partyName(party)} wants more than the government in ${more.length} of ${gov.length} areas and less in ${less.length}; the biggest difference is ${name(biggest.expenditure_area)} (${signed(dev(biggest.expenditure_area) / 1000, 1)} bn).`,
        `${partyName(party)} vill ha mer än regeringen i ${more.length} av ${gov.length} områden och mindre i ${less.length}; störst skillnad gäller ${name(biggest.expenditure_area)} (${signed(dev(biggest.expenditure_area) / 1000, 1)} mdkr).`,
      )}
      lead={l(
        `The difference from the government's budget for ${year} (${bn(total)} in all), per expenditure area: right of the line the party wants more, left of it less. Areas with no difference are left out.`,
        `Skillnaden mot regeringens budget för ${year} (${bn(total)} totalt), per utgiftsområde: till höger om linjen vill partiet ha mer, till vänster mindre. Områden utan skillnad visas inte.`,
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
      <RankBars
        label={l(
          `${partyName(party)} compared with the government, per expenditure area, ${year}`,
          `${partyName(party)} jämfört med regeringen, per utgiftsområde, ${year}`,
        )}
        format={(v) => `${signed(v / 1000, 1)} ${l('bn', 'mdkr')}`}
        limit={10}
        rows={[...gov]
          .filter((r) => dev(r.expenditure_area) !== 0)
          .sort((a, b) => dev(b.expenditure_area) - dev(a.expenditure_area))
          .map((r) => ({
            key: String(r.expenditure_area),
            label: name(r.expenditure_area),
            value: dev(r.expenditure_area),
          }))}
      />
    </Feature>
  )
}
