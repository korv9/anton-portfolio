/**
 * Hur partierna röstar: how often two parties take the same position in the Riksdag's roll
 * calls, per session since 1993/94, and each party's record over time (with the government,
 * unity, attendance). From parliament/sessions.json.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { SeriesColumns } from '../board/Columns'
import '../board/board.css'
import {
  load,
  sessionDate,
  type SessionRecord,
  type Sessions,
} from '../../parliament/data'
import { PartyTag, RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import type { Route } from '../../router'
import ThemeLayout from '../ThemeLayout'
import BuilderPanel, { Choice, Field } from '../BuilderPanel'
import Bars from '../Bars'
import { Select, num, pct } from '../controls'
import { useViewParams } from '../useViewParams'
import { shownParties, useParties } from '../partySelection'

type Measure = 'lika' | 'regeringen' | 'enighet' | 'narvaro' | 'vinnande'
const RECORD: Record<
  Exclude<Measure, 'lika'>,
  { key: keyof SessionRecord; sv: string; en: string }
> = {
  regeringen: {
    key: 'with_government_pct',
    sv: 'Röstade som regeringen',
    en: 'Voted with the government',
  },
  enighet: { key: 'cohesion_pct', sv: 'Partiets enighet', en: 'Party unity' },
  narvaro: { key: 'attendance_pct', sv: 'Närvaro', en: 'Attendance' },
  vinnande: {
    key: 'on_winning_side_pct',
    sv: 'På den vinnande sidan',
    en: 'On the winning side',
  },
}
const DEFAULTS = {
  riksmote: '',
  matt: 'lika',
  fran: '2006',
}

export default function RosterTheme({ route }: { route: Route }) {
  const [data, setData] = useState<Sessions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [view, setView, reset] = useViewParams(route, DEFAULTS)
  const { selected } = useParties(route)
  useEffect(() => {
    load<Sessions>('parliament/sessions.json')
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  const sessions = data?.sessions.map((s) => s.session) ?? []
  const session = sessions.includes(view.riksmote)
    ? view.riksmote
    : (sessions.at(-1) ?? '')
  const info = data?.sessions.find((s) => s.session === session)
  const measure = (view.matt in RECORD ? view.matt : 'lika') as Measure
  const pairs = data?.party_pairs.filter((p) => p.session === session) ?? []
  const present = RIKSDAG_PARTIES.filter((p) =>
    pairs.some((pair) => pair.party_a === p || pair.party_b === p),
  )
  // The first party chosen in the party bar, or S until one is chosen.
  const party = selected.find((p) => present.includes(p)) ?? present[0] ?? 'S'
  const agreement = (a: string, b: string) =>
    pairs.find(
      (p) =>
        (p.party_a === a && p.party_b === b) ||
        (p.party_a === b && p.party_b === a),
    )?.agreement_pct
  const others = present
    .filter((p) => p !== party)
    .map((p) => ({ party: p, value: agreement(party, p) }))
    .filter((p): p is { party: string; value: number } => p.value != null)
    .sort((a, b) => b.value - a.value)
  const allPairs = pairs
    .filter(
      (p) =>
        RIKSDAG_PARTIES.includes(p.party_a) &&
        RIKSDAG_PARTIES.includes(p.party_b),
    )
    .sort((a, b) => b.agreement_pct - a.agreement_pct)
  const closest = allPairs[0]
  const furthest = allPairs.at(-1)

  const picked = shownParties(selected, ['S', 'M', 'SD', 'C', 'V'])
  const record = measure !== 'lika' ? RECORD[measure] : null
  const recordSeries = record
    ? picked.map((p) => ({
        key: p,
        party: p,
        name: partyName(p),
        points: (data?.party_record ?? [])
          .filter(
            (r) =>
              r.party === p &&
              r[record.key] != null &&
              Number(r.session.slice(0, 4)) >= Number(view.fran),
          )
          .map((r) => ({
            date: sessionDate(r.session),
            label: `${r.session} · ${r.role === 'government' ? l('in government', 'i regeringen') : r.role === 'agreement' ? l('agreement', 'avtalsparti') : l('opposition', 'opposition')}`,
            value: Number(r[record.key]),
          })),
      }))
    : []

  const sessionOptions = [...sessions]
    .reverse()
    .map((s) => ({ value: s, label: s }))
  const filters =
    measure === 'lika' ? (
      <>
        <Select
          label={l('Parliamentary session', 'Riksmöte')}
          value={session}
          options={sessionOptions}
          onChange={(riksmote) => setView({ riksmote })}
        />
        <p className="theme-filter-note">
          {l(
            `Showing ${party}. The first party chosen in the bar above is compared with the rest.`,
            `Visar ${party}. Det första partiet du väljer i raden ovanför jämförs med de andra.`,
          )}
        </p>
      </>
    ) : (
      <Select
        label={l('Period', 'Tidsperiod')}
        value={view.fran}
        options={['1993', '2006', '2014', '2022'].map((y) => ({
          value: y,
          label:
            y === '1993'
              ? l('All sessions', 'Alla riksmöten')
              : l(`Since ${y}`, `Sedan ${y}`),
        }))}
        onChange={(fran) => setView({ fran })}
      />
    )

  const matrix = (
    <table className="data-table matrix" data-testid="agreement-matrix">
      <caption>
        {l(
          `Share of roll calls ${session} on which two parties took the same position (%)`,
          `Andel voteringar ${session} där två partier tog samma ståndpunkt (%)`,
        )}
      </caption>
      <thead>
        <tr>
          <td />
          {present.map((p) => (
            <th key={p} scope="col">
              <PartyTag party={p} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {present.map((a) => (
          <tr key={a}>
            <th scope="row">
              <PartyTag party={a} />
            </th>
            {present.map((b) => {
              const v = a === b ? null : agreement(a, b)
              return (
                <td
                  key={b}
                  style={
                    v != null
                      ? {
                          background: `rgba(21,21,21,${(v / 100) ** 3 * 0.5})`,
                          color: v > 85 ? '#fff' : undefined,
                        }
                      : undefined
                  }
                >
                  {v != null ? Math.round(v) : ''}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
  const recordTable = (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">{l('Session', 'Riksmöte')}</th>
          {picked.map((p) => (
            <th key={p} scope="col">
              <PartyTag party={p} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...new Set(recordSeries.flatMap((s) => s.points.map((p) => p.date)))]
          .sort()
          .reverse()
          .map((date) => (
            <tr key={date}>
              <th scope="row">{`${date.slice(0, 4)}/${String(Number(date.slice(2, 4)) + 1).padStart(2, '0')}`}</th>
              {recordSeries.map((s) => {
                const point = s.points.find((p) => p.date === date)
                return <td key={s.key}>{point ? pct(point.value, 0) : '–'}</td>
              })}
            </tr>
          ))}
      </tbody>
    </table>
  )

  return (
    <>
      <ThemeLayout
        question={l(
          'How often do the parties vote alike?',
          'Hur ofta röstar partierna lika?',
        )}
        why={l(
          'What parties say is one thing; how they vote in the Riksdag shows who actually works together.',
          'Vad partierna säger är en sak; hur de röstar i riksdagen visar vilka som faktiskt samarbetar.',
        )}
        loading={!data && !error}
        error={error}
        kpis={
          info && closest && furthest
            ? [
                {
                  value: num(info.roll_calls),
                  label: l(
                    `roll calls in ${session}`,
                    `voteringar under riksmötet ${session}`,
                  ),
                },
                {
                  value: pct(closest.agreement_pct, 0),
                  label: l(
                    `${closest.party_a} and ${closest.party_b} voted alike most often`,
                    `${closest.party_a} och ${closest.party_b} röstade oftast lika`,
                  ),
                },
                {
                  value: pct(furthest.agreement_pct, 0),
                  label: l(
                    `${furthest.party_a} and ${furthest.party_b} voted alike least often`,
                    `${furthest.party_a} och ${furthest.party_b} röstade minst ofta lika`,
                  ),
                },
              ]
            : []
        }
        filters={filters}
        chartTitle={
          record
            ? l(`${record.en}, by session`, `${record.sv}, per riksmöte`)
            : l(
                `How often does ${partyName(party)} vote like the other parties?`,
                `Hur ofta röstar ${partyName(party)} som de andra partierna?`,
              )
        }
        chartMeta={
          record
            ? l(
                `Per cent of roll calls · from ${view.fran}`,
                `Procent av voteringarna · från ${view.fran}`,
              )
            : l(
                `Per cent of roll calls with the same position · session ${session}${info ? `, ${info.government_name}` : ''}`,
                `Procent av voteringarna med samma ståndpunkt · riksmötet ${session}${info ? `, ${info.government_name}` : ''}`,
              )
        }
        chart={
          record ? (
            <SeriesColumns
              series={recordSeries}
              label={l(record.en, record.sv)}
              format={(v) => pct(v, 0)}
              tick={(d) => d.slice(2, 4)}
            />
          ) : (
            <Bars
              bars={others.map((o) => ({
                key: o.party,
                party: o.party,
                label: `${o.party} · ${partyName(o.party)}`,
                value: o.value,
              }))}
              format={(v) => pct(v, 0)}
              description={l(
                `How often ${partyName(party)} voted like each other party in ${session}: ${others.map((o) => `${o.party} ${Math.round(o.value)} %`).join(', ')}`,
                `Hur ofta ${partyName(party)} röstade som varje annat parti ${session}: ${others.map((o) => `${o.party} ${Math.round(o.value)} %`).join(', ')}`,
              )}
            />
          )
        }
        takeaway={
          record
            ? l(
                'One chart per party on the same scale; each column is one session.',
                'Ett diagram per parti på samma skala; varje kolumn är ett riksmöte.',
              )
            : others[0]
              ? l(
                  `${partyName(party)} voted most often like ${partyName(others[0].party)} (${pct(others[0].value, 0)} of roll calls) and least often like ${partyName(others.at(-1)!.party)} (${pct(others.at(-1)!.value, 0)}).`,
                  `${partyName(party)} röstade oftast som ${partyName(others[0].party)} (${pct(others[0].value, 0)} av voteringarna) och minst ofta som ${partyName(others.at(-1)!.party)} (${pct(others.at(-1)!.value, 0)}).`,
                )
              : ''
        }
        meaning={
          <>
            <p>
              {l(
                'A roll call is a vote where every member’s choice is recorded. A party’s position is what most of its members present voted: yes, no or abstain. Two parties “vote alike” when they took the same position.',
                'En votering är en omröstning där varje ledamots val registreras. Ett partis ståndpunkt är vad flest av dess närvarande ledamöter röstade: ja, nej eller avstår. Två partier ”röstar lika” när de tog samma ståndpunkt.',
              )}
            </p>
            <p>
              {l(
                'Most decisions are uncontroversial, so even rivals often vote alike. The differences between the bars are what tell you something.',
                'De flesta beslut är okontroversiella, så även motståndare röstar ofta lika. Det är skillnaderna mellan staplarna som säger något.',
              )}
            </p>
          </>
        }
        table={record ? recordTable : matrix}
        sources={[
          {
            name: 'Sveriges riksdag, voteringar (öppna data)',
            url: 'https://data.riksdagen.se',
          },
        ]}
        updated={session}
        method={
          <p>
            {l(
              'Every roll call on a decision since 1993/94, from the Riksdag’s own files. “Voted with the government” compares a party with the prime minister’s party. Unity is the share of a party’s members who voted with its majority.',
              'Varje votering om ett beslut sedan 1993/94, ur riksdagens egna filer. ”Röstade som regeringen” jämför ett parti med statsministerns parti. Enighet är andelen av partiets ledamöter som röstade som partiets majoritet.',
            )}
          </p>
        }
        onBuild={() => setBuilding(true)}
        deepLinks={[
          {
            href: '#now-votes',
            label: l('Voting record since 1993', 'Rösthistorik sedan 1993'),
          },
          {
            href: '#politics',
            label: l('Every roll call in detail', 'Varje votering i detalj'),
          },
          {
            href: '#politics-votes',
            label: l('How each member voted', 'Hur varje ledamot röstade'),
          },
          {
            href: '#now-decisions',
            label: l('The latest decisions', 'De senaste besluten'),
          },
        ]}
      />
      <BuilderPanel
        open={building}
        onClose={() => setBuilding(false)}
        onReset={reset}
        title={l('Build your own view: votes', 'Bygg egen vy: röster')}
      >
        <Field label={l('Measure', 'Mått')}>
          <Choice
            name="matt"
            value={measure}
            options={[
              {
                value: 'lika',
                label: l(
                  'How often parties vote alike (one session)',
                  'Hur ofta partierna röstar lika (ett riksmöte)',
                ),
              },
              ...Object.entries(RECORD).map(([key, m]) => ({
                value: key as Measure,
                label: l(`${m.en} (over time)`, `${m.sv} (över tid)`),
              })),
            ]}
            onChange={(matt) => setView({ matt })}
          />
        </Field>
        {measure === 'lika' ? (
          <>
            <Field label={l('Session', 'Riksmöte')}>
              <Select
                label={l('Session', 'Riksmöte')}
                value={session}
                options={sessionOptions}
                onChange={(riksmote) => setView({ riksmote })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label={l('Period', 'Tidsperiod')}>
              <Choice
                name="fran"
                value={view.fran}
                options={['1993', '2006', '2014', '2022'].map((y) => ({
                  value: y,
                  label:
                    y === '1993'
                      ? l('All sessions', 'Alla riksmöten')
                      : l(`Since ${y}`, `Sedan ${y}`),
                }))}
                onChange={(fran) => setView({ fran })}
              />
            </Field>
          </>
        )}
        <Field label={l('Chart type', 'Graftyp')}>
          <p className="ds-small">
            {measure === 'lika'
              ? l(
                  'Bars: one value per party pair. The table shows every pair.',
                  'Staplar: ett värde per partipar. Tabellen visar alla par.',
                )
              : l(
                  'Lines: one value per party and session.',
                  'Linjer: ett värde per parti och riksmöte.',
                )}
          </p>
        </Field>
      </BuilderPanel>
    </>
  )
}
