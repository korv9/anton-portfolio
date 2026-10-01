/**
 * Debatterna: what the parties talk about. The topics come from the learned issue lexicon
 * applied to the speeches (an estimate, about two thirds right on held-out speeches); words and
 * keywords from the precomputed debate figures (politics_story.py). Four views: the parties'
 * topics, the agenda over time, terms that grew or fell, and one party-leader debate in depth.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  partyFill,
  partyName,
} from '../../parties/identity'
import { useWidth } from '../../charts/feature/Feature'
import { dayName, num, pct } from '../controls'
import type { StoryData } from '../analytics/types'
import {
  calculateDebateWordShare,
  calculateTopicShare,
} from '../analytics/metrics'
import {
  loadDebateIndex,
  loadSession,
  totalFor,
  type DebateIndex,
  type IssueDebate,
} from '../debatter/data'
import { Bars, Heatmap, Info, Insight, Kpi, PartyMark, Section } from './parts'

type Mode = 'ledare' | 'sak'

export default function Debatterna({
  story,
  debate,
  onDebate,
}: {
  story: StoryData
  debate: string
  onDebate: (id: string) => void
}) {
  const [index, setIndex] = useState<DebateIndex | null>(null)
  const [issueDebates, setIssueDebates] = useState<IssueDebate[] | null>(null)
  const [mode, setMode] = useState<Mode>('ledare')
  const [compare, setCompare] = useState<[string, string]>(['S', 'M'])
  const [lines, setLines] = useState<string[] | null>(null)
  useEffect(() => {
    loadDebateIndex()
      .then((idx) => {
        setIndex(idx)
        return loadSession(idx.sessions.at(-1)!.path)
      })
      .then((s) => setIssueDebates(s.debates))
      .catch(() => setIssueDebates([]))
  }, [])

  const leaders = story.leader_debates
  const chosen = leaders.find((d) => d.id === debate) ?? leaders.at(-1)!
  const topicName = (key: string) => {
    const t = index?.issues.find((i) => i.key === key)
    return t ? l(t.en, t.sv) : key
  }

  // The parties' topics: in the party-leader debates (all of them), or in the latest
  // riksmöte's issue debates (the share of each party's speeches and replies per area).
  const partyTopics = useMemo(() => {
    const out = new Map<string, Record<string, number>>()
    if (mode === 'ledare') {
      for (const p of RIKSDAG_PARTIES) {
        const sum: Record<string, number> = {}
        for (const d of leaders) {
          const row = d.parties[p]
          if (!row) continue
          for (const [k, v] of Object.entries(row.topics))
            sum[k] = (sum[k] ?? 0) + (v * row.words) / 100
        }
        out.set(p, sum)
      }
    } else if (issueDebates) {
      for (const p of RIKSDAG_PARTIES) {
        const sum: Record<string, number> = {}
        for (const d of issueDebates) {
          const n = totalFor(d.parties, p)
          if (!n) continue
          for (const k of d.issues) sum[k] = (sum[k] ?? 0) + n / d.issues.length
        }
        out.set(p, sum)
      }
    }
    return out
  }, [mode, leaders, issueDebates])
  const topicCols = useMemo(() => {
    const total: Record<string, number> = {}
    for (const sums of partyTopics.values())
      for (const [k, v] of Object.entries(sums)) total[k] = (total[k] ?? 0) + v
    return Object.entries(total)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k)
  }, [partyTopics])
  const share = (p: string, k: string) => {
    const sums = partyTopics.get(p)
    if (!sums) return null
    const t = Object.values(sums).reduce((s, v) => s + v, 0)
    return t ? ((sums[k] ?? 0) / t) * 100 : null
  }
  const peak = RIKSDAG_PARTIES.flatMap((p) =>
    topicCols.map((k) => ({ p, k, v: share(p, k) ?? 0 })),
  ).sort((a, b) => b.v - a.v)[0]

  // The agenda over time: the issue debates per riksmöte.
  const agenda = story.agenda
  const latestShares = agenda.at(-1)!.shares
  const defaultLines = Object.keys(latestShares).slice(0, 5)
  const shown = lines ?? defaultLines
  const allTopics = Object.keys(latestShares)
  const firstShares = agenda[0].shares
  const changes = allTopics
    .map((k) => ({ k, d: (latestShares[k] ?? 0) - (firstShares[k] ?? 0) }))
    .sort((a, b) => b.d - a.d)

  const words = calculateDebateWordShare(chosen.parties)
  const debateTopics = calculateTopicShare(chosen.topics).slice(0, 8)
  const speakers = new Set(
    leaders.flatMap((d) => Object.values(d.parties).flatMap((p) => p.speakers)),
  )
  const leaderWords = leaders.reduce(
    (s, d) => s + Object.values(d.parties).reduce((t, p) => t + p.words, 0),
    0,
  )
  const issueTotal = index?.sessions.reduce((s, x) => s + x.debates, 0) ?? 0
  const terms = story.terms

  return (
    <Section
      id="debatterna"
      n={6}
      kicker={l('The debates', 'Debatterna')}
      question={l(
        'What do the parties talk about?',
        'Vad pratar partierna om?',
      )}
      lead={l(
        'Which topics, terms and issues dominate the debates. Topics are estimated from the words with a lexicon learned from the Riksdag’s own committee labels.',
        'Vilka ämnen, begrepp och frågor som dominerar debatterna. Ämnena uppskattas från orden med en ordlista som lärts från riksdagens egna utskottsetiketter.',
      )}
      deeper={[
        {
          href: '#politik-sakdebatter',
          label: l('Issue debates', 'Sakdebatter'),
        },
        {
          href: '#politik-partiledardebatter',
          label: l(
            'Party-leader debates, reply by reply',
            'Partiledardebatter, replik för replik',
          ),
        },
        {
          href: '#politik-tal',
          label: l(
            'What they talk about, per session',
            'Vad de pratar om, per riksmöte',
          ),
        },
        {
          href: '#technical',
          label: l('How the topics are learned', 'Hur ämnena lärs in'),
        },
      ]}
    >
      <dl className="story-kpis small">
        <Kpi
          value={num(issueTotal)}
          label={l('Issue debates', 'Sakdebatter')}
          note={
            index
              ? `${index.sessions[0].session}–${index.sessions.at(-1)!.session}`
              : undefined
          }
        />
        <Kpi
          value={num(leaders.length)}
          label={l('Party-leader debates', 'Partiledardebatter')}
        />
        <Kpi
          value={num(speakers.size)}
          label={l('Party leaders and stand-ins', 'Partiledare och ersättare')}
        />
        <Kpi
          value={num(leaderWords)}
          label={l(
            'Words in party-leader debates',
            'Ord i partiledardebatterna',
          )}
        />
      </dl>

      <h3>{l('What each party talks about', 'Vad varje parti pratar om')}</h3>
      <div
        className="feature-pick"
        role="group"
        aria-label={l('Debates', 'Debatter')}
      >
        <button
          type="button"
          aria-pressed={mode === 'ledare'}
          onClick={() => setMode('ledare')}
        >
          {l('Party-leader debates, all', 'Partiledardebatter, alla')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'sak'}
          onClick={() => setMode('sak')}
        >
          {l(
            `Issue debates, ${index?.sessions.at(-1)?.session ?? ''}`,
            `Sakdebatter, ${index?.sessions.at(-1)?.session ?? ''}`,
          )}
        </button>
      </div>
      {topicCols.length > 0 && (
        <Heatmap
          rows={RIKSDAG_PARTIES}
          cols={topicCols}
          value={share}
          format={(v) => num(v, 0)}
          label={l(
            'Share of each party’s debate per topic',
            'Andel av varje partis debatt per ämne',
          )}
          min={0}
          max={Math.max(20, peak?.v ?? 20)}
          rowLabel={(r) => <PartyMark party={r} />}
          colLabel={(c) => topicName(c)}
          title={(r, c, v) => `${partyName(r)} · ${topicName(c)}: ${pct(v, 1)}`}
        />
      )}
      <p className="story-axis-note">
        {mode === 'ledare'
          ? l(
              'Per cent of each party’s words in all party-leader debates, by estimated topic. Each row adds up to 100 over all topics.',
              'Procent av varje partis ord i alla partiledardebatter, efter uppskattat ämne. Varje rad blir 100 över alla ämnen.',
            )
          : l(
              'Per cent of each party’s speeches and replies in the issue debates, by the debate’s area.',
              'Procent av varje partis anföranden och repliker i sakdebatterna, efter debattens område.',
            )}
      </p>
      {peak && (
        <Insight>
          {l(
            `The largest single share: ${topicName(peak.k).toLowerCase()} made up ${pct(peak.v, 0)} of ${partyName(peak.p)}’s ${mode === 'ledare' ? 'words' : 'speeches and replies'}.`,
            `Den största enskilda andelen: ${topicName(peak.k).toLowerCase()} utgjorde ${pct(peak.v, 0)} av ${partyName(peak.p)}s ${mode === 'ledare' ? 'ord' : 'anföranden och repliker'}.`,
          )}
        </Insight>
      )}

      <h3>
        {l('How the agenda changes', 'Hur förändras den politiska agendan?')}
      </h3>
      <AgendaLines agenda={agenda} shown={shown} name={topicName} />
      <div
        className="story-chips"
        role="group"
        aria-label={l('Topics', 'Ämnen')}
      >
        {allTopics.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={shown.includes(k)}
            onClick={() =>
              setLines(
                shown.includes(k)
                  ? shown.filter((x) => x !== k)
                  : [...shown, k].slice(-6),
              )
            }
          >
            {topicName(k)}
          </button>
        ))}
      </div>
      <Insight>
        {l(
          `Since ${agenda[0].session}, ${topicName(changes[0].k).toLowerCase()} grew most as a share of the issue debates (${changes[0].d >= 0 ? '+' : ''}${num(changes[0].d, 1)} points), ${topicName(changes.at(-1)!.k).toLowerCase()} fell most (${num(changes.at(-1)!.d, 1)}).`,
          `Sedan ${agenda[0].session} har ${topicName(changes[0].k).toLowerCase()} ökat mest som andel av sakdebatterna (${changes[0].d >= 0 ? '+' : ''}${num(changes[0].d, 1)} procentenheter), ${topicName(changes.at(-1)!.k).toLowerCase()} minskat mest (${num(changes.at(-1)!.d, 1)}).`,
        )}
      </Insight>

      <h3>
        <Info term={l('Rising political terms', 'Begrepp som växer')}>
          {l(
            `Word stems in the issue debates, per 10,000 words: ${terms.now} (${num(terms.words_now)} words) against ${terms.before[0]}–${terms.before.at(-1)} (${num(terms.words_before)} words). Ranked by the ratio, smoothed by +0.5 per 10,000 words; stems used in at least 25 speeches; names left out.`,
            `Ordstammar i sakdebatterna, per 10 000 ord: ${terms.now} (${num(terms.words_now)} ord) mot ${terms.before[0]}–${terms.before.at(-1)} (${num(terms.words_before)} ord). Rangordnat efter kvoten, utjämnad med +0,5 per 10 000 ord; stammar i minst 25 anföranden; namn utelämnade.`,
          )}
        </Info>
      </h3>
      <div className="story-two">
        <TermList
          title={l(`Grew in ${terms.now}`, `Växte ${terms.now}`)}
          terms={terms.rising.slice(0, 10)}
        />
        <TermList
          title={l(`Fell in ${terms.now}`, `Minskade ${terms.now}`)}
          terms={terms.falling.slice(0, 10)}
        />
      </div>

      <h3 id="partiledardebatt">
        {l('Explore a party-leader debate', 'Utforska en partiledardebatt')}
      </h3>
      <label className="story-select">
        {l('Debate', 'Debatt')}{' '}
        <select value={chosen.id} onChange={(e) => onDebate(e.target.value)}>
          {[...leaders].reverse().map((d) => (
            <option key={d.id} value={d.id}>
              {dayName(d.date)} · {d.session}
            </option>
          ))}
        </select>
      </label>
      <p className="story-meta">
        {dayName(chosen.date)} ·{' '}
        {Object.values(chosen.parties).reduce(
          (s, p) => s + p.speeches + p.replies,
          0,
        )}{' '}
        {l('speeches and replies', 'anföranden och repliker')} ·{' '}
        {num(words.reduce((s, w) => s + w.words, 0))} {l('words', 'ord')} ·{' '}
        {l('Taking part', 'Deltog')}:{' '}
        {Object.entries(chosen.parties)
          .map(([p, row]) => `${row.speakers.join(', ')} (${p})`)
          .join('; ')}
      </p>
      <div className="story-two">
        <div>
          <h4>{l('Speaking space, words', 'Talutrymme, ord')}</h4>
          <Bars
            rows={words.map((w) => ({
              key: w.party,
              party: w.party,
              label: (
                <>
                  <PartyLogo party={w.party} size={16} /> {w.party}
                </>
              ),
              value: w.words,
              text: `${num(w.words)} · ${pct(w.pct, 0)}`,
            }))}
            format={(v) => num(v)}
            label={l('Words per party', 'Ord per parti')}
          />
        </div>
        <div>
          <h4>{l('Topics in the debate', 'Ämnen i debatten')}</h4>
          <Bars
            rows={debateTopics.map((t) => ({
              key: t.key,
              label: topicName(t.key),
              value: t.pct,
              color: 'var(--ink)',
            }))}
            format={(v) => pct(v, 0)}
            label={l('Topic shares in the debate', 'Ämnesandelar i debatten')}
          />
        </div>
      </div>
      {debateTopics[0] && (
        <Insight>
          {l(
            `${topicName(debateTopics[0].key)} made up an estimated ${pct(debateTopics[0].pct, 0)} of this debate.`,
            `${topicName(debateTopics[0].key)} utgjorde uppskattningsvis ${pct(debateTopics[0].pct, 0)} av den här debatten.`,
          )}
        </Insight>
      )}

      <h4>
        {l(
          'Compare two parties in this debate',
          'Jämför två partier i debatten',
        )}
      </h4>
      <div className="story-pair">
        {[0, 1].map((i) => (
          <select
            key={i}
            aria-label={l(`Party ${i + 1}`, `Parti ${i + 1}`)}
            value={compare[i]}
            onChange={(e) =>
              setCompare(
                i === 0
                  ? [e.target.value, compare[1]]
                  : [compare[0], e.target.value],
              )
            }
          >
            {Object.keys(chosen.parties).map((p) => (
              <option key={p} value={p}>
                {partyName(p)}
              </option>
            ))}
          </select>
        ))}
      </div>
      <div className="story-compare">
        {compare.map((p) => {
          const row = chosen.parties[p]
          return (
            <section key={p} style={{ ['--c' as string]: partyFill(p) }}>
              <h5>
                <PartyLogo party={p} size={22} /> {partyName(p)}
              </h5>
              {row ? (
                <>
                  <p className="story-compare-label">{l('Topics', 'Ämnen')}</p>
                  <ol>
                    {calculateTopicShare(row.topics)
                      .slice(0, 3)
                      .map((t) => (
                        <li key={t.key}>
                          {topicName(t.key)} <small>{pct(t.pct, 0)}</small>
                        </li>
                      ))}
                  </ol>
                  <p className="story-compare-label">
                    <Info term={l('Distinctive words', 'Utmärkande ord')}>
                      {l(
                        'The party’s words with the highest tf-idf in this debate: how often the party used the word (per 10,000 of its words) times how rare the word is across all party-leader debates. Names are left out.',
                        'Partiets ord med högst tf-idf i debatten: hur ofta partiet använde ordet (per 10 000 av dess ord) gånger hur ovanligt ordet är i alla partiledardebatter. Namn är utelämnade.',
                      )}
                    </Info>
                  </p>
                  <ol>
                    {row.keywords.slice(0, 6).map((k) => (
                      <li key={k.stem}>
                        {k.word} <small>{num(k.per_10k, 0)} / 10 000</small>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p>{l('Did not take part.', 'Deltog inte.')}</p>
              )}
            </section>
          )
        })}
      </div>
    </Section>
  )
}

function TermList({
  title,
  terms,
}: {
  title: string
  terms: StoryData['terms']['rising']
}) {
  return (
    <div>
      <h4>{title}</h4>
      <ol className="story-terms">
        {terms.map((t) => (
          <li key={t.stem}>
            <span>{t.word}</span>
            <small>
              {num(t.before, 2)} → {num(t.now, 2)}
            </small>
          </li>
        ))}
      </ol>
      <p className="story-axis-note">
        {l('per 10,000 words, before → now', 'per 10 000 ord, före → nu')}
      </p>
    </div>
  )
}

/** Topic shares per riksmöte as lines, named at their ends. */
function AgendaLines({
  agenda,
  shown,
  name,
}: {
  agenda: StoryData['agenda']
  shown: string[]
  name: (k: string) => string
}) {
  const [ref, W] = useWidth<HTMLDivElement>(720)
  const H = 260
  const pad = { l: 30, r: W < 520 ? 120 : 170, t: 10, b: 24 }
  const top = Math.max(
    5,
    ...agenda.flatMap((a) => shown.map((k) => a.shares[k] ?? 0)),
  )
  const x = (i: number) =>
    pad.l + (i / (agenda.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b)
  const ink = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7']
  const ends = shown
    .map((k, i) => ({ k, i, y: y(agenda.at(-1)!.shares[k] ?? 0) }))
    .sort((a, b) => a.y - b.y)
  for (let pass = 0; pass < 20; pass++)
    for (let j = 1; j < ends.length; j++)
      if (ends[j].y - ends[j - 1].y < 14) ends[j].y = ends[j - 1].y + 14
  return (
    <div ref={ref} className="story-agenda-wrap">
      <svg
        className="story-agenda"
        width={W}
        height={H}
        role="img"
        aria-label={shown
          .map((k) => `${name(k)} ${num(agenda.at(-1)!.shares[k] ?? 0, 1)} %`)
          .join(', ')}
      >
        {[0, top / 2, top].map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(t)}
              y2={y(t)}
              className="story-grid"
            />
            <text
              x={pad.l - 4}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="story-tick"
            >
              {num(t, 0)}
            </text>
          </g>
        ))}
        {agenda.map((a, i) =>
          i % 4 === 0 || i === agenda.length - 1 ? (
            <text
              key={a.session}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="story-tick"
            >
              {a.session.slice(0, 4)}
            </text>
          ) : null,
        )}
        {shown.map((k, i) => (
          <path
            key={k}
            d={agenda
              .map(
                (a, j) =>
                  `${j ? 'L' : 'M'}${x(j).toFixed(1)} ${y(a.shares[k] ?? 0).toFixed(1)}`,
              )
              .join(' ')}
            fill="none"
            stroke={ink[i % ink.length]}
            strokeWidth={2}
          />
        ))}
        {ends.map((e) => (
          <text
            key={e.k}
            x={W - pad.r + 6}
            y={e.y}
            dy="0.32em"
            className="story-line-label"
            style={{ fill: 'var(--ink)' }}
          >
            <tspan style={{ fill: ink[e.i % ink.length] }}>■ </tspan>
            {name(e.k)} {num(agenda.at(-1)!.shares[e.k] ?? 0, 1)}
          </text>
        ))}
      </svg>
    </div>
  )
}
