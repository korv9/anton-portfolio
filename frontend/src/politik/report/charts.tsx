/**
 * The report's own charts, each a Feature that loads what it shows: how often the parties vote
 * alike (a heatmap), which issue areas the Riksdag debates (ranked bars), how that focus has
 * moved (lines), and the studies published each year with those a bill later rests on (columns).
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { load, type Sessions } from '../../parliament/data'
import { RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { Feature, Pick } from '../../charts/feature/Feature'
import RankBars from '../../charts/RankBars'
import MultiLineChart from '../../charts/MultiLineChart'
import Heatmap from '../dash/Heatmap'
import Columns from '../board/Columns'
import { Select, num, pct } from '../controls'
import {
  shares,
  startYear,
  topicSeries,
  topicWeights,
  type SakData,
} from '../analytics/issues'
import {
  loadDebateIndex,
  loadSession,
  type DebateIndex,
  type IssueDebate,
} from '../debatter/data'

/** Every pair of parties: the share of roll calls where they took the same position. */
export function VoteAlike({ parties }: { parties: string[] }) {
  const [data, setData] = useState<Sessions | null>(null)
  const [session, setSession] = useState('')
  useEffect(() => {
    load<Sessions>('parliament/sessions.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])
  if (!data) return null
  const sessions = [...new Set(data.party_pairs.map((p) => p.session))].sort()
  const chosen = sessions.includes(session) ? session : sessions.at(-1)!
  const shown = parties.length >= 2 ? parties : RIKSDAG_PARTIES
  const alike = (a: string, b: string) =>
    data.party_pairs.find(
      (p) =>
        p.session === chosen &&
        ((p.party_a === a && p.party_b === b) ||
          (p.party_a === b && p.party_b === a)),
    )?.agreement_pct ?? null
  return (
    <Feature
      id="rostlikhet"
      title={l(
        `Who votes with whom, ${chosen}`,
        `Vem röstar med vem, ${chosen}`,
      )}
      controls={
        <Select
          label={l('Session', 'Riksmöte')}
          value={chosen}
          options={[...sessions].reverse().map((s) => ({ value: s, label: s }))}
          onChange={setSession}
        />
      }
      source={l(
        'The Riksdag, roll-call votes; share of roll calls with the same position',
        'Riksdagen, voteringar; andel voteringar med samma ståndpunkt',
      )}
    >
      <Heatmap
        rows={shown.map((p) => ({ key: p, label: partyName(p) }))}
        rowHeader="party"
        parties={shown}
        value={(row, col) => (row === col ? null : alike(row, col))}
        format={(v) => pct(v, 0)}
        caption={l(
          'Share of roll calls where the two parties took the same position',
          'Andel voteringar där de två partierna hade samma ståndpunkt',
        )}
      />
    </Feature>
  )
}

/** The issue areas the Riksdag debated in a riksmöte, by number of debates. */
export function IssueAreas() {
  const [index, setIndex] = useState<DebateIndex | null>(null)
  const [debates, setDebates] = useState<IssueDebate[] | null>(null)
  const [session, setSession] = useState('')
  useEffect(() => {
    loadDebateIndex()
      .then(setIndex)
      .catch(() => setIndex(null))
  }, [])
  const sessions = index?.sessions ?? []
  const current = sessions.find((s) => s.session === session) ?? sessions.at(-1)
  useEffect(() => {
    if (!current) return
    setDebates(null)
    loadSession(current.path)
      .then((f) => setDebates(f.debates))
      .catch(() => setDebates([]))
  }, [current?.path])
  if (!index || !current) return null
  const rows = index.issues
    .map((issue) => ({
      key: issue.key,
      label: l(issue.en, issue.sv),
      value: (debates ?? []).filter((d) => d.issues.includes(issue.key)).length,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  return (
    <Feature
      id="sakomraden"
      title={l(
        `What the Riksdag debated, ${current.session}`,
        `Vad riksdagen debatterade, ${current.session}`,
      )}
      controls={
        <Select
          label={l('Session', 'Riksmöte')}
          value={current.session}
          options={[...sessions]
            .reverse()
            .map((s) => ({ value: s.session, label: s.session }))}
          onChange={setSession}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Issue area', 'Sakområde')}</th>
              <th className="num">{l('Debates', 'Debatter')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num">{num(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'The Riksdag, debates on committee reports; the area comes from the committee that decided, otherwise from words in the title',
        'Riksdagen, debatter om betänkanden; området kommer från utskottet som beslutade, annars från ord i rubriken',
      )}
    >
      <RankBars
        rows={rows}
        format={(v) => num(v)}
        label={l('Debates per issue area', 'Debatter per sakområde')}
      />
    </Feature>
  )
}

/** The four largest issue areas over the riksmöten: the share of all utterances, or a party's. */
export function FocusLines({ party }: { party: string | null }) {
  const [data, setData] = useState<SakData | null>(null)
  useEffect(() => {
    load<SakData>('politics/parliament/sakdebatter.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])
  if (!data?.topics.length) return null
  const rows = [...data.topics].sort(
    (a, b) => startYear(a.session) - startYear(b.session),
  )
  const keys = shares(topicWeights(rows.slice(-1), party).weights)
    .slice(0, 4)
    .map((s) => s.key)
  const name = (key: string) => {
    const issue = data.issues.find((i) => i.key === key)
    return issue ? l(issue.en, issue.sv) : key
  }
  const points = topicSeries(rows, party, keys)
  return (
    <Feature
      id="amnesfokus"
      title={l(
        party
          ? `What ${partyName(party)} talks about, over time`
          : 'What the debates are about, over time',
        party
          ? `Vad ${partyName(party)} pratar om, över tid`
          : 'Vad debatterna handlar om, över tid',
      )}
      source={l(
        'The Riksdag, speeches and replies in issue debates; share of utterances per issue area, the four largest in the latest riksmöte',
        'Riksdagen, anföranden och repliker i sakdebatter; andel yttranden per sakområde, de fyra största under senaste riksmötet',
      )}
    >
      <MultiLineChart
        series={keys.map((key) => ({
          key,
          name: name(key),
          points: points.map((p) => ({
            date: `${startYear(p.session)}-09-01`,
            label: p.session,
            value: p.shares[key] ?? 0,
          })),
        }))}
        format={(v) => pct(v, 0)}
        colorOf={(key) => keys.indexOf(key) + 1}
        label={l(
          'Share of utterances per issue area over the riksmöten',
          'Andel yttranden per sakområde över riksmötena',
        )}
      />
    </Feature>
  )
}

type Studies = {
  per_year: { year: number; kind: string; published: number; cited: number }[]
  kinds: Record<string, [string, string]>
}

/** Studies published each year, and how many of them a bill later named as its basis. */
export function StudiesPerYear() {
  const [data, setData] = useState<Studies | null>(null)
  const [kind, setKind] = useState('sou')
  useEffect(() => {
    load<Studies>('parliament/studies.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])
  if (!data) return null
  const kinds = [...new Set(data.per_year.map((r) => r.kind))]
  const years = [...new Set(data.per_year.map((r) => r.year))].sort()
  const of = (field: 'published' | 'cited') =>
    years.map(
      (y) =>
        data.per_year.find((r) => r.year === y && r.kind === kind)?.[field] ??
        0,
    )
  return (
    <Feature
      id="utredningar-ar"
      title={l(
        'Studies each year, and those a bill rests on',
        'Utredningar varje år, och de en proposition bygger på',
      )}
      controls={
        kinds.length > 1 ? (
          <Pick
            label={l('Series', 'Serie')}
            value={kind}
            options={kinds.map((k) => ({ value: k, label: k.toUpperCase() }))}
            onChange={setKind}
          />
        ) : undefined
      }
      source={l(
        'The Riksdag and the Government Offices; the newest years have not had time to lead to bills yet',
        'Riksdagen och Regeringskansliet; de senaste åren har ännu inte hunnit leda till propositioner',
      )}
    >
      <Columns
        categories={years.map(String)}
        series={[
          {
            key: 'published',
            label: l('Published', 'Publicerade'),
            values: of('published'),
          },
          {
            key: 'cited',
            label: l('Named in a bill', 'Underlag i en proposition'),
            values: of('cited'),
          },
        ]}
        format={(v) => num(v)}
        label={l('Studies per year', 'Utredningar per år')}
      />
    </Feature>
  )
}
