/**
 * Replik (#replik): 33 years of the Riksdag, read and counted. Six sections, each with one lead
 * visual from a committed file and the findings that file supports, recomputed on load
 * (compute.ts). Every party gets the same chart, size and ink; nothing ranks the parties.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { currentLocale, l } from '../i18n'
import { fetchJson } from '../dataSource'
import { ProjectHero, ProjectSection } from '../ui/Project'
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
  aiSince,
  biggestStep,
  byDecade,
  clean,
  closestOutsider,
  decadeLead,
  decades,
  eraGrid,
  governments,
  partialYears,
  peak,
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

function Finding({ children }: { children: ReactNode }) {
  return <p className="rk-finding">{children}</p>
}
function Note({ children }: { children: ReactNode }) {
  return <p className="rk-note">{children}</p>
}

// ---------------------------------------------------------------- hero

function Stats({
  story,
  sessions,
}: {
  story: Story | null
  sessions: Sessions | null
}) {
  const items: [string, string][] = []
  if (story) {
    const first = story.leader_debates[0]?.date.slice(0, 4)
    const last = story.leader_debates.at(-1)?.date.slice(0, 4)
    items.push([
      num(story.leader_debates.length),
      l(
        `party-leader debates, ${first}–${last}`,
        `partiledardebatter, ${first}–${last}`,
      ),
    ])
  }
  if (sessions) {
    items.push([
      num(sessions.sessions.length),
      l('sessions of the Riksdag', 'riksmöten'),
    ])
    items.push([
      num(sessions.sessions.reduce((a, s) => a + s.roll_calls, 0)),
      l('roll-call votes', 'voteringar'),
    ])
  }
  if (!items.length) return null
  return (
    <dl className="rk-stats">
      {items.map(([value, label]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------- 1. eras

function EraSection({ eras }: { eras: Eras | null }) {
  if (!eras) return null
  const { eras: cols, ids, label, cells } = eraGrid(eras)
  const max = Math.max(...cells.flat())
  const dx = eras.diagnostics
  return (
    <ProjectSection
      id="replik-eras"
      label={l('Thirty years in the chamber', 'Trettio år i kammaren')}
      title={l(
        `${cols.length} eras, found without reading a word`,
        `${cols.length} epoker, hittade utan att läsa ett ord`,
      )}
    >
      <Finding>
        {l(
          `${eras.topic_shares.sessions.length} sessions, grouped by what party leaders talk about: ${cols.length} eras, with breaks at ${eras.breaks.join(', ')}. Tighter than chance (p = ${num(dx.null.p, 3)}).`,
          `${eras.topic_shares.sessions.length} riksmöten, grupperade efter vad partiledarna talar om: ${cols.length} epoker, med brott ${eras.breaks.join(', ')}. Tätare än slumpen (p = ${num(dx.null.p, 3)}).`,
        )}
      </Finding>
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
          {l(
            `Share of each era's debate words per topic. Each row is the topic that most sets an era apart.`,
            `Andel av epokens debattord per ämne. Varje rad är det ämne som mest skiljer ut en epok.`,
          )}
        </figcaption>
      </figure>
      <Note>
        {l(
          `A loose grouping: resampling agrees at ARI ${num(dx.bootstrap_ari.mean, 2)}. Fitted on the older ${eras.topic_shares.topics.length}-topic model.`,
          `En lös gruppering: omdragning stämmer till ARI ${num(dx.bootstrap_ari.mean, 2)}. Bygger på den äldre modellen med ${eras.topic_shares.topics.length} ämnen.`,
        )}
      </Note>
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
      label={l('What each party talks about', 'Vad varje parti talar om')}
      title={l(
        'Every party has a subject of its own',
        'Varje parti har ett eget ämne',
      )}
    >
      <Finding>
        {l(
          `Each party's most distinctive topic, ${decadeName(decade)}: `,
          `Varje partis mest egna ämne, ${decadeName(decade)}: `,
        )}
        {profiles
          .filter((p) => p.profile?.distinctive)
          .map(
            (p) =>
              `${p.party} ${tn(topics, p.profile!.distinctive!.id).toLowerCase()} (${sh(p.profile!.distinctive!.value)})`,
          )
          .join(', ')}
        .
      </Finding>
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
      <Note>
        {l(
          'Share of each party’s leader-debate passages per topic, with the 90 % range. What is said, not stances.',
          'Andel av partiets inlägg i partiledardebatterna per ämne, med 90 %-intervall. Vad som sägs, inte ståndpunkter.',
        )}
      </Note>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- 3. agenda

function AgendaSection({ topics }: { topics: DebateTopics | null }) {
  if (!topics) return null
  const migration = topicId(topics, 'Migration and asylum')
  const energy = topicId(topics, 'Nuclear power and electricity')
  const all = decades(topics)
  const lead = decadeLead(topics, '2010', migration)
  const now = decadeLead(topics, all.at(-1)!, migration)
  const series = yearly(topics, energy)
  const partial = partialYears(series)
  const p = peak(series)
  const top = Math.max(
    ...PARTIES.flatMap((party) =>
      byDecade(topics, party, migration).map((s) => s.high),
    ),
  )
  return (
    <ProjectSection
      id="replik-agenda"
      label={l('Who sets the agenda', 'Vem sätter dagordningen')}
      title={l(
        'Migration, then energy, moved through every party',
        'Migrationen, sedan energin, gick genom alla partier',
      )}
    >
      {lead && now && (
        <Finding>
          {l(
            `2010s: migration was ${sh(lead.lead.value)} of ${lead.lead.party}'s passages, ${range(lead.min * 100, lead.max * 100)} for every other party. ${decadeName(now.lead.period)}: ${now.lead.party} ${sh(now.lead.value)}, ${now.second.party} ${sh(now.second.value)}.${now.overlap ? ' The others caught up.' : ''}`,
            `2010-talet: migrationen var ${sh(lead.lead.value)} av ${lead.lead.party}s inlägg, ${range(lead.min * 100, lead.max * 100)} för vart och ett av de andra partierna. ${decadeName(now.lead.period)}: ${now.lead.party} ${sh(now.lead.value)}, ${now.second.party} ${sh(now.second.value)}.${now.overlap ? ' De andra hann ikapp.' : ''}`,
          )}
        </Finding>
      )}
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
      <Note>
        {l(
          `Migration and asylum per decade, 90 % range. The ${decadeName(all.at(-1)!)} run to ${series.at(-1)?.period}.`,
          `Migration och asyl per årtionde, 90 %-intervall. ${decadeName(all.at(-1)!)} går till ${series.at(-1)?.period}.`,
        )}
      </Note>
      {p && (
        <Finding>
          {l(
            `${tn(topics, energy)} was ${range(p.min * 100, p.max * 100)} of leader-debate passages every year ${p.from}–${p.to}, ${sh(p.top.value)} in ${p.top.period}, and ${sh(p.last.value)} in ${p.last.period}.`,
            `${tn(topics, energy)} var ${range(p.min * 100, p.max * 100)} av inläggen i partiledardebatterna varje år ${p.from}–${p.to}, ${sh(p.top.value)} ${p.top.period} och ${sh(p.last.value)} ${p.last.period}.`,
          )}
        </Finding>
      )}
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
      <Note>
        {l(
          'About three debates a year, so single years are noisy. Band: 90 % range.',
          'Ungefär tre debatter om året, så enskilda år är brusiga. Band: 90 %-intervall.',
        )}
      </Note>
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- 4. votes

function VoteSection({
  sessions,
  talk,
}: {
  sessions: Sessions | null
  talk: TalkVote | null
}) {
  if (!sessions) return null
  const periods = sessions.sessions.map((s) => s.session)
  const r5 = closestOutsider(sessions)
  return (
    <ProjectSection
      id="replik-votes"
      label={l('How they vote', 'Hur de röstar')}
      title={l('Talking alike, voting alike?', 'Talar lika, röstar lika?')}
    >
      {r5 && (
        <Finding>
          {l(
            `${r5.now.session}: ${r5.now.party} voted with the government in ${pct(r5.now.with_government_pct)} of ${num(r5.now.roll_calls)} roll calls, up from ${pct(r5.before.with_government_pct)}. In opposition, ${r5.from}–${r5.to}: ${range(r5.min, r5.max, 0)}.`,
            `${r5.now.session}: ${r5.now.party} röstade med regeringen i ${pct(r5.now.with_government_pct)} av ${num(r5.now.roll_calls)} voteringar, upp från ${pct(r5.before.with_government_pct)}. I opposition, ${r5.from}–${r5.to}: ${range(r5.min, r5.max, 0)}.`,
          )}
        </Finding>
      )}
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
      <Note>
        {l(
          `Share of roll calls where the party majority voted as the government. Shaded: in government or in a formal agreement. ${periods.at(-1)} runs to ${r5?.lastVote ?? ''}.`,
          `Andel voteringar där partiets majoritet röstade som regeringen. Skuggat: i regeringen eller med ett formellt avtal. ${periods.at(-1)} går till ${r5?.lastVote ?? ''}.`,
        )}
      </Note>
      {talk && (
        <Finding>
          {l(
            `Talking alike is not voting alike. Across ${talk.sessions.length} sessions, similar topics do not predict voting together (Mantel r ${num(talk.diagnostics.null.observed, 2)}, p ${num(talk.diagnostics.null.p, 2)}).`,
            `Att tala lika är inte att rösta lika. Över ${talk.sessions.length} riksmöten förutsäger lika ämnen inte lika röster (Mantels r ${num(talk.diagnostics.null.observed, 2)}, p ${num(talk.diagnostics.null.p, 2)}).`,
          )}
        </Finding>
      )}
    </ProjectSection>
  )
}

// ---------------------------------------------------------------- 5. separability

function ModelSection({ polar }: { polar: Polar | null }) {
  if (!polar) return null
  const blocks = governments(polar)
  const step = biggestStep(polar)
  const periods = polar.sessions.map((s) => s.session)
  const shade = new Set(
    blocks
      .filter((_, i) => i % 2 === 1)
      .flatMap((b) => periods.slice(b.from, b.to + 1)),
  )
  const values = polar.sessions.map((s) => s.within_debate_auc)
  const passed = polar.sessions.filter((s) => s.permutation_p < 0.05).length
  return (
    <ProjectSection
      id="replik-model"
      label={l(
        'Can a model tell the parties apart?',
        'Kan en modell skilja partierna åt?',
      )}
      title={l(
        'Party language sharpened with a change of government',
        'Partiernas språk skärptes med ett regeringsskifte',
      )}
    >
      {step && (
        <Finding>
          {l(
            `A classifier tells parties in the same debate apart with AUC ${num(step[0].mean, 2)} under ${step[0].parties} (${step[0].first}–${step[0].last}) and ${num(step[1].mean, 2)} under ${step[1].parties} (${step[1].first}–${step[1].last}). 0.5 is chance.`,
            `En klassificerare skiljer partier i samma debatt åt med AUC ${num(step[0].mean, 2)} under ${step[0].parties} (${step[0].first}–${step[0].last}) och ${num(step[1].mean, 2)} under ${step[1].parties} (${step[1].first}–${step[1].last}). 0,5 är slump.`,
          )}
        </Finding>
      )}
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
        note={l(
          'Shading alternates with each government. The bottom of the axis is 0.5, chance.',
          'Skuggningen växlar med varje regering. Axelns botten är 0,5, slump.',
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
      <Note>
        {l(
          `TF-IDF, party names masked, split by speaker. ${passed} of ${polar.sessions.length} sessions beat a permutation null. Separability is not polarization.`,
          `TF-IDF, partinamn maskerade, uppdelat per talare. ${passed} av ${polar.sessions.length} riksmöten slår en permutationsnolla. Särskiljbarhet är inte polarisering.`,
        )}
      </Note>
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
  const lastYear = total.at(-1)
  const lastFull = total.at(-2)
  const before = total.find((t) => t.year === 2022)
  const recent = ai ? aiSince(ai, 2023) : []
  const lo = recent.length
    ? recent.reduce((a, b) => (b.value < a.value ? b : a))
    : null
  const hi = recent.length
    ? recent.reduce((a, b) => (b.value > a.value ? b : a))
    : null
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
  // The falling word with the largest drop among the five that fell most in ratio.
  const drop = falling
    .slice(0, 5)
    .reduce<(typeof falling)[number] | undefined>(
      (a, b) => (!a || b.before - b.now > a.before - a.now ? b : a),
      undefined,
    )
  return (
    <ProjectSection
      id="replik-now"
      label={l('The Riksdag now', 'Riksdagen nu')}
      title={l(
        'AI arrives, and the topic debates turn to deportation and uranium',
        'AI kommer in, och sakdebatterna vänder sig mot utvisning och uran',
      )}
    >
      {ai && lastYear && lastFull && before && hi && lo && (
        <Finding>
          {l(
            `${pct(before.value, 2)} of Riksdag speeches mentioned AI in ${before.year}, ${pct(lastFull.value, 2)} in ${lastFull.year} and ${pct(lastYear.value, 2)} in ${lastYear.year}${last ? ` to ${last}` : ''}. From 2023 on the share runs from ${pct(lo.value, 2)} (${lo.party}) to ${pct(hi.value, 2)} (${hi.party}).`,
            `${pct(before.value, 2)} av riksdagens anföranden nämnde AI ${before.year}, ${pct(lastFull.value, 2)} ${lastFull.year} och ${pct(lastYear.value, 2)} ${lastYear.year}${last ? ` till ${last}` : ''}. Från 2023 går andelen från ${pct(lo.value, 2)} (${lo.party}) till ${pct(hi.value, 2)} (${hi.party}).`,
          )}
        </Finding>
      )}
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
          <Note>
            {l(
              `A mention of "AI" or a named AI term, not a stance. ${years.at(-1)} is part of the year.`,
              `Ett omnämnande av "AI" eller en AI-term, inte en ståndpunkt. ${years.at(-1)} är en del av året.`,
            )}
          </Note>
        </>
      )}
      {terms && rising.length > 1 && (
        <>
          <Finding>
            {l(
              `Per 10,000 words in the ${terms.now} topic debates, against ${terms.before[0]}–${terms.before.at(-1)}: "${rising[0].word}" rose from ${per10k(rising[0].before)} to ${per10k(rising[0].now)}, "${rising[1].word}" from ${per10k(rising[1].before)} to ${per10k(rising[1].now)}. ${drop ? `"${drop.word}" fell from ${per10k(drop.before)} to ${per10k(drop.now)}.` : ''}`,
              `Per 10 000 ord i sakdebatterna ${terms.now}, mot ${terms.before[0]}–${terms.before.at(-1)}: "${rising[0].word}" steg från ${per10k(rising[0].before)} till ${per10k(rising[0].now)}, "${rising[1].word}" från ${per10k(rising[1].before)} till ${per10k(rising[1].now)}. ${drop ? `"${drop.word}" föll från ${per10k(drop.before)} till ${per10k(drop.now)}.` : ''}`,
            )}
          </Finding>
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
          <Note>
            {l(
              `Words in at least 25 speeches. The tick is the earlier rate. ${terms.now} is a partial session.`,
              `Ord i minst 25 anföranden. Strecket är den tidigare nivån. ${terms.now} är ett ofullständigt riksmöte.`,
            )}
          </Note>
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
  return (
    <article className="project-page replik">
      <ProjectHero
        eyebrow={l(
          'Riksdag debates and roll calls, read by machine',
          'Riksdagens debatter och voteringar, lästa av en maskin',
        )}
        title="Replik"
        question={l(
          'What do Sweden’s parties talk about when they face each other, who sets the agenda, and who votes together?',
          'Vad talar Sveriges partier om när de möts, vem sätter dagordningen, och vilka röstar ihop?',
        )}
      >
        <p>
          {l(
            'A replik is a rebuttal in a Riksdag debate. Every party-leader debate since 1993, every roll call.',
            'En replik är ett genmäle i en riksdagsdebatt. Varje partiledardebatt sedan 1993, varje votering.',
          )}
        </p>
        <Stats story={story} sessions={sessions} />
      </ProjectHero>
      <EraSection eras={eras} />
      <PartySection topics={topics} />
      <AgendaSection topics={topics} />
      <VoteSection sessions={sessions} talk={talk} />
      <ModelSection polar={polar} />
      <NowSection ai={ai} last={aiSummary?.last_date ?? null} story={story} />
      <ProjectSection
        id="replik-explore"
        label={l(
          'Where would your sentence land?',
          'Var skulle din mening hamna?',
        )}
        title={l(
          'Write a sentence, see where it lands',
          'Skriv en mening, se var den hamnar',
        )}
      >
        <SentencePlacer
          spec={MAPS().find((spec) => spec.id === 'research-debates')!}
        />
      </ProjectSection>
    </article>
  )
}
