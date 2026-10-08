/**
 * The parties in the issue debates, ranked by one measure at a time: debates taken part in,
 * speeches, replies, and replies or speeches per debate. The party chosen in the party bar
 * stays dark; the table has every measure for every party.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import { PartyLogo, RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { Feature, Pick } from '../../charts/feature/Feature'
import RankBars from '../../charts/RankBars'
import type { IssueDebate } from '../debatter/data'
import { num } from '../controls'
import './features.css'

type Measure = {
  key: string
  en: string
  sv: string
  value: (p: string) => number
  format: (v: number) => string
}

export default function DebateRanking({
  debates,
  session,
  preferred,
}: {
  debates: IssueDebate[]
  session: string
  preferred?: string
}) {
  const [measureKey, setMeasure] = useState('anforanden')
  const parties = RIKSDAG_PARTIES.filter((p) =>
    debates.some((d) => d.parties[p]),
  )
  if (!parties.length) return null
  const sum = (p: string, i: 0 | 1) =>
    debates.reduce((s, d) => s + (d.parties[p]?.[i] ?? 0), 0)
  const measures: Measure[] = [
    {
      key: 'debatter',
      en: 'Debates taken part in',
      sv: 'Debatter deltagit i',
      value: (p) => debates.filter((d) => d.parties[p]).length,
      format: (v) => num(v),
    },
    {
      key: 'anforanden',
      en: 'Speeches',
      sv: 'Anföranden',
      value: (p) => sum(p, 0),
      format: (v) => num(v),
    },
    {
      key: 'repliker',
      en: 'Replies',
      sv: 'Repliker',
      value: (p) => sum(p, 1),
      format: (v) => num(v),
    },
    {
      key: 'per',
      en: 'Replies per speech',
      sv: 'Repliker per anförande',
      value: (p) => (sum(p, 0) ? sum(p, 1) / sum(p, 0) : 0),
      format: (v) => num(v, 2),
    },
    {
      key: 'perdebatt',
      en: 'Speeches per debate',
      sv: 'Anföranden per debatt',
      value: (p) => {
        const n = debates.filter((d) => d.parties[p]).length
        return n ? sum(p, 0) / n : 0
      },
      format: (v) => num(v, 2),
    },
  ]
  const ranked = measures.map((m) =>
    [...parties].sort((a, b) => m.value(b) - m.value(a)),
  )
  const focus = preferred && parties.includes(preferred) ? preferred : null
  const measure = measures.find((m) => m.key === measureKey) ?? measures[1]
  const leader = ranked[1][0]
  const fighter = ranked[3][0]

  return (
    <Feature
      id="topplista"
      title={
        leader === fighter
          ? l(
              `${partyName(leader)} spoke most in the issue debates of ${session}, and replied most per speech.`,
              `${partyName(leader)} talade mest i sakdebatterna ${session}, och replikerade mest per anförande.`,
            )
          : l(
              `${partyName(leader)} spoke most in the issue debates of ${session}; ${partyName(fighter)} replied most per speech.`,
              `${partyName(leader)} talade mest i sakdebatterna ${session}; ${partyName(fighter)} replikerade mest per anförande.`,
            )
      }
      lead={l(
        'Pick a measure to rank the parties by it; a party chosen in the party bar stays dark.',
        'Välj ett mått att rangordna partierna efter; ett parti som valts i partiraden förblir mörkt.',
      )}
      controls={
        <Pick
          label={l('Measure', 'Mått')}
          value={measure.key}
          options={measures.map((m) => ({
            value: m.key,
            label: l(m.en, m.sv),
          }))}
          onChange={setMeasure}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Party', 'Parti')}</th>
              {measures.map((m) => (
                <th key={m.key} className="num">
                  {l(m.en, m.sv)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p}>
                <td>{partyName(p)}</td>
                {measures.map((m) => (
                  <td key={m.key} className="num">
                    {m.format(m.value(p))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'Riksdagen, protocols of the chamber debates',
        'Riksdagen, kammarens protokoll',
      )}
    >
      <RankBars
        label={l(
          `${l(measure.en, measure.sv)} per party, issue debates ${session}`,
          `${l(measure.en, measure.sv)} per parti, sakdebatter ${session}`,
        )}
        format={measure.format}
        picked={focus}
        rows={[...parties]
          .sort((a, b) => measure.value(b) - measure.value(a))
          .map((p) => ({
            key: p,
            party: p,
            label: (
              <>
                <PartyLogo party={p} size={18} />
                {partyName(p)}
              </>
            ),
            value: measure.value(p),
          }))}
      />
    </Feature>
  )
}
