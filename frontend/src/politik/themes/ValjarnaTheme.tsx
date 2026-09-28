/**
 * Vad väljarna tycker: the parties' support over time, from SCB's party preference survey
 * (PSU, every May and November since 1972) or the Riksdag elections since 1973.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import MultiLineChart, { type Series } from '../../charts/MultiLineChart'
import PartyPicker from '../../parliament/PartyPicker'
import { load, type Elections } from '../../parliament/data'
import {
  PartyTag,
  RIKSDAG_PARTIES,
  partyLine,
  partyName,
} from '../../parties/identity'
import type { Route } from '../../router'
import ThemeLayout from '../ThemeLayout'
import BuilderPanel, { Choice, Field } from '../BuilderPanel'
import { Select, monthName, num, pct, signed } from '../controls'
import { listParam, useViewParams } from '../useViewParams'

type PollRow = {
  survey_month: string
  party: string
  share_pct: number
  margin_of_error_pp: number | null
}

const PERIODS = ['1973', '1994', '2006', '2014', '2022']
const DEFAULTS = {
  partier: RIKSDAG_PARTIES.join(','),
  fran: '2006',
  matt: 'psu',
  osakerhet: '0',
}

export default function ValjarnaTheme({ route }: { route: Route }) {
  const [polls, setPolls] = useState<PollRow[] | null>(null)
  const [elections, setElections] = useState<Elections | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [view, setView, reset] = useViewParams(route, DEFAULTS)
  useEffect(() => {
    Promise.all([
      load<{ polls: PollRow[] }>('parliament/polls.json'),
      load<Elections>('parliament/elections.json'),
    ])
      .then(([p, e]) => {
        setPolls(p.polls)
        setElections(e)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const picked = listParam(view.partier).filter((p) =>
    RIKSDAG_PARTIES.includes(p),
  )
  const toggle = (party: string) =>
    setView({
      partier: (picked.includes(party)
        ? picked.filter((p) => p !== party)
        : [...picked, party]
      ).join(','),
    })
  const from = `${view.fran}-01-01`
  const measure = view.matt === 'val' ? 'val' : 'psu'
  const showBand = view.osakerhet === '1' && measure === 'psu'

  const series: Series[] = useMemo(() => {
    if (!polls || !elections) return []
    return picked.map((party) => ({
      key: party,
      party,
      name: partyName(party),
      points:
        measure === 'psu'
          ? polls
              .filter((p) => p.party === party && p.survey_month >= from)
              .map((p) => ({
                date: p.survey_month,
                label: monthName(p.survey_month),
                value: p.share_pct,
                low:
                  showBand && p.margin_of_error_pp != null
                    ? p.share_pct - p.margin_of_error_pp
                    : null,
                high:
                  showBand && p.margin_of_error_pp != null
                    ? p.share_pct + p.margin_of_error_pp
                    : null,
              }))
          : elections.results
              .filter(
                (r) =>
                  r.party === party &&
                  r.share_pct != null &&
                  r.election_year >= Number(view.fran),
              )
              .map((r) => ({
                date: `${r.election_year}-09-15`,
                label: l(
                  `Election ${r.election_year}`,
                  `Valet ${r.election_year}`,
                ),
                value: r.share_pct!,
              })),
    }))
  }, [polls, elections, picked.join(), measure, from, showBand, view.fran])

  const months = polls
    ? [...new Set(polls.map((p) => p.survey_month))].sort()
    : []
  const latest = months.at(-1)
  const previous = months.at(-2)
  const latestRows =
    polls?.filter(
      (p) => p.survey_month === latest && RIKSDAG_PARTIES.includes(p.party),
    ) ?? []
  const leader = [...latestRows].sort((a, b) => b.share_pct - a.share_pct)[0]
  const moves = latestRows
    .map((row) => {
      const before = polls?.find(
        (p) => p.survey_month === previous && p.party === row.party,
      )
      return before
        ? { party: row.party, change: row.share_pct - before.share_pct }
        : null
    })
    .filter(Boolean) as { party: string; change: number }[]
  const mover = [...moves].sort(
    (a, b) => Math.abs(b.change) - Math.abs(a.change),
  )[0]
  const firstShown = series
    .flatMap((s) => s.points)
    .map((p) => p.date)
    .sort()[0]
  const lastShown = series
    .flatMap((s) => s.points)
    .map((p) => p.date)
    .sort()
    .at(-1)

  const periodOptions = PERIODS.map((year) => ({
    value: year,
    label:
      year === '1973'
        ? l('All years', 'Alla år')
        : l(`Since ${year}`, `Sedan ${year}`),
  }))
  const filters = (
    <>
      <Select
        label={l('Period', 'Tidsperiod')}
        value={view.fran}
        options={periodOptions}
        onChange={(fran) => setView({ fran })}
      />
      <PartyPicker parties={RIKSDAG_PARTIES} picked={picked} toggle={toggle} />
    </>
  )

  // The table: one row per survey (or election) shown, newest first.
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))]
    .sort()
    .reverse()
  const table = (
    <table className="data-table">
      <caption className="visually-hidden">
        {l('Support by party, per cent', 'Stöd per parti, procent')}
      </caption>
      <thead>
        <tr>
          <th scope="col">
            {measure === 'psu' ? l('Survey', 'Mätning') : l('Election', 'Val')}
          </th>
          {picked.map((p) => (
            <th scope="col" key={p}>
              <PartyTag party={p} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dates.map((date) => (
          <tr key={date}>
            <th scope="row">
              {measure === 'psu' ? monthName(date) : date.slice(0, 4)}
            </th>
            {series.map((s) => {
              const point = s.points.find((p) => p.date === date)
              return <td key={s.key}>{point ? pct(point.value) : '–'}</td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )

  const loaded = polls && elections
  return (
    <>
      <ThemeLayout
        question={l(
          'Which parties do voters support?',
          'Vilka partier stöder väljarna?',
        )}
        why={l(
          'Between elections, surveys are the best measure of how support is shifting, and of what the next Riksdag might look like.',
          'Mellan valen är mätningarna det bästa måttet på hur stödet förändras, och på hur nästa riksdag kan komma att se ut.',
        )}
        loading={!loaded && !error}
        error={error}
        kpis={
          leader && latest
            ? [
                {
                  value: pct(leader.share_pct),
                  label: l(
                    `${partyName(leader.party)}, largest in ${monthName(latest)}`,
                    `${partyName(leader.party)}, störst i ${monthName(latest)}`,
                  ),
                },
                ...(mover && previous
                  ? [
                      {
                        value: `${signed(mover.change, 1)} ${l('pts', 'p.e.')}`,
                        label: l(
                          `${partyName(mover.party)}, the largest change since ${monthName(previous)}`,
                          `${partyName(mover.party)}, störst förändring sedan ${monthName(previous)}`,
                        ),
                      },
                    ]
                  : []),
                {
                  value: `±${num(leader.margin_of_error_pp ?? 0, 1)}`,
                  label: l(
                    'points margin of error for the largest party',
                    'procentenheter felmarginal för största partiet',
                  ),
                },
              ]
            : []
        }
        filters={filters}
        chartTitle={
          measure === 'psu'
            ? l(
                'Support in SCB’s party preference survey',
                'Stöd i SCB:s partisympatiundersökning',
              )
            : l('Result in Riksdag elections', 'Resultat i riksdagsvalen')
        }
        chartMeta={l(
          `Per cent of voters · ${firstShown ? (measure === 'psu' ? monthName(firstShown) : firstShown.slice(0, 4)) : ''}–${lastShown ? (measure === 'psu' ? monthName(lastShown) : lastShown.slice(0, 4)) : ''}`,
          `Procent av väljarna · ${firstShown ? (measure === 'psu' ? monthName(firstShown) : firstShown.slice(0, 4)) : ''}–${lastShown ? (measure === 'psu' ? monthName(lastShown) : lastShown.slice(0, 4)) : ''}`,
        )}
        chart={
          picked.length ? (
            <MultiLineChart
              series={series}
              label={l(
                'Support per party over time',
                'Stöd per parti över tid',
              )}
              format={(v) => pct(v)}
              colorOf={partyLine}
            />
          ) : (
            <p className="ds-small">
              {l('Choose at least one party.', 'Välj minst ett parti.')}
            </p>
          )
        }
        takeaway={
          leader && latest
            ? l(
                `In ${monthName(latest)}, ${partyName(leader.party)} was the largest party with ${pct(leader.share_pct)}.`,
                `I ${monthName(latest)} var ${partyName(leader.party)} största parti med ${pct(leader.share_pct)}.`,
              )
            : ''
        }
        meaning={
          <>
            <p>
              {l(
                'Each point is one survey: SCB asks a large random sample of voters which party they would vote for if there were an election that month. The line shows the direction; single steps smaller than the margin of error may be chance.',
                'Varje punkt är en mätning: SCB frågar ett stort slumpmässigt urval av väljare vilket parti de skulle rösta på om det var val den månaden. Linjen visar riktningen; enskilda steg som är mindre än felmarginalen kan bero på slumpen.',
              )}
            </p>
            <p>
              {l(
                'A survey is not an election: people who do not answer, and people who change their mind late, can make the result differ.',
                'En mätning är inte ett val: de som inte svarar, och de som bestämmer sig sent, kan göra att resultatet skiljer sig.',
              )}
            </p>
          </>
        }
        table={table}
        sources={[
          {
            name: 'SCB, Partisympatiundersökningen (PSU)',
            url: 'https://www.scb.se/psu',
          },
          {
            name: 'SCB och Valmyndigheten, riksdagsval',
            url: 'https://www.val.se',
          },
        ]}
        updated={latest ? monthName(latest) : null}
        method={
          <p>
            {l(
              'PSU shares as SCB publishes them, with SCB’s margin of error (95 per cent). Election results from SCB 1973–2022 and Valmyndigheten for 2026. Ny demokrati is not shown: SCB counts its votes among other parties.',
              'PSU-andelar så som SCB publicerar dem, med SCB:s felmarginal (95 procent). Valresultat från SCB 1973–2022 och Valmyndigheten för 2026. Ny demokrati visas inte: SCB räknar dess röster bland övriga partier.',
            )}
          </p>
        }
        onBuild={() => setBuilding(true)}
        deepLinks={[
          {
            href: '#now-history',
            label: l(
              'Every election and survey since 1973',
              'Alla val och mätningar sedan 1973',
            ),
          },
          {
            href: '#parties',
            label: l('One page per party', 'En sida per parti'),
          },
        ]}
      />
      <BuilderPanel
        open={building}
        onClose={() => setBuilding(false)}
        onReset={reset}
        title={l('Build your own view: voters', 'Bygg egen vy: väljarna')}
      >
        <Field label={l('Measure', 'Mått')}>
          <Choice
            name="matt"
            value={measure}
            options={[
              {
                value: 'psu',
                label: l(
                  'Surveys (PSU), twice a year',
                  'Mätningar (PSU), två gånger om året',
                ),
              },
              { value: 'val', label: l('Election results', 'Valresultat') },
            ]}
            onChange={(matt) => setView({ matt })}
          />
        </Field>
        <Field label={l('Period', 'Tidsperiod')}>
          <Choice
            name="fran"
            value={view.fran}
            options={periodOptions}
            onChange={(fran) => setView({ fran })}
          />
        </Field>
        <Field label={l('Parties', 'Partier')}>
          <PartyPicker
            parties={RIKSDAG_PARTIES}
            picked={picked}
            toggle={toggle}
          />
        </Field>
        <Field
          label={l('Uncertainty in the result', 'Osäkerhet i resultatet')}
          hint={l(
            'Shows SCB’s margin of error as a band around each line. Only for surveys.',
            'Visar SCB:s felmarginal som ett band runt varje linje. Bara för mätningar.',
          )}
        >
          <Choice
            name="osakerhet"
            value={view.osakerhet}
            options={[
              { value: '0', label: l('Hide', 'Dölj') },
              {
                value: '1',
                label: l('Show margin of error', 'Visa felmarginal'),
              },
            ]}
            onChange={(osakerhet) => setView({ osakerhet })}
          />
        </Field>
        <Field label={l('Chart type', 'Graftyp')}>
          <p className="ds-small">
            {l(
              'A line chart: the data are shares over time. The table tab shows the same numbers.',
              'Linjediagram: datan är andelar över tid. Fliken Tabell visar samma siffror.',
            )}
          </p>
        </Field>
      </BuilderPanel>
    </>
  )
}
