/**
 * Replik (#replik): 33 years of the Riksdag, read and counted. A head with KPIs, then six sections,
 * each a chart from a committed file with a legend only (compute.ts); method folds away at the
 * foot. Every party gets the same chart, size and ink; nothing ranks the parties.
 */
import { useEffect, useState } from 'react'
import { currentLocale, l } from '../i18n'
import { fetchJson } from '../dataSource'
import { ProjectSection } from '../ui/Project'
import PageHead, { Legend, Method, type Kpi } from '../ui/PageHead'
import MultiLineChart from '../charts/MultiLineChart'
import RankBars from '../charts/RankBars'
import { partyName } from '../parties/identity'
import Spark from './Spark'
import SentencePlacer from '../clusters/SentencePlacer'
import { MAPS } from '../clusters/ClusterVisualsPage'
import '../clusters/clusters.css'
import {
  PARTIES,
  aiByYear,
  byDecade,
  clean,
  decades,
  eraGrid,
  governments,
  partialYears,
  profile,
  record,
  topicId,
  topicName,
  yearly,
  type DebateTopics,
  type Eras,
  type PartyYear,
  type Polar,
  type Sessions,
  type Story,
  type TalkVote,
} from './compute'
import './replik.css'

function useJson<T>(path: string): T | null {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    fetchJson<T>(path).then(
      (v) => live && setValue(v),
      (e: Error) => console.warn(e.message),
    )
    return () => {
      live = false
    }
  }, [path])
  return value
}

const locale = () => (currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')
const num = (v: number, digits = 0) =>
  v.toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
/** A value already in percent. */
const pct = (v: number, digits = 1) =>
  l(`${num(v, digits)}%`, `${num(v, digits)} %`)
/** A share between 0 and 1, as a percent. */
const sh = (v: number, digits = 1) => pct(v * 100, digits)
const range = (a: number, b: number, digits = 1) =>
  l(
    `${num(a, digits)}–${num(b, digits)}%`,
    `${num(a, digits)}–${num(b, digits)} %`,
  )
const decadeName = (d: string) => l(`${d}s`, `${d}-talet`)
const tn = (d: DebateTopics, id: number) => {
  const [en, sv] = topicName(d, id)
  return l(en, sv)
}

function EraSection({ eras }: { eras: Eras | null }) {
  if (!eras) return null
  const { eras: cols, ids, label, cells } = eraGrid(eras)
  const max = Math.max(...cells.flat())
  return (
    <ProjectSection
      id="replik-eras"
      title={l('Eras in the chamber', 'Epoker i kammaren')}
    >
      <figure className="rk-figure">
        <div
          className="rk-heat"
          role="table"
          aria-label={l(
            'Share of debate words per topic in each era',
            'Andel debattord per ämne i varje epok',
          )}
          style={{ ['--cols' as string]: cols.length }}
        >
          <div role="row" className="rk-heat-row">
            <span role="columnheader" />
            {cols.map((e) => (
              <span role="columnheader" key={e.name} className="rk-heat-col">
                {e.name}
              </span>
            ))}
          </div>
          {ids.map((id, i) => (
            <div role="row" className="rk-heat-row" key={id}>
              <span role="rowheader" className="rk-heat-label" lang="sv">
                {label.get(id)}
              </span>
              {cells[i].map((v, j) => {
                const t = v / max
                return (
                  <span
                    role="cell"
                    key={j}
                    className={`rk-heat-cell${t > 0.55 ? ' is-dark' : ''}`}
                    style={{
                      background: `color-mix(in srgb, var(--ink) ${Math.round(t * 88)}%, var(--page))`,
                    }}
                    title={`${label.get(id)}, ${cols[j].name}: ${sh(v)}`}
                  >
                    {sh(v, 0)}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
        <figcaption>
          <Legend source="clusters/riksdag-eras.json">
            {l(
              `Share of each era's party-leader debate words per topic, %, ${eras.topic_shares.sessions[0]}–${eras.topic_shares.sessions.at(-1)}`,
              `Andel av epokens ord i partiledardebatterna per ämne, %, ${eras.topic_shares.sessions[0]}–${eras.topic_shares.sessions.at(-1)}`,
            )}
          </Legend>
        </figcaption>
      </figure>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- 2. per party

function PartySection({ topics }: { topics: DebateTopics | null }) {
  const all = topics ? decades(topics) : []
  const [picked, setPicked] = useState<string | null>(null)
  if (!topics || !all.length) return null
  const decade = picked ?? all.at(-1)!
  const profiles = PARTIES.map((p) => ({
    party: p,
    profile: profile(topics, decade, p),
  }))
  const scale = Math.max(
    ...profiles.flatMap((p) => p.profile?.top.map((t) => t.value) ?? [0]),
  )
  return (
    <ProjectSection
      id="replik-parties"
      title={l('Topics per party', 'Ämnen per parti')}
    >
      <div
        className="rk-pick"
        role="group"
        aria-label={l('Decade', 'Årtionde')}
      >
        {all.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === decade}
            onClick={() => setPicked(d)}
          >
            {decadeName(d)}
          </button>
        ))}
      </div>
      <div className="rk-parties">
        {profiles.map(({ party, profile: p }) => (
          <section
            key={party}
            className="rk-party"
            aria-label={partyName(party)}
          >
            <h3>
              {partyName(party)} <span>{party}</span>
            </h3>
            {p ? (
              <>
                <RankBars
                  label={l(
                    `${partyName(party)}: five largest topics, ${decadeName(decade)}`,
                    `${partyName(party)}: fem största ämnena, ${decadeName(decade)}`,
                  )}
                  max={scale}
                  format={(v) => sh(v)}
                  rows={p.top.map((t) => ({
                    key: String(t.id),
                    label: tn(topics, t.id),
                    value: t.value,
                    text: sh(t.value),
                    note: ` ${range(t.low * 100, t.high * 100)}`,
                  }))}
                />
                {p.distinctive && (
                  <p className="rk-party-own">
                    {l('Most its own: ', 'Mest sitt eget: ')}
                    <strong>{tn(topics, p.distinctive.id)}</strong>
                    {l(
                      `, ${num(p.distinctive.ratio, 1)}× the other parties`,
                      `, ${num(p.distinctive.ratio, 1)}× de andra partierna`,
                    )}
                  </p>
                )}
              </>
            ) : (
              <p className="rk-party-own">
                {l(
                  `Not in the Riksdag in the ${decadeName(decade)}.`,
                  `Inte i riksdagen under ${decadeName(decade)}.`,
                )}
              </p>
            )}
          </section>
        ))}
      </div>
      <Legend source="clusters/debate-topics.json">
        {l(
          `Share of each party's leader-debate passages per topic, five largest, %, 90 % range, ${decadeName(decade)}`,
          `Andel av partiets inlägg i partiledardebatterna per ämne, fem största, %, 90 %-intervall, ${decadeName(decade)}`,
        )}
      </Legend>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- 3. agenda

function AgendaSection({ topics }: { topics: DebateTopics | null }) {
  if (!topics) return null
  const migration = topicId(topics, 'Migration and asylum')
  const energy = topicId(topics, 'Nuclear power and electricity')
  const all = decades(topics)
  const series = yearly(topics, energy)
  const partial = partialYears(series)
  const top = Math.max(
    ...PARTIES.flatMap((party) =>
      byDecade(topics, party, migration).map((s) => s.high),
    ),
  )
  return (
    <ProjectSection
      id="replik-agenda"
      title={l('Migration and energy', 'Migration och energi')}
    >
      <div className="rk-grid">
        {PARTIES.map((party) => (
          <Spark
            key={party}
            title={partyName(party)}
            periods={all.map(decadeName)}
            points={byDecade(topics, party, migration).map((s) => ({
              period: decadeName(s.period),
              value: s.value,
              low: s.low,
              high: s.high,
            }))}
            min={0}
            max={top}
            format={(v) => sh(v, 0)}
            label={l(
              `${partyName(party)}: migration's share of its passages per decade`,
              `${partyName(party)}: migrationens andel av partiets inlägg per årtionde`,
            )}
          />
        ))}
      </div>
      <Legend source="clusters/debate-topics.json">
        {l(
          `Migration and asylum, share of each party's leader-debate passages per decade, %, 90 % range, to ${series.at(-1)?.period}`,
          `Migration och asyl, andel av partiets inlägg i partiledardebatterna per årtionde, %, 90 %-intervall, till ${series.at(-1)?.period}`,
        )}
      </Legend>
      <MultiLineChart
        label={l(
          `${tn(topics, energy)}: share of leader-debate passages per year`,
          `${tn(topics, energy)}: andel av inläggen i partiledardebatterna per år`,
        )}
        format={(v) => pct(v, 0)}
        colorOf={() => 0}
        series={[
          {
            key: 'energy',
            name: tn(topics, energy),
            points: series.map((s) => ({
              date: `${s.period}-07-01`,
              label: partial.has(s.period)
                ? l(`${s.period}, part of the year`, `${s.period}, del av året`)
                : s.period,
              value: s.value * 100,
              low: s.low * 100,
              high: s.high * 100,
            })),
          },
        ]}
      />
      <Legend source="clusters/debate-topics.json">
        {l(
          `${tn(topics, energy)}, share of leader-debate passages per year, %, 90 % range, ${series[0]?.period}–${series.at(-1)?.period}`,
          `${tn(topics, energy)}, andel av inläggen i partiledardebatterna per år, %, 90 %-intervall, ${series[0]?.period}–${series.at(-1)?.period}`,
        )}
      </Legend>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- 4. votes

function VoteSection({ sessions }: { sessions: Sessions | null }) {
  if (!sessions) return null
  const periods = sessions.sessions.map((s) => s.session)
  return (
    <ProjectSection
      id="replik-votes"
      title={l('Votes with the government', 'Röster med regeringen')}
    >
      <div className="rk-grid">
        {PARTIES.map((party) => {
          const rows = record(sessions, party)
          return (
            <Spark
              key={party}
              title={partyName(party)}
              periods={periods}
              points={rows.map((r) => ({
                period: r.session,
                value: r.with_government_pct,
              }))}
              shade={
                new Set(
                  rows
                    .filter((r) => r.role !== 'opposition')
                    .map((r) => r.session),
                )
              }
              min={0}
              max={100}
              format={(v) => pct(v, 0)}
              label={l(
                `${partyName(party)}: share of roll calls voted with the government, per session`,
                `${partyName(party)}: andel voteringar med regeringen, per riksmöte`,
              )}
            />
          )
        })}
      </div>
      <Legend source="parliament/sessions.json">
        {l(
          `Share of roll calls where the party majority voted as the government, %, per session, ${periods[0]}–${periods.at(-1)}. Shaded: in government or agreement`,
          `Andel voteringar där partiets majoritet röstade som regeringen, %, per riksmöte, ${periods[0]}–${periods.at(-1)}. Skuggat: i regeringen eller avtal`,
        )}
      </Legend>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- 5. separability

function ModelSection({ polar }: { polar: Polar | null }) {
  if (!polar) return null
  const blocks = governments(polar)
  const periods = polar.sessions.map((s) => s.session)
  const shade = new Set(
    blocks
      .filter((_, i) => i % 2 === 1)
      .flatMap((b) => periods.slice(b.from, b.to + 1)),
  )
  const values = polar.sessions.map((s) => s.within_debate_auc)
  return (
    <ProjectSection
      id="replik-model"
      title={l('Party separability', 'Särskiljbarhet mellan partier')}
    >
      <Spark
        large
        title={l('Same-debate AUC', 'AUC inom samma debatt')}
        periods={periods}
        points={polar.sessions.map((s) => ({
          period: s.session,
          value: s.within_debate_auc,
        }))}
        shade={shade}
        refValue={0.5}
        min={0.5}
        max={Math.ceil(Math.max(...values) * 20) / 20}
        format={(v) => num(v, 2)}
        label={l(
          'How well speech text tells parties apart within the same debate, AUC per session',
          'Hur väl anförandets text skiljer partier åt inom samma debatt, AUC per riksmöte',
        )}
      />
      <ol className="rk-blocks">
        {blocks.map((b) => (
          <li key={b.first}>
            <span>{b.first === b.last ? b.first : `${b.first}–${b.last}`}</span>
            <span>{b.parties}</span>
            <strong>{num(b.mean, 2)}</strong>
          </li>
        ))}
      </ol>
      <Legend source="ml/polarization.json">
        {l(
          `How well speech text tells parties apart within the same debate, AUC (0.5 = chance), per session, ${periods[0]}–${periods.at(-1)}. Shading alternates per government`,
          `Hur väl anförandets text skiljer partier åt inom samma debatt, AUC (0,5 = slump), per riksmöte, ${periods[0]}–${periods.at(-1)}. Skuggningen växlar per regering`,
        )}
      </Legend>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- 6. now

function NowSection({
  ai,
  last,
  story,
}: {
  ai: PartyYear | null
  last: string | null
  story: Story | null
}) {
  if (!ai && !story) return null
  const total = ai ? aiByYear(ai) : []
  const years = total.map((t) => String(t.year))
  const partyMax = ai
    ? Math.max(...PARTIES.flatMap((p) => aiByYear(ai, p).map((r) => r.value)))
    : 1
  const terms = story?.terms
  const rising = terms ? clean(terms.rising).slice(0, 8) : []
  const falling = terms ? clean(terms.falling).slice(0, 8) : []
  const termMax = Math.max(
    ...rising.map((t) => t.now),
    ...falling.map((t) => t.before),
    1,
  )
  const per10k = (v: number) => num(v, 2)
  return (
    <ProjectSection
      id="replik-now"
      title={l('The Riksdag now', 'Riksdagen nu')}
    >
      {ai && (
        <>
          <Spark
            large
            title={l('All parties', 'Alla partier')}
            periods={years}
            points={total.map((t) => ({
              period: String(t.year),
              value: t.value,
            }))}
            min={0}
            max={Math.ceil(Math.max(...total.map((t) => t.value)) * 2) / 2}
            format={(v) => pct(v, 2)}
            label={l(
              'Share of Riksdag speeches that mention AI, per year',
              'Andel riksdagsanföranden som nämner AI, per år',
            )}
          />
          <div className="rk-grid">
            {PARTIES.map((party) => (
              <Spark
                key={party}
                title={partyName(party)}
                periods={years}
                points={aiByYear(ai, party).map((r) => ({
                  period: String(r.year),
                  value: r.value,
                }))}
                min={0}
                max={partyMax}
                format={(v) => pct(v, 1)}
                label={l(
                  `${partyName(party)}: share of its speeches that mention AI, per year`,
                  `${partyName(party)}: andel av partiets anföranden som nämner AI, per år`,
                )}
              />
            ))}
          </div>
          <Legend source="ai-act/politics/party-year.json">
            {l(
              `Share of Riksdag speeches that mention AI, %, per year and party, ${years[0]}–${years.at(-1)}${last ? ` (to ${last})` : ''}`,
              `Andel riksdagsanföranden som nämner AI, %, per år och parti, ${years[0]}–${years.at(-1)}${last ? ` (till ${last})` : ''}`,
            )}
          </Legend>
        </>
      )}
      {terms && rising.length > 1 && (
        <>
          <div className="rk-terms">
            <div>
              <h3>{l(`Rising in ${terms.now}`, `Ökar ${terms.now}`)}</h3>
              <RankBars
                label={l(
                  'Rising words, per 10,000 words',
                  'Ökande ord, per 10 000 ord',
                )}
                max={termMax}
                format={per10k}
                rows={rising.map((t) => ({
                  key: t.stem,
                  label: t.word,
                  value: t.now,
                  ref: t.before,
                  note: l(
                    ` from ${per10k(t.before)}`,
                    ` från ${per10k(t.before)}`,
                  ),
                }))}
              />
            </div>
            <div>
              <h3>{l(`Falling in ${terms.now}`, `Minskar ${terms.now}`)}</h3>
              <RankBars
                label={l(
                  'Falling words, per 10,000 words',
                  'Minskande ord, per 10 000 ord',
                )}
                max={termMax}
                format={per10k}
                rows={falling.map((t) => ({
                  key: t.stem,
                  label: t.word,
                  value: t.now,
                  ref: t.before,
                  note: l(
                    ` from ${per10k(t.before)}`,
                    ` från ${per10k(t.before)}`,
                  ),
                }))}
              />
            </div>
          </div>
          <Legend source="politics/parliament/story.json">
            {l(
              `Words per 10,000 in the topic debates, ${terms.now} against ${terms.before[0]}–${terms.before.at(-1)}; tick = earlier rate`,
              `Ord per 10 000 i sakdebatterna, ${terms.now} mot ${terms.before[0]}–${terms.before.at(-1)}; streck = tidigare nivå`,
            )}
          </Legend>
        </>
      )}
    </ProjectSection>
  )
}

export default function ReplikPage() {
  const topics = useJson<DebateTopics>('clusters/debate-topics.json')
  const eras = useJson<Eras>('clusters/riksdag-eras.json')
  const sessions = useJson<Sessions>('parliament/sessions.json')
  const talk = useJson<TalkVote>('clusters/talk-vote.json')
  const polar = useJson<Polar>('ml/polarization.json')
  const ai = useJson<PartyYear>('ai-act/politics/party-year.json')
  const aiSummary = useJson<{ last_date: string }>(
    'ai-act/politics/summary.json',
  )
  const story = useJson<Story>('politics/parliament/story.json')
  const debates = story?.leader_debates
  const kpis: Kpi[] = []
  if (debates?.length)
    kpis.push({
      value: num(debates.length),
      label: l(
        `party-leader debates, ${debates[0].date.slice(0, 4)}–${debates.at(-1)!.date.slice(0, 4)}`,
        `partiledardebatter, ${debates[0].date.slice(0, 4)}–${debates.at(-1)!.date.slice(0, 4)}`,
      ),
    })
  if (sessions) {
    kpis.push({
      value: num(sessions.sessions.length),
      label: l('Riksdag sessions', 'riksmöten'),
    })
    kpis.push({
      value: num(sessions.sessions.reduce((a, s) => a + s.roll_calls, 0)),
      label: l('roll-call votes', 'voteringar'),
    })
  }
  if (polar?.sessions.length)
    kpis.push({
      value: num(
        polar.sessions.reduce((a, s) => a + s.within_debate_auc, 0) /
          polar.sessions.length,
        2,
      ),
      label: l('party separability, mean AUC', 'särskiljbarhet, medel-AUC'),
    })
  const passed = polar?.sessions.filter((s) => s.permutation_p < 0.05).length
  return (
    <article className="project-page replik">
      <PageHead
        title="Replik"
        sentence={l(
          'Thirty years of party-leader debates and roll calls, read by machine.',
          'Trettio år av partiledardebatter och voteringar, lästa av en maskin.',
        )}
        kpis={kpis}
      />
      <EraSection eras={eras} />
      <PartySection topics={topics} />
      <AgendaSection topics={topics} />
      <VoteSection sessions={sessions} />
      <ModelSection polar={polar} />
      <NowSection ai={ai} last={aiSummary?.last_date ?? null} story={story} />
      <ProjectSection
        id="replik-explore"
        title={l('Place a sentence', 'Placera en mening')}
      >
        <SentencePlacer
          spec={MAPS().find((spec) => spec.id === 'research-debates')!}
        />
      </ProjectSection>
      <Method
        summary={l(
          'How it is made · sources · method',
          'Så är det gjort · källor · metod',
        )}
      >
        <p>
          {l(
            'A replik is a rebuttal in a Riksdag debate. Sources: Riksdagen open data (speeches, roll calls).',
            'En replik är ett genmäle i en riksdagsdebatt. Källor: Riksdagens öppna data (anföranden, voteringar).',
          )}
        </p>
        {eras && (
          <p>
            {l(
              `Eras: ${eras.topic_shares.sessions.length} sessions grouped by topic shares, breaks at ${eras.breaks.join(', ')}; tighter than chance (p = ${num(eras.diagnostics.null.p, 3)}), resampling ARI ${num(eras.diagnostics.bootstrap_ari.mean, 2)}. Fitted on the older ${eras.topic_shares.topics.length}-topic model.`,
              `Epoker: ${eras.topic_shares.sessions.length} riksmöten grupperade efter ämnesandelar, brott ${eras.breaks.join(', ')}; tätare än slumpen (p = ${num(eras.diagnostics.null.p, 3)}), omdragning ARI ${num(eras.diagnostics.bootstrap_ari.mean, 2)}. Bygger på den äldre modellen med ${eras.topic_shares.topics.length} ämnen.`,
            )}
          </p>
        )}
        <p>
          {l(
            'Topic shares: about three leader debates a year, so single years are noisy; bands are 90 % ranges. What is said, not stances.',
            'Ämnesandelar: ungefär tre partiledardebatter om året, så enskilda år är brusiga; banden är 90 %-intervall. Vad som sägs, inte ståndpunkter.',
          )}
        </p>
        {talk && (
          <p>
            {l(
              `Talk and votes: across ${talk.sessions.length} sessions, similar topics do not predict voting together (Mantel r ${num(talk.diagnostics.null.observed, 2)}, p ${num(talk.diagnostics.null.p, 2)}).`,
              `Tal och röster: över ${talk.sessions.length} riksmöten förutsäger lika ämnen inte lika röster (Mantels r ${num(talk.diagnostics.null.observed, 2)}, p ${num(talk.diagnostics.null.p, 2)}).`,
            )}
          </p>
        )}
        {polar && (
          <p>
            {l(
              `Separability: TF-IDF, party names masked, split by speaker; ${passed} of ${polar.sessions.length} sessions beat a permutation null. Separability is not polarization.`,
              `Särskiljbarhet: TF-IDF, partinamn maskerade, uppdelat per talare; ${passed} av ${polar.sessions.length} riksmöten slår en permutationsnolla. Särskiljbarhet är inte polarisering.`,
            )}
          </p>
        )}
        <p>
          {l(
            'AI: a mention of "AI" or a named AI term, not a stance. Words: those in at least 25 speeches; the latest session is partial.',
            'AI: ett omnämnande av "AI" eller en AI-term, inte en ståndpunkt. Ord: de i minst 25 anföranden; senaste riksmötet är ofullständigt.',
          )}
        </p>
      </Method>
    </article>
  )
}
