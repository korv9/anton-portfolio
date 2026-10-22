/**
 * E — The Lost Futures (#sweden-framtid). How often the Riksdag speaks of the future, and which
 * futures, every calendar year since 1994, from sweden/futures/*.json
 * (platform/publish/sweden/export_futures.py over Riksdagen's speech archives).
 *
 * The scene is a theme × year matrix of the share of future-oriented speeches that use each
 * theme. Swedish thesis abstracts (DiVA) are a second corpus, shown apart under Explore and
 * never pooled with the Riksdag.
 */
import { Suspense, lazy, useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import { setHashParams, type Route } from '../router'
import { productById } from './products'
import Explore, {
  BASE,
  name,
  num,
  pct,
  type Row,
  type Theme,
  type Trends,
} from './FuturesExplore'
import {
  EmptyState,
  ProductEmpty,
  Scene,
  SwedenResearchPage,
  ViewToggle,
  type Finding,
  type Method,
  type Reading,
} from './template'

type Coverage = {
  sessions: {
    session: string
    source_url: string
    sha256: string
    speeches: number
    counted_at: string
  }[]
  years_left_out: { year: number; speeches: number }[]
  run_id: string | null
  academic_corpus: string
}
type Measure = 'share' | 'words'

const value = (r: Row, m: Measure) => (m === 'share' ? r[6] : r[7])
const show = (v: number, m: Measure) => (m === 'share' ? pct(v) : v.toFixed(2))
// Five-year means at each end, so one unusual year (an election, a crisis) does not decide.
const SPAN = 5

const BarField = lazy(() => import('./BarField'))
const FuturesTopics = lazy(() => import('./FuturesTopics'))

export default function Futures({ route }: { route: Route }) {
  const product = productById('E')
  const [trends, setTrends] = useState<Trends | 'error' | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  useEffect(() => {
    fetchJson<Trends>(BASE + 'trends.json').then(setTrends, () =>
      setTrends('error'),
    )
    fetchJson<Coverage>(BASE + 'coverage.json').then(setCoverage, () => {})
  }, [])
  const measure = (route.params.get('matt') as Measure) || 'share'
  const picked = route.params.get('tema')
  const year = Number(route.params.get('ar')) || null
  const set = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(route.params)
    for (const [k, v] of Object.entries(changes))
      v == null || v === '' ? params.delete(k) : params.set(k, v)
    setHashParams(route.path, params, true)
  }
  const scene3d = route.params.get('scen') !== '2d'

  if (trends === null)
    return (
      <p className="sweden sw-note" role="status">
        {l('Loading…', 'Laddar…')}
      </p>
    )
  if (
    trends === 'error' ||
    !trends.themes.some((t) => t.rows.length > 2 * SPAN)
  )
    return (
      <ProductEmpty product={product}>
        <EmptyState
          state="cloud"
          shows={l(
            'Future-oriented themes in Riksdag speeches since 1993/94.',
            'Framtidsinriktade teman i riksdagsanföranden sedan 1993/94.',
          )}
          needs={l(
            'The counts in sweden/futures/trends.json from the sweden_futures pipeline subject.',
            'Räkningarna i sweden/futures/trends.json från pipeline-subjektet sweden_futures.',
          )}
        />
      </ProductEmpty>
    )

  const themes = trends.themes
  const years = [
    ...new Set(themes.flatMap((t) => t.rows.map((r) => r[0]))),
  ].sort((a, b) => a - b)
  const head = years.slice(0, SPAN)
  const tail = years.slice(-SPAN)
  const meanOf = (t: Theme, ys: number[]) => {
    const rs = t.rows.filter((r) => ys.includes(r[0]))
    return rs.reduce((s, r) => s + r[6], 0) / Math.max(1, rs.length)
  }
  const change = (t: Theme) => meanOf(t, tail) - meanOf(t, head)
  const ranked = [...themes].sort((a, b) => change(b) - change(a))
  const fs = trends.future_share
  const fsMean = (ys: number[], column = 1) =>
    fs
      .filter(([y]) => ys.includes(y))
      .reduce((s, r) => s + (r[column] ?? 0), 0) / ys.length
  const span = (ys: number[]) => `${ys[0]}–${ys[ys.length - 1]}`
  // The future share standardised to one mix of speech lengths (export_futures.length_bands).
  const std = trends.length_bands?.standardised ?? []
  const stdMean = (ys: number[]) => {
    const rs = std.filter(([y]) => ys.includes(y))
    return rs.length ? rs.reduce((a, [, v]) => a + v, 0) / rs.length : null
  }
  const selected = themes.find((t) => t.id === picked) ?? null
  const fisher = ['utopia', 'alternatives', 'collective']
    .map((id) => themes.find((t) => t.id === id)!)
    .filter(Boolean)
  // Relative change of each of Fisher's three themes, so one theme's fall is not averaged away.
  const relative = (t: Theme) =>
    meanOf(t, head) > 0 ? meanOf(t, tail) / meanOf(t, head) - 1 : 0
  const alternatives = themes.find((t) => t.id === 'alternatives')
  const faded = fisher.filter((t) => relative(t) < -0.2)
  const held = fisher.filter((t) => relative(t) >= -0.2)

  const findings: Finding[] = [
    {
      key: 'how-often',
      statement: l(
        `${pct(fsMean(tail))} of speeches in ${span(tail)} speak of the future, against ${pct(fsMean(head))} in ${span(head)}.`,
        `${pct(fsMean(tail))} av anförandena ${span(tail)} talar om framtiden, mot ${pct(fsMean(head))} ${span(head)}.`,
      ),
      values: (
        <>
          <p className="sw-note">
            {l('Marker', 'Markör')}: {trends.marker.description_en}
          </p>
          {fs[0]?.[2] != null && (
            <p className="sw-note">
              {l(
                `Words per speech: ${Math.round(fsMean(head, 2))} → ${Math.round(fsMean(tail, 2))}.`,
                `Ord per anförande: ${Math.round(fsMean(head, 2))} → ${Math.round(fsMean(tail, 2))}.`,
              )}{' '}
              {trends.length &&
                l(
                  `Longer speeches match the marker more often: across ${trends.length.years} years the share follows speech length (Spearman’s ρ ${trends.length.spearman_share_words_per_speech}), so part of any change is length.`,
                  `Längre anföranden träffar markören oftare: över ${trends.length.years} år följer andelen anförandenas längd (Spearmans ρ ${trends.length.spearman_share_words_per_speech}), så en del av varje förändring är längd.`,
                )}
            </p>
          )}
          {stdMean(head) != null && stdMean(tail) != null && (
            <p className="sw-note">
              {l(
                `At equal length (shares within four length bands, weighted to the mix of all years): ${pct(stdMean(head)!)} → ${pct(stdMean(tail)!)}.`,
                `Vid samma längd (andelar inom fyra längdband, vägda efter alla års blandning): ${pct(stdMean(head)!)} → ${pct(stdMean(tail)!)}.`,
              )}
            </p>
          )}
        </>
      ),
      evidence: 'descriptive',
      source: l(
        'Riksdagen, speech archives (open data)',
        'Riksdagen, anförandearkiv (öppna data)',
      ),
    },
    {
      key: 'which',
      statement: l(
        `Within future-oriented speeches, ${name(ranked[0]).toLowerCase()} gained most and ${name(ranked[ranked.length - 1]).toLowerCase()} lost most between ${span(head)} and ${span(tail)}.`,
        `Inom framtidsinriktade anföranden ökade ${name(ranked[0]).toLowerCase()} mest och ${name(ranked[ranked.length - 1]).toLowerCase()} minskade mest mellan ${span(head)} och ${span(tail)}.`,
      ),
      values: (
        <ul>
          {ranked.map((t) => (
            <li key={t.id}>
              {name(t)}: {pct(meanOf(t, head))} → {pct(meanOf(t, tail))}
            </li>
          ))}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'Share of future-oriented speeches using the theme, five-year means',
        'Andel framtidsinriktade anföranden som använder temat, femårsmedel',
      ),
      onShow: () => set({ tema: ranked[0].id }),
    },
  ]
  if (fisher.length)
    findings.push({
      key: 'fisher',
      contrary: held.length > 0,
      statement: l(
        `${faded.length ? `${faded.map(name).join(', ')} lost more than a fifth of their share of future-oriented speeches` : 'None of the three lost more than a fifth of its share of future-oriented speeches'}${held.length ? `; ${held.map((t) => name(t).toLowerCase()).join(', ')} did not` : ''}.`,
        `${faded.length ? `${faded.map(name).join(', ')} tappade mer än en femtedel av sin andel av de framtidsinriktade anförandena` : 'Inget av de tre tappade mer än en femtedel av sin andel av de framtidsinriktade anförandena'}${held.length ? `; ${held.map((t) => name(t).toLowerCase()).join(', ')} gjorde det inte` : ''}.`,
      ),
      values: (
        <ul>
          {fisher.map((t) => (
            <li key={t.id}>
              {name(t)}: {pct(meanOf(t, head))} → {pct(meanOf(t, tail))} (
              {relative(t) >= 0 ? '+' : ''}
              {Math.round(relative(t) * 100)} %)
            </li>
          ))}
          {alternatives && (
            <li>
              {l(
                `The alternatives pattern lists named proposals (löntagarfonder, sextimmars arbetsdag, medborgarlön …). Future-oriented speeches naming them: ${num(alternatives.rows[0][4])} in ${alternatives.rows[0][0]}, ${num(alternatives.rows[alternatives.rows.length - 1][4])} in ${alternatives.rows[alternatives.rows.length - 1][0]}. Alternatives phrased in later terms are not in the list.`,
                `Mönstret för alternativ räknar upp namngivna förslag (löntagarfonder, sextimmars arbetsdag, medborgarlön …). Framtidsinriktade anföranden som nämner dem: ${num(alternatives.rows[0][4])} ${alternatives.rows[0][0]}, ${num(alternatives.rows[alternatives.rows.length - 1][4])} ${alternatives.rows[alternatives.rows.length - 1][0]}. Alternativ i senare tiders ord finns inte i listan.`,
              )}
            </li>
          )}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        `Share of future-oriented speeches, five-year means ${span(head)} and ${span(tail)}`,
        `Andel framtidsinriktade anföranden, femårsmedel ${span(head)} och ${span(tail)}`,
      ),
      onShow: () => set({ tema: (faded[0] ?? fisher[0]).id }),
    })

  const scene = (
    <Scene
      product={product}
      line={l(
        `Share of the Riksdag’s future-oriented speeches that use each theme, ${years[0]}–${years[years.length - 1]}.`,
        `Andel av riksdagens framtidsinriktade anföranden som använder varje tema, ${years[0]}–${years[years.length - 1]}.`,
      )}
      legend={
        <>
          <b>
            {measure === 'share'
              ? l(
                  'Share of future-oriented speeches',
                  'Andel framtidsinriktade anföranden',
                )
              : l(
                  'Matches per 1,000 words, all speeches',
                  'Träffar per 1 000 ord, alla anföranden',
                )}
          </b>
          <p className="sw-note">
            {l(
              'Taller and further along the scale means more common that year.',
              'Högre och längre ut på skalan betyder vanligare det året.',
            )}
          </p>
          <div className="sw-ramp" aria-hidden="true" />
        </>
      }
      control={
        <div className="sw-controls">
          <ViewToggle
            view={scene3d ? '3d' : 'matrix'}
            onChange={(v) => set({ scen: v === '3d' ? null : '2d' })}
          />
          <label>
            {l('Measure', 'Mått')}
            <select
              value={measure}
              onChange={(e) =>
                set({
                  matt: e.target.value === 'share' ? null : e.target.value,
                })
              }
            >
              <option value="share">
                {l(
                  'Share of future-oriented speeches',
                  'Andel framtidsinriktade anföranden',
                )}
              </option>
              <option value="words">
                {l('Matches per 1,000 words', 'Träffar per 1 000 ord')}
              </option>
            </select>
          </label>
        </div>
      }
      info={
        selected ? (
          <>
            <b>{name(selected)}</b>
            {year && selected.rows.find((r) => r[0] === year) && (
              <p className="sw-mono">
                {year}:{' '}
                {show(
                  value(
                    selected.rows.find((r) => r[0] === year)!,
                    measure,
                  ),
                  measure,
                )}{' '}
                · {num(selected.rows.find((r) => r[0] === year)![4])}{' '}
                {l('of', 'av')}{' '}
                {num(selected.rows.find((r) => r[0] === year)![2])}{' '}
                {l('future-oriented speeches', 'framtidsinriktade anföranden')}
              </p>
            )}
            <p className="sw-note">{selected.description_en}</p>
          </>
        ) : (
          <p className="sw-note">
            {l(
              'Choose a cell to see its counts.',
              'Välj en cell för att se dess antal.',
            )}
          </p>
        )
      }
    >
      {scene3d ? (
        <Suspense
          fallback={
            <p className="sw-note" role="status">
              {l('Loading 3D…', 'Laddar 3D…')}
            </p>
          }
        >
          <BarField
            rows={themes.length}
            cols={years[years.length - 1] - years[0] + 1}
            gaps={Array.from(
              { length: years[years.length - 1] - years[0] + 1 },
              (_, i) => i,
            ).filter((i) => !years.includes(years[0] + i))}
            rowLabels={themes.map(name)}
            colLabels={years
              .filter((y) => y % 8 === 2 || y === years[years.length - 1])
              .map((y) => ({ col: y - years[0], text: String(y) }))}
            cells={(() => {
              const top = Math.max(
                ...themes.flatMap((t) => t.rows.map((r) => value(r, measure))),
                1e-9,
              )
              // Years left out of the corpus stay empty ground, never a zero bar.
              return themes.flatMap((t, row) =>
                years.flatMap((y) => {
                  const r = t.rows.find((x) => x[0] === y)
                  const v = r ? value(r, measure) : null
                  if (v == null) return []
                  return [
                    {
                      row,
                      col: y - years[0],
                      height: v / top,
                      key: `${t.id}|${y}`,
                      label: `${name(t)}, ${y}: ${show(v, measure)}`,
                    },
                  ]
                }),
              )
            })()}
            picked={picked && year ? `${picked}|${year}` : null}
            onPick={(key) => {
              const [t, y] = key.split('|')
              set({ tema: t, ar: y })
            }}
            label={l('3D view of the matrix', '3D-vy av matrisen')}
            fallback={
              <FutureMatrix
                themes={themes}
                years={years}
                measure={measure}
                picked={picked}
                year={year}
                onPick={(t, y) => set({ tema: t, ar: String(y) })}
              />
            }
          />
        </Suspense>
      ) : (
        <FutureMatrix
          themes={themes}
          years={years}
          measure={measure}
          picked={picked}
          year={year}
          onPick={(t, y) => set({ tema: t, ar: String(y) })}
        />
      )}{' '}
    </Scene>
  )

  const method: Method = {
    question: <p>{l(product.question.en, product.question.sv)}</p>,
    theory: (
      <p>
        {l(
          'Mark Fisher’s capitalist realism (it is easier to imagine the end of the world than the end of capitalism) and hauntology (the slow cancellation of the future) suggest that collective and alternative futures fade while crisis and security grow. Reinhart Koselleck’s “horizon of expectation” frames futures as historical. These are readings to test against the counts, not findings.',
          'Mark Fishers kapitalistiska realism (det är lättare att föreställa sig världens slut än kapitalismens) och hauntologi (framtidens långsamma avskaffande) antyder att kollektiva och alternativa framtider bleknar medan kris och säkerhet växer. Reinhart Kosellecks ”förväntningshorisont” ser framtider som historiska. Det är läsningar att pröva mot räkningarna, inte resultat.',
        )}
      </p>
    ),
    data: (
      <ul>
        <li>
          <a href="https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anforanden/">
            Riksdagen, {l('speeches', 'anföranden')}
          </a>{' '}
          —{' '}
          {l(
            'open data; chamber speeches may be freely reproduced',
            'öppna data; anföranden i kammaren får fritt återges',
          )}
        </li>
        {coverage && (
          <li>
            {coverage.sessions.length} {l('sessions', 'riksmöten')},{' '}
            {num(coverage.sessions.reduce((s, x) => s + x.speeches, 0))}{' '}
            {l('speeches', 'anföranden')}
          </li>
        )}
      </ul>
    ),
    method: (
      <ol>
        <li>
          {l(
            'Stream every session’s speech archive once; keep no text apart from short examples.',
            'Strömma varje riksmötes anförandearkiv en gång; behåll ingen text utom korta exempel.',
          )}
        </li>
        <li>
          {l(
            'Mark a speech as future-oriented when it matches the future marker (shown under Explore).',
            'Markera ett anförande som framtidsinriktat när det träffar framtidsmarkören (visas under Utforska).',
          )}
        </li>
        <li>
          {l(
            'Match nine themes; report, per calendar year, the share of future-oriented speeches using each theme, matches per thousand words and words per speech.',
            'Matcha nio teman; redovisa per kalenderår andelen framtidsinriktade anföranden som använder varje tema, träffar per tusen ord och ord per anförande.',
          )}
        </li>
        <li>
          {l(
            'Compare five-year means at each end, leaving out the running year. Compare the future share within four fixed bands of speech length.',
            'Jämför femårsmedel i varje ände, utan det pågående året. Jämför framtidsandelen inom fyra fasta band av anförandenas längd.',
          )}
        </li>
        <li>
          {l(
            'Fit a straight trend to each theme and add one level shift. Report the shift only when it beats 999 simulated series of AR(1) noise around the same trend, with Holm’s correction over the nine themes.',
            'Anpassa en rak trend till varje tema och lägg till ett nivåskifte. Redovisa skiftet bara när det slår 999 simulerade serier av AR(1)-brus kring samma trend, med Holms korrektion över de nio temana.',
          )}
        </li>
      </ol>
    ),
    results: (
      <p>
        {l(
          'The findings and Explore views on this page.',
          'Resultaten och Utforska-vyerna på sidan.',
        )}
      </p>
    ),
    alternatives: (
      <ul>
        <li>
          {l(
            'The agenda: wars, pandemics and elections move what the chamber debates, not only how it imagines the future.',
            'Dagordningen: krig, pandemier och val styr vad kammaren debatterar, inte bara hur den föreställer sig framtiden.',
          )}
        </li>
        <li>
          {l(
            'Vocabulary drift: “hållbar” and “trygghet” became standard words; a theme can grow by a word becoming fashionable.',
            'Ordförskjutning: ”hållbar” och ”trygghet” blev standardord; ett tema kan växa genom att ett ord blir modernt.',
          )}
        </li>
        <li>
          {l(
            'Who speaks: the number of parties and the share of replies changed; the party view under Explore shows each party apart.',
            'Vem som talar: antalet partier och andelen repliker förändrades; partivyn under Utforska visar varje parti för sig.',
          )}
        </li>
      </ul>
    ),
    limitations: (
      <ul>
        <li>
          {l(
            'Words, not ideas: a pattern matches a word wherever it stands, also in negation or quotation (“kultur av handlingskraft”).',
            'Ord, inte idéer: ett mönster träffar ett ord var det än står, även i negation eller citat (”kultur av handlingskraft”).',
          )}
        </li>
        <li>
          {l(
            'Parliamentary speech is one genre; it is not Swedish society’s imagination of the future.',
            'Riksdagstal är en genre; den är inte det svenska samhällets framtidsföreställning.',
          )}
        </li>
        <li>
          {l(
            'Swedish thesis abstracts (DiVA) are a separate corpus, shown apart under Explore; they are never pooled with the Riksdag.',
            'Svenska uppsatssammanfattningar (DiVA) är en separat korpus, som visas för sig under Utforska; de slås aldrig ihop med riksdagen.',
          )}
        </li>
        {coverage && coverage.years_left_out.length > 0 && (
          <li>
            {l('Partial years left out', 'Ofullständiga år utelämnade')}:{' '}
            {coverage.years_left_out.map((y) => y.year).join(', ')}
          </li>
        )}
      </ul>
    ),
    references: (
      <ul>
        <li>Fisher, M. (2009). Capitalist Realism. Zero Books.</li>
        <li>Fisher, M. (2014). Ghosts of My Life. Zero Books.</li>
        <li>Koselleck, R. (1979). Vergangene Zukunft. Suhrkamp.</li>
        <li>
          Buzan, B., Wæver, O., de Wilde, J. (1998). Security: A New Framework
          for Analysis.
        </li>
      </ul>
    ),
    reproducibility: (
      <dl>
        <dt>{l('Sessions', 'Riksmöten')}</dt>
        <dd className="sw-mono">
          {coverage?.sessions.map((s) => s.session).join(' ')}
        </dd>
        <dt>{l('Pipeline run', 'Pipelinekörning')}</dt>
        <dd className="sw-mono">
          {coverage?.run_id ?? l('local build', 'lokal körning')}
        </dd>
        <dt>{l('Reproduce', 'Reproducera')}</dt>
        <dd className="sw-mono">
          python platform/pipeline.py run sweden_futures
        </dd>
      </dl>
    ),
  }

  const security = themes.find((t) => t.id === 'security')
  const crisis = themes.find((t) => t.id === 'crisis')
  // Security split into its words; the reading needs defence and crime apart from trygghet.
  const sub = (id: string) => {
    const s = trends.subterms?.find((x) => x.id === id)
    const mean = (ys: number[]) => {
      const rs = (s?.rows ?? []).filter((r) => ys.includes(r[0]))
      return rs.length ? rs.reduce((a, r) => a + r[3], 0) / rs.length : null
    }
    return s ? { name: name(s), head: mean(head), tail: mean(tail) } : null
  }
  const hard = [sub('security_defence'), sub('security_crime')]
  const welfare = sub('security_welfare')
  const subChange = (x: ReturnType<typeof sub>) =>
    x && x.head != null && x.tail != null ? x.tail - x.head : null
  const subText = (x: ReturnType<typeof sub>) =>
    x && x.head != null && x.tail != null
      ? `${x.name.toLowerCase()} ${pct(x.head)} → ${pct(x.tail)}`
      : ''
  const readings: Reading[] = [
    {
      theory: 'Fisher: the slow cancellation of the future',
      expects: l(
        'Collective, utopian and alternative futures recede.',
        'Kollektiva, utopiska och alternativa framtider drar sig tillbaka.',
      ),
      verdict:
        faded.length === fisher.length
          ? 'supports'
          : faded.length === 0
            ? 'challenges'
            : 'undetermined',
      why: l(
        `Of utopia, collective transformation and alternative arrangements, ${faded.length} of ${fisher.length} lost more than a fifth of their share (five-year means, ${span(head)} to ${span(tail)}): the evidence splits by theme.`,
        `Av utopi, kollektiv förändring och alternativa ordningar tappade ${faded.length} av ${fisher.length} mer än en femtedel av sin andel (femårsmedel, ${span(head)} till ${span(tail)}): evidensen delar sig per tema.`,
      ),
      limits: l(
        'Fisher wrote about culture and imagination, not parliamentary vocabulary.',
        'Fisher skrev om kultur och föreställningsförmåga, inte om parlamentariskt ordförråd.',
      ),
    },
    {
      theory: l(
        'Securitisation (Copenhagen school)',
        'Säkerhetisering (Köpenhamnsskolan)',
      ),
      expects: l(
        'The future is increasingly framed as security and crisis.',
        'Framtiden ramas alltmer in som säkerhet och kris.',
      ),
      // Supports only when defence and crime both rose and security's shift beats the trend
      // null; challenges when both fell.
      verdict: hard.every((x) => (subChange(x) ?? 0) > 0)
        ? security?.break?.reported
          ? 'supports'
          : 'undetermined'
        : hard.every((x) => (subChange(x) ?? 0) < 0)
          ? 'challenges'
          : 'undetermined',
      why: l(
        `Security ${security ? `${pct(meanOf(security, head))} → ${pct(meanOf(security, tail))}` : '–'}; crisis ${crisis ? `${pct(meanOf(crisis, head))} → ${pct(meanOf(crisis, tail))}` : '–'}. Within security: ${hard.map(subText).filter(Boolean).join(', ')}; ${subText(welfare)} ${(subChange(welfare) ?? 0) > 0 ? 'rose with them' : 'did not rise'}${security?.break && !security.break.reported ? ', and no level shift in security beats a steady trend with noise' : ''}.`,
        `Säkerhet ${security ? `${pct(meanOf(security, head))} → ${pct(meanOf(security, tail))}` : '–'}; kris ${crisis ? `${pct(meanOf(crisis, head))} → ${pct(meanOf(crisis, tail))}` : '–'}. Inom säkerhet: ${hard.map(subText).filter(Boolean).join(', ')}; ${subText(welfare)} ${(subChange(welfare) ?? 0) > 0 ? 'steg med dem' : 'steg inte'}${security?.break && !security.break.reported ? ', och inget nivåskifte i säkerhet slår en jämn trend med brus' : ''}.`,
      ),
      limits: l(
        'Security words also follow crime policy and the war in Ukraine; the counts cannot separate framing from events.',
        'Säkerhetsord följer också kriminalpolitiken och kriget i Ukraina; räkningarna kan inte skilja inramning från händelser.',
      ),
    },
  ]

  return (
    <SwedenResearchPage
      product={product}
      scene={scene}
      findings={findings}
      explore={
        <>
          <Explore
            themes={themes}
            trends={trends}
            years={years}
            picked={picked}
            onPick={(t) => set({ tema: t })}
          />
          <Suspense fallback={null}>
            <FuturesTopics />
          </Suspense>
        </>
      }
      exploreSummary={l(
        'Theme trends, the parties compared, the patterns and source-linked speeches.',
        'Tematrender, partierna jämförda, mönstren och länkade anföranden.',
      )}
      method={method}
      readings={readings}
    />
  )
}

function FutureMatrix({
  themes,
  years,
  measure,
  picked,
  year,
  onPick,
}: {
  themes: Theme[]
  years: number[]
  measure: Measure
  picked: string | null
  year: number | null
  onPick: (theme: string, year: number) => void
}) {
  const top = Math.max(
    ...themes.flatMap((t) => t.rows.map((r) => value(r, measure))),
    1e-9,
  )
  return (
    <div className="sw-table-wrap sw-matrix sw-matrix-wide">
      <table className="sw-table">
        <caption className="visually-hidden">
          {l('Future themes per year', 'Framtidsteman per år')}
        </caption>
        <thead>
          <tr>
            <th scope="col">{l('Theme', 'Tema')}</th>
            {years.map((y) => (
              <th key={y} scope="col" className="sw-n">
                {String(y).slice(2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {themes.map((t) => (
            <tr key={t.id} aria-current={t.id === picked || undefined}>
              <th scope="row">{name(t)}</th>
              {years.map((y) => {
                const r = t.rows.find((x) => x[0] === y)
                const v = r ? value(r, measure) : null
                return (
                  <td
                    key={y}
                    className="sw-cell"
                    data-zero={v == null || undefined}
                    style={{
                      background:
                        v == null
                          ? undefined
                          : `color-mix(in oklab, var(--sw-seq-hi) ${Math.round(Math.sqrt(v / top) * 100)}%, var(--sw-seq-lo))`,
                      outline:
                        t.id === picked && y === year
                          ? '2px solid var(--sw-ink)'
                          : undefined,
                    }}
                  >
                    <button
                      type="button"
                      className="sw-cell-button sw-cell-dot"
                      aria-label={`${name(t)}, ${y}: ${v == null ? '–' : show(v, measure)}`}
                      onClick={() => onPick(t.id, y)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
