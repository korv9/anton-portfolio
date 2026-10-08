/**
 * The issue debates, analysed for one party (or the Riksdag as a whole when none is chosen).
 * The page reads in one order: what the party's debating is about, how that differs from the
 * other parties, how its focus has changed, and which words characterise it. Relative measures
 * throughout (shares of utterances, words per 10,000, percentage points against the others);
 * the party, topic and period live in the address: ?partier=MP&amne=miljo&from=2022&to=2025.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { load } from '../../parliament/data'
import type { Route } from '../../router'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  partyFill,
  partyName,
} from '../../parties/identity'
import { useParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import { num, pct } from '../controls'
import {
  commonTerms,
  compareWithOthers,
  distinctiveTerms,
  genericTerms,
  othersTerms,
  sessionsIn,
  shares,
  startYear,
  termCounts,
  topicChange,
  topicSeries,
  topicWeights,
  type SakData,
} from '../analytics/issues'
import { Bars, Heatmap, Info, Insight, Kpi, PartyMark } from '../story/parts'
import { AgendaLines } from '../story/Debatterna'
import '../story/story.css'

const DEFAULTS = { amne: '', from: '', to: '', serie: '' }
/** The Riksdag's most used words, left out of "most used" as saying nothing about a subject. */
const GENERIC = 150

export default function SakAnalys({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, DEFAULTS)
  const { selected } = useParties(route)
  const [data, setData] = useState<SakData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    load<SakData>('politics/parliament/sakdebatter.json')
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  const party = selected.find((p) => RIKSDAG_PARTIES.includes(p)) ?? null
  const years = useMemo(
    () => data?.topics.map((t) => startYear(t.session)) ?? [],
    [data],
  )
  const termYears = data?.terms.map((t) => startYear(t.session)) ?? []
  const first = years[0] ?? 1993
  const last = years.at(-1) ?? 2025
  const from = years.includes(Number(view.from))
    ? Number(view.from)
    : (termYears[0] ?? last)
  const to =
    years.includes(Number(view.to)) && Number(view.to) >= from
      ? Number(view.to)
      : last

  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!data)
    return (
      <div
        className="story-skeleton"
        role="status"
        aria-label={l('Loading', 'Laddar')}
      >
        <span />
        <span />
        <span />
      </div>
    )

  const name = (k: string) => {
    const i = data.issues.find((x) => x.key === k)
    return i ? l(i.en, i.sv) : k
  }
  const rows = sessionsIn(data.topics, from, to)
  const span = to - from + 1
  const before = sessionsIn(data.topics, from - span, from - 1)
  const object = party ? partyName(party) : l('The Riksdag', 'Riksdagen')
  const own = topicWeights(rows, party)
  const topShares = shares(own.weights)
  const largest = topShares[0]
  const change = before.length ? topicChange(before, rows, party) : []
  const rising = change.filter((c) => c.now >= 1)[0]
  const compare = party ? compareWithOthers(rows, party) : []
  const over = compare
    .filter((c) => c.own >= 1)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
  const period =
    from === to
      ? `${from}/${String(from + 1).slice(2)}`
      : `${from}/${String(from + 1).slice(2)}–${to}/${String(to + 1).slice(2)}`
  const amne = data.issues.some((i) => i.key === view.amne) ? view.amne : ''

  // Time series: the chosen topics, or the party's four largest in the period.
  const chosenSeries = view.serie
    ? view.serie.split(',').filter((k) => data.issues.some((i) => i.key === k))
    : []
  const seriesKeys = chosenSeries.length
    ? chosenSeries
    : amne
      ? [amne]
      : topShares.slice(0, 4).map((x) => x.key)
  const seriesRows = sessionsIn(
    data.topics,
    Math.min(from, to - 9 < first ? first : to - 9),
    to,
  )
  const series = topicSeries(seriesRows, party, seriesKeys)
  const othersSeries =
    party && amne
      ? seriesRows.map((r) => {
          const o = shares(topicWeights([r], null, party).weights)
          return o.find((x) => x.key === amne)?.pct ?? 0
        })
      : null

  // Terms: the riksmöten with full text inside the period, else the latest available.
  const termRows = sessionsIn(data.terms, from, to).length
    ? sessionsIn(data.terms, from, to)
    : data.terms
  const termPeriod = termRows.map((t) => t.session)
  const ownTerms = termCounts(termRows, party)
  const common = commonTerms(ownTerms, 12, genericTerms(data.terms, GENERIC))
  const distinct = party
    ? distinctiveTerms(ownTerms, othersTerms(termRows, party), 12)
    : distinctiveTerms(
        termCounts(termRows.slice(-1), null),
        termCounts(termRows.slice(0, -1), null),
        12,
      )
  const word = (s: string) => data.words[s] ?? s

  return (
    <article className="story sak">
      <header className="story-hero">
        <p className="story-eyebrow">{l('Issue debates', 'Sakdebatter')}</p>
        <h1>
          {party && <PartyLogo party={party} size={40} />} {object}:{' '}
          {l('issue debates', 'sakdebatter')}
        </h1>
        <p className="story-sub">
          {l(
            'Which issues get the most room, which words are used, and how has the focus changed?',
            'Vilka frågor får mest utrymme, vilka begrepp används och hur har fokus förändrats?',
          )}
        </p>
        <div
          className="story-filters"
          role="group"
          aria-label={l('Filters', 'Filter')}
        >
          <label>
            {l('From', 'Från')}
            <select
              value={from}
              onChange={(e) =>
                setView({
                  from: e.target.value,
                  to: String(Math.max(Number(e.target.value), to)),
                })
              }
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}/{String(y + 1).slice(2)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {l('To', 'Till')}
            <select
              value={to}
              onChange={(e) => setView({ to: e.target.value })}
            >
              {years
                .filter((y) => y >= from)
                .map((y) => (
                  <option key={y} value={y}>
                    {y}/{String(y + 1).slice(2)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {l('Topic', 'Ämne')}
            <select
              value={amne}
              onChange={(e) => setView({ amne: e.target.value })}
            >
              <option value="">{l('All topics', 'Alla ämnen')}</option>
              {data.issues.map((i) => (
                <option key={i.key} value={i.key}>
                  {l(i.en, i.sv)}
                </option>
              ))}
            </select>
          </label>
          <p className="story-meta">
            {party
              ? l(
                  'Change the party in the party bar above.',
                  'Byt parti i partiraden ovanför.',
                )
              : l(
                  'Choose a party in the party bar above to analyse it.',
                  'Välj ett parti i partiraden ovanför för att analysera det.',
                )}
          </p>
        </div>
        <dl className="story-kpis">
          <Kpi
            value={num(own.debates)}
            label={l('Debates analysed', 'Analyserade debatter')}
            note={period}
          />
          <Kpi
            value={num(own.utterances)}
            label={
              party
                ? l(`Utterances by ${party}`, `Yttranden från ${party}`)
                : l('Utterances', 'Yttranden')
            }
            note={l('speeches and replies', 'anföranden och repliker')}
          />
          <Kpi
            value={largest ? name(largest.key) : '–'}
            label={l('Largest issue area', 'Största ämnesområde')}
            note={largest ? pct(largest.pct, 0) : undefined}
          />
          <Kpi
            value={rising ? name(rising.key) : '–'}
            label={l('Rising most', 'Ökar mest')}
            note={
              rising
                ? `+${num(rising.change, 1)} ${l('points', 'p.e.')} ${l('on', 'mot')} ${before[0].session.slice(0, 4)}–${before.at(-1)!.session.slice(0, 4)}`
                : l('no earlier period', 'ingen tidigare period')
            }
          />
        </dl>
      </header>

      <section
        className="story-section sak-standout"
        aria-labelledby="sak-standout"
      >
        <h2 id="sak-standout" className="story-kicker">
          {l('What stands out', 'Det här sticker ut')}
        </h2>
        {party && over[0] ? (
          <p className="sak-standout-text">
            {l(
              `In ${period}, ${partyName(party)} gave a larger share of its utterances to ${name(over[0].key).toLowerCase()}${over[1] ? ` and ${name(over[1].key).toLowerCase()}` : ''} than the other parties did (${num(over[0].ratio ?? 0, 1)}× ${over[1] ? `and ${num(over[1].ratio ?? 0, 1)}× ` : ''}their share). ${largest ? `${name(largest.key)} was its largest area, at ${pct(largest.pct, 0)}.` : ''}`,
              `Under ${period} ägnade ${partyName(party)} en större andel av sina yttranden åt ${name(over[0].key).toLowerCase()}${over[1] ? ` och ${name(over[1].key).toLowerCase()}` : ''} än övriga partier (${num(over[0].ratio ?? 0, 1)}× ${over[1] ? `och ${num(over[1].ratio ?? 0, 1)}× ` : ''}deras andel). ${largest ? `${name(largest.key)} var partiets största område, ${pct(largest.pct, 0)}.` : ''}`,
            )}
          </p>
        ) : (
          <p className="sak-standout-text">
            {largest &&
              l(
                `In ${period}, ${name(largest.key).toLowerCase()} took the largest share of the Riksdag's issue debates (${pct(largest.pct, 0)})${rising ? `; ${name(rising.key).toLowerCase()} grew most on the period before (+${num(rising.change, 1)} points)` : ''}.`,
                `Under ${period} tog ${name(largest.key).toLowerCase()} störst andel av riksdagens sakdebatter (${pct(largest.pct, 0)})${rising ? `; ${name(rising.key).toLowerCase()} ökade mest mot perioden innan (+${num(rising.change, 1)} procentenheter)` : ''}.`,
              )}
          </p>
        )}
      </section>

      <section className="story-section" aria-labelledby="sak-q1">
        <h2 id="sak-q1">
          {party
            ? l(
                `Which issues does ${party} talk about most?`,
                `Vilka frågor pratar ${party} mest om?`,
              )
            : l(
                'Which issues get the most room?',
                'Vilka frågor får mest utrymme?',
              )}
        </h2>
        <p className="story-lead">
          <Info term={l('Share of utterances', 'Andel av yttrandena')}>
            {l(
              'The party’s speeches and replies in debates on each issue area, of all its speeches and replies in the period. A debate’s area comes from the committee that prepared its decision; a debate with two areas counts half for each.',
              'Partiets anföranden och repliker i debatter om varje område, av alla dess anföranden och repliker under perioden. Debattens område kommer från utskottet som beredde beslutet; en debatt med två områden räknas till hälften för vardera.',
            )}
          </Info>{' '}
          · {period}
        </p>
        <Bars
          rows={topShares.slice(0, 12).map((s) => ({
            key: s.key,
            label: name(s.key),
            value: s.pct,
            color:
              amne && s.key !== amne
                ? 'var(--line-strong)'
                : party
                  ? partyFill(party)
                  : 'var(--ink)',
          }))}
          format={(v) => pct(v, 1)}
          label={l(
            'Share of utterances per issue area',
            'Andel av yttrandena per ämnesområde',
          )}
          onPick={(k) => setView({ amne: k === amne ? '' : k })}
          picked={amne || null}
        />
        <p className="story-axis-note">
          {l(
            'Click an area to follow it below.',
            'Klicka på ett område för att följa det nedan.',
          )}
        </p>
      </section>

      <section className="story-section" aria-labelledby="sak-q2">
        <h2 id="sak-q2">
          {party
            ? l(
                `How does ${party} differ from the other parties?`,
                `Hur skiljer sig ${party} från övriga partier?`,
              )
            : l(
                'How do the parties differ from each other?',
                'Hur skiljer sig partierna från varandra?',
              )}
        </h2>
        {party ? (
          <>
            <p className="story-lead">
              <Info
                term={l('Difference from the others', 'Skillnad mot övriga')}
              >
                {l(
                  `${partyName(party)}’s share of its utterances minus the other parties’ combined share, in percentage points; the ratio says how many times larger.`,
                  `${partyName(party)}s andel av sina yttranden minus övriga partiers sammanlagda andel, i procentenheter; kvoten säger hur många gånger större.`,
                )}
              </Info>
            </p>
            <ol
              className="story-diverge sak-diverge"
              aria-label={l(
                'Difference from the other parties per issue area',
                'Skillnad mot övriga partier per område',
              )}
            >
              {[...compare.slice(0, 5), ...compare.slice(-5)]
                .filter(
                  (c, i, all) => all.findIndex((x) => x.key === c.key) === i,
                )
                .map((c) => {
                  const maxDiff = Math.max(
                    ...compare.map((x) => Math.abs(x.diff)),
                    1,
                  )
                  return (
                    <li key={c.key}>
                      <span className="story-diverge-label">{name(c.key)}</span>
                      <span className="story-diverge-track">
                        <span
                          className={c.diff >= 0 ? 'up' : 'down'}
                          style={{
                            width: `${(Math.abs(c.diff) / maxDiff) * 50}%`,
                            background:
                              c.diff >= 0 ? partyFill(party) : 'var(--muted)',
                          }}
                        />
                      </span>
                      <span className="story-diverge-value sak-diff">
                        {c.diff >= 0 ? '+' : '−'}
                        {num(Math.abs(c.diff), 1)} {l('pts', 'p.e.')}
                        {c.ratio != null && <small> {num(c.ratio, 1)}×</small>}
                      </span>
                    </li>
                  )
                })}
            </ol>
            <p className="story-axis-note">
              {l(
                '← less than the others · more than the others →',
                '← mindre än övriga · mer än övriga →',
              )}
            </p>
            {over[0] && compare.at(-1) && (
              <Insight>
                {l(
                  `${name(over[0].key)}: ${num(over[0].ratio ?? 0, 1)}× the other parties’ share (${pct(over[0].own, 1)} against ${pct(over[0].others, 1)}). ${name(compare.at(-1)!.key)}: ${num(compare.at(-1)!.diff, 1)} points against the others.`,
                  `${name(over[0].key)}: ${num(over[0].ratio ?? 0, 1)}× övriga partiers andel (${pct(over[0].own, 1)} mot ${pct(over[0].others, 1)}). ${name(compare.at(-1)!.key)}: ${num(compare.at(-1)!.diff, 1)} procentenheter mot övriga.`,
                )}
              </Insight>
            )}
          </>
        ) : (
          <>
            <p className="story-lead">
              {l(
                'Each party’s share minus the Riksdag’s, in percentage points, for the eight largest areas. Darker: further from the Riksdag, in either direction; the sign says which.',
                'Varje partis andel minus riksdagens, i procentenheter, för de åtta största områdena. Mörkare: längre från riksdagen, åt något håll; tecknet säger vilket.',
              )}
            </p>
            <Heatmap
              rows={RIKSDAG_PARTIES}
              cols={topShares.slice(0, 8).map((s) => s.key)}
              value={(p, k) => {
                const o =
                  shares(topicWeights(rows, p).weights).find((x) => x.key === k)
                    ?.pct ?? 0
                return o - (topShares.find((x) => x.key === k)?.pct ?? 0)
              }}
              format={(v) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v), 1)}`}
              label={l(
                'Difference from the Riksdag per party and area',
                'Skillnad mot riksdagen per parti och område',
              )}
              min={0}
              max={10}
              shade={Math.abs}
              rowLabel={(r) => <PartyMark party={r} />}
              colLabel={name}
              title={(p, k, v) =>
                `${partyName(p)} · ${name(k)}: ${v >= 0 ? '+' : ''}${num(v, 1)} p.e.`
              }
            />
            <p className="story-axis-note">
              {l(
                'Choose a party in the party bar for its own analysis.',
                'Välj ett parti i partiraden för dess egen analys.',
              )}
            </p>
          </>
        )}
      </section>

      <section className="story-section" aria-labelledby="sak-q3">
        <h2 id="sak-q3">
          {l('How has the focus changed?', 'Hur har fokus förändrats?')}
        </h2>
        <p className="story-lead">
          {amne && party
            ? l(
                `${name(amne)}: ${partyName(party)}’s share against the other parties’, per riksmöte.`,
                `${name(amne)}: ${partyName(party)}s andel mot övriga partiers, per riksmöte.`,
              )
            : l(
                `Share of ${party ? `${party}’s` : 'all'} utterances per riksmöte, for up to five areas. Choose the areas below.`,
                `Andel av ${party ? `${party}s` : 'alla'} yttranden per riksmöte, för upp till fem områden. Välj områdena nedan.`,
              )}
        </p>
        <AgendaLines
          agenda={
            othersSeries
              ? series.map((r, i) => ({
                  session: r.session,
                  shares: { [amne]: r.shares[amne], __others: othersSeries[i] },
                }))
              : series
          }
          shown={othersSeries ? [amne, '__others'] : seriesKeys}
          name={(k) =>
            k === '__others'
              ? l('The other parties', 'Övriga partier')
              : party && othersSeries
                ? `${party}: ${name(k)}`
                : name(k)
          }
        />
        {!othersSeries && (
          <div
            className="story-chips"
            role="group"
            aria-label={l('Areas', 'Områden')}
          >
            {topShares.slice(0, 12).map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={seriesKeys.includes(s.key)}
                onClick={() => {
                  const next = seriesKeys.includes(s.key)
                    ? seriesKeys.filter((k) => k !== s.key)
                    : [...seriesKeys, s.key].slice(-5)
                  setView({ serie: next.join(',') })
                }}
              >
                {name(s.key)}
              </button>
            ))}
          </div>
        )}
        {series.length > 1 && (
          <Insight>
            {(() => {
              const k = othersSeries ? amne : seriesKeys[0]
              if (!k) return null
              const a = series[0].shares[k]
              const b = series.at(-1)!.shares[k]
              return l(
                `${name(k)} went from ${pct(a, 1)} in ${series[0].session} to ${pct(b, 1)} in ${series.at(-1)!.session} of ${party ? `${party}’s` : 'all'} utterances.`,
                `${name(k)} gick från ${pct(a, 1)} ${series[0].session} till ${pct(b, 1)} ${series.at(-1)!.session} av ${party ? `${party}s` : 'alla'} yttranden.`,
              )
            })()}
          </Insight>
        )}
      </section>

      <section className="story-section" aria-labelledby="sak-q4">
        <h2 id="sak-q4">
          {party
            ? l(
                `Which words characterise ${party}’s debating?`,
                `Vilka ord och begrepp kännetecknar ${party}s debatter?`,
              )
            : l(
                'Which words characterise the debates?',
                'Vilka ord och begrepp kännetecknar debatterna?',
              )}
        </h2>
        <p className="story-lead">
          {l('Words in', 'Ord i')} {termPeriod[0]}–{termPeriod.at(-1)}
          {sessionsIn(data.terms, from, to).length
            ? ''
            : l(
                ' (the full text covers the latest riksmöten)',
                ' (hela texten finns för de senaste riksmötena)',
              )}
          {amne && l('; across all areas', '; över alla områden')}.
        </p>
        <div className="story-two">
          <div>
            <h3>
              <Info term={l('Most used', 'Vanligast')}>
                {l(
                  `The words used most, per 10,000 words, leaving out the ${GENERIC} words most used in the whole Riksdag (such as “will”, “earlier”, “more”), which say nothing about the subject.`,
                  `De mest använda orden, per 10 000 ord, utom de ${GENERIC} vanligaste orden i hela riksdagen (som ”kommer”, ”tidigare”, ”mer”), som inte säger något om ämnet.`,
                )}
              </Info>
            </h3>
            <ol className="story-terms">
              {common.map((t) => (
                <li key={t.stem}>
                  <span>{word(t.stem)}</span>
                  <small>{num(t.per10k, 1)} / 10 000</small>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3>
              <Info
                term={
                  party
                    ? l(
                        `Most distinctive for ${party}`,
                        `Mest särskiljande för ${party}`,
                      )
                    : l(
                        `Most distinctive for ${termPeriod.at(-1)}`,
                        `Mest särskiljande för ${termPeriod.at(-1)}`,
                      )
                }
              >
                {party
                  ? l(
                      `Words ${partyName(party)} used relatively more often than the other parties: the log-odds ratio of its use against theirs, with an informative Dirichlet prior from all parties, as a z-score. Shown per 10,000 words, the party’s against the others’.`,
                      `Ord som ${partyName(party)} använde relativt oftare än övriga partier: log-odds-kvoten för partiets användning mot deras, med en informativ Dirichlet-prior från alla partier, som z-värde. Visas per 10 000 ord, partiets mot övrigas.`,
                    )
                  : l(
                      'Words used relatively more in the latest riksmöte than in the ones before (log-odds with an informative Dirichlet prior, z-score).',
                      'Ord som användes relativt oftare det senaste riksmötet än de före (log-odds med informativ Dirichlet-prior, z-värde).',
                    )}
              </Info>
            </h3>
            <ol className="story-terms">
              {distinct.map((t) => (
                <li key={t.stem}>
                  <span>{word(t.stem)}</span>
                  <small>
                    {num(t.per10k, 1)} {l('vs', 'mot')} {num(t.otherPer10k, 1)}
                  </small>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="story-axis-note">
          {l(
            'Per 10,000 words. Names of people are left out.',
            'Per 10 000 ord. Personnamn är utelämnade.',
          )}
        </p>
      </section>
    </article>
  )
}
