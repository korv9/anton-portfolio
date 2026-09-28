/**
 * Vad politikerna pratar om: how much of each party's speech is about an issue area, session
 * by session. Words are matched against a lexicon per expenditure area (the budget mart's
 * language table), so talk and money can be compared on the same areas.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import MultiLineChart from '../../charts/MultiLineChart'
import PartyPicker from '../../parliament/PartyPicker'
import { sessionDate } from '../../parliament/data'
import {
  PartyTag,
  RIKSDAG_PARTIES,
  partyLine,
  partyName,
} from '../../parties/identity'
import type { Route } from '../../router'
import ThemeLayout from '../ThemeLayout'
import BuilderPanel, { Choice, Field } from '../BuilderPanel'
import { Select, num, pct } from '../controls'
import { listParam, useViewParams } from '../useViewParams'
import { areaNames, loadBudgetReport, type BudgetReport } from './BudgetTheme'

const DEFAULTS = {
  omrade: '',
  partier: RIKSDAG_PARTIES.join(','),
  kalla: 'issues',
  metod: 'stem',
  fran: '2014',
}

export default function TalTheme({ route }: { route: Route }) {
  const [report, setReport] = useState<BudgetReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [view, setView, reset] = useViewParams(route, DEFAULTS)
  useEffect(() => {
    loadBudgetReport()
      .then(setReport)
      .catch((e: Error) => setError(e.message))
  }, [])

  const corpus = view.kalla === 'leaders' ? 'leaders' : 'issues'
  const method = view.metod === 'exact' ? 'exact' : 'stem'
  const rows = (report?.language.rows ?? []).filter(
    (r) =>
      r.corpus === corpus &&
      r.method === method &&
      Number(r.session.slice(0, 4)) >= Number(view.fran),
  )
  const names = areaNames(report?.budgets ?? [])
  const sessions = [...new Set(rows.map((r) => r.session))].sort()
  const latest = sessions.at(-1) ?? ''
  const areas = [...new Set(rows.map((r) => r.expenditure_area))].sort(
    (a, b) => a - b,
  )
  // Default: the area where the parties differ most in the latest session, the most telling.
  const spread = (area: number) => {
    const values = rows
      .filter((r) => r.session === latest && r.expenditure_area === area)
      .map((r) => r.keyword_share_pct)
    return values.length ? Math.max(...values) - Math.min(...values) : 0
  }
  const area = areas.includes(Number(view.omrade))
    ? Number(view.omrade)
    : [...areas].sort((a, b) => spread(b) - spread(a))[0]
  const areaName = names.get(area) ?? String(area)
  const picked = listParam(view.partier).filter((p) =>
    RIKSDAG_PARTIES.includes(p),
  )
  const toggle = (p: string) =>
    setView({
      partier: (picked.includes(p)
        ? picked.filter((x) => x !== p)
        : [...picked, p]
      ).join(','),
    })
  const series = picked.map((party) => ({
    key: party,
    party,
    name: partyName(party),
    points: rows
      .filter((r) => r.party === party && r.expenditure_area === area)
      .sort((a, b) => a.session.localeCompare(b.session))
      .map((r) => ({
        date: sessionDate(r.session),
        label: r.session,
        value: r.keyword_share_pct,
      })),
  }))
  const latestByParty = rows
    .filter(
      (r) =>
        r.session === latest &&
        r.expenditure_area === area &&
        RIKSDAG_PARTIES.includes(r.party),
    )
    .sort((a, b) => b.keyword_share_pct - a.keyword_share_pct)
  const most = latestByParty[0]
  const least = latestByParty.at(-1)
  const coverage = (report?.language.coverage ?? []).filter(
    (c) =>
      c.corpus === corpus &&
      c.method === method &&
      Number(c.session.slice(0, 4)) >= Number(view.fran),
  )
  const speeches = coverage.reduce((s, c) => s + c.speeches, 0)
  const keywords = (report?.language.lexicon ?? [])
    .filter((k) => Number(k.expenditure_area) === area)
    .map((k) => k.keyword)

  const corpusName =
    corpus === 'leaders'
      ? l('party-leader debates', 'partiledardebatterna')
      : l('all issue debates', 'alla sakdebatter')
  const areaOptions = areas.map((a) => ({
    value: String(a),
    label: names.get(a) ?? String(a),
  }))
  const filters = (
    <>
      <Select
        label={l('Issue area', 'Sakområde')}
        value={String(area)}
        options={areaOptions}
        onChange={(omrade) => setView({ omrade })}
      />
      <PartyPicker parties={RIKSDAG_PARTIES} picked={picked} toggle={toggle} />
    </>
  )
  const table = (
    <table className="data-table">
      <caption className="visually-hidden">
        {l(
          `Share of speech about ${areaName}`,
          `Andel av talet om ${areaName}`,
        )}
      </caption>
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
        {[...sessions].reverse().map((s) => (
          <tr key={s}>
            <th scope="row">{s}</th>
            {picked.map((p) => {
              const r = rows.find(
                (x) =>
                  x.session === s &&
                  x.party === p &&
                  x.expenditure_area === area,
              )
              return <td key={p}>{r ? pct(r.keyword_share_pct) : '–'}</td>
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
          'What do politicians talk about?',
          'Vad pratar politikerna om?',
        )}
        why={l(
          'What a party talks about shows what it wants voters to think about. Following it over time shows how priorities shift.',
          'Det ett parti pratar om visar vad det vill att väljarna ska tänka på. Följer man det över tid syns hur prioriteringarna förändras.',
        )}
        loading={!report && !error}
        error={error}
        kpis={
          most && least
            ? [
                {
                  value: num(speeches),
                  label: l(
                    `speeches read, ${corpusName}`,
                    `tal lästa, ${corpusName}`,
                  ),
                },
                {
                  value: pct(most.keyword_share_pct),
                  label: l(
                    `${partyName(most.party)} talks most about ${areaName} (${latest})`,
                    `${partyName(most.party)} pratar mest om ${areaName} (${latest})`,
                  ),
                },
                {
                  value: pct(least.keyword_share_pct),
                  label: l(
                    `${partyName(least.party)} talks least about it`,
                    `${partyName(least.party)} pratar minst om det`,
                  ),
                },
              ]
            : []
        }
        filters={filters}
        chartTitle={l(
          `How much the parties talk about ${areaName}`,
          `Hur mycket partierna pratar om ${areaName}`,
        )}
        chartMeta={l(
          `Per cent of each party’s issue words · ${corpusName} · ${sessions[0] ?? ''}–${latest}`,
          `Procent av partiets ämnesord · ${corpusName} · ${sessions[0] ?? ''}–${latest}`,
        )}
        chart={
          picked.length ? (
            <MultiLineChart
              series={series}
              label={l(
                `Share of speech about ${areaName}`,
                `Andel av talet om ${areaName}`,
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
          most && least
            ? l(
                `In ${latest}, ${pct(most.keyword_share_pct)} of ${partyName(most.party)}’s issue words were about ${areaName}, compared with ${pct(least.keyword_share_pct)} for ${partyName(least.party)}.`,
                `Under ${latest} handlade ${pct(most.keyword_share_pct)} av ${partyName(most.party)}s ämnesord om ${areaName}, mot ${pct(least.keyword_share_pct)} för ${partyName(least.party)}.`,
              )
            : ''
        }
        meaning={
          <>
            <p>
              {l(
                'Every speech is read for words linked to each of the budget’s 27 areas. The chart shows how large a part of a party’s such words concern the chosen area. The shares of all areas add up to 100 per cent per party and session. Unless you choose one, the area shown is the one where the parties differed most in the latest session.',
                'Varje tal läses efter ord som hör till var och en av budgetens 27 områden. Grafen visar hur stor del av ett partis sådana ord som gäller det valda området. Alla områdens andelar blir tillsammans 100 procent per parti och riksmöte. Om du inte väljer själv visas det område där partierna skilde sig mest under senaste riksmötet.',
              )}
            </p>
            <p>
              {l(
                'Talking about something is not the same as being for or against it: the count says nothing about the party’s position.',
                'Att prata om något är inte detsamma som att vara för eller emot: räkningen säger inget om partiets ståndpunkt.',
              )}
            </p>
          </>
        }
        table={table}
        sources={[
          {
            name: 'Sveriges riksdag, anföranden (öppna data)',
            url: 'https://data.riksdagen.se',
          },
        ]}
        updated={latest}
        method={
          <>
            <p>{report?.language.definition}</p>
            <p>
              {l('Words counted for this area', 'Ord som räknas för området')}:{' '}
              {keywords.slice(0, 20).join(', ')}
              {keywords.length > 20 ? ' …' : ''}
            </p>
          </>
        }
        onBuild={() => setBuilding(true)}
        deepLinks={[
          {
            href: '#debates',
            label: l(
              'Map of similar political speeches',
              'Karta över liknande politiska tal',
            ),
          },
          {
            href: '#data-explorer',
            label: l('Search and read the speeches', 'Sök och läs talen'),
          },
          {
            href: '#budget-explore',
            label: l('Talk compared with money', 'Tal jämfört med pengar'),
          },
        ]}
      />
      <BuilderPanel
        open={building}
        onClose={() => setBuilding(false)}
        onReset={reset}
        title={l('Build your own view: speeches', 'Bygg egen vy: tal')}
      >
        <Field label={l('Issue area', 'Sakområde')}>
          <Select
            label={l('Issue area', 'Sakområde')}
            value={String(area)}
            options={areaOptions}
            onChange={(omrade) => setView({ omrade })}
          />
        </Field>
        <Field label={l('Parties', 'Partier')}>
          <PartyPicker
            parties={RIKSDAG_PARTIES}
            picked={picked}
            toggle={toggle}
          />
        </Field>
        <Field label={l('Period', 'Tidsperiod')}>
          <Choice
            name="fran"
            value={view.fran}
            options={['2014', '2018', '2022'].map((y) => ({
              value: y,
              label:
                y === '2014'
                  ? l(
                      'All sessions (from 2014/15)',
                      'Alla riksmöten (från 2014/15)',
                    )
                  : l(`Since ${y}`, `Sedan ${y}`),
            }))}
            onChange={(fran) => setView({ fran })}
          />
        </Field>
        <Field label={l('Speeches', 'Tal')}>
          <Choice
            name="kalla"
            value={corpus}
            options={[
              {
                value: 'issues',
                label: l('All issue debates', 'Alla sakdebatter'),
              },
              {
                value: 'leaders',
                label: l(
                  'Party-leader debates only',
                  'Bara partiledardebatter',
                ),
              },
            ]}
            onChange={(kalla) => setView({ kalla })}
          />
        </Field>
        <Field
          label={l('Measure', 'Mått')}
          hint={l(
            'Word stems also count inflected forms (“skola”, “skolor”).',
            'Ordstammar räknar även böjda former (”skola”, ”skolor”).',
          )}
        >
          <Choice
            name="metod"
            value={method}
            options={[
              { value: 'stem', label: l('Word stems', 'Ordstammar') },
              { value: 'exact', label: l('Exact words', 'Exakta ord') },
            ]}
            onChange={(metod) => setView({ metod })}
          />
        </Field>
        <Field label={l('Chart type', 'Graftyp')}>
          <p className="ds-small">
            {l(
              'Lines: one share per party and session.',
              'Linjer: en andel per parti och riksmöte.',
            )}
          </p>
        </Field>
      </BuilderPanel>
    </>
  )
}
