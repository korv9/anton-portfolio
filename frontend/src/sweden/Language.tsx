/**
 * B — The Ideal Human (#sweden-arbete). What Swedish job ads ask of people, year by year, from
 * the counts in sweden/language/*.json (platform/publish/sweden/export_language.py, over
 * JobTech's CC0 historical ads). The scene is a year × category matrix of matches per
 * thousand words with the occupation mix held fixed; years not yet counted are shown as gaps,
 * never interpolated. Changes run between complete years (languageChange.ts).
 *
 * Every number is computed from the files. Advertisement language is evidence about how
 * employers write ads, not about what workers are like or how they feel.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import MultiLineChart from '../charts/MultiLineChart'
import RankBars from '../charts/RankBars'
import { setHashParams, type Route } from '../router'
import { productById } from './products'
import { agreed, baselines, lastComplete, type Verdict } from './languageChange'
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

/** year, texts, matching, matches, words, share, share mix fixed, per 1,000 words, per 1,000
 * words mix fixed; the mix-fixed values are null where a year records no occupations. */
type Row = [
  number,
  number,
  number,
  number,
  number,
  number,
  number | null,
  number,
  number | null,
]
type Category = {
  id: string
  family: 'skill' | 'personal'
  label_en: string
  label_sv: string
  description_en: string
  pattern: string
  rows: Row[]
  break: {
    first_year_after: number
    mean_before: number
    mean_after: number
    variance_explained: number
  } | null
}
type Trends = { categories: Category[] }
type Cells = { rows: [string, string, number, number, number][] }
type Examples = { rows: string[][] }
type Coverage = {
  archives: {
    archive: string
    source_url: string
    sha256: string
    ads: number
    distinct_texts: number
    from: string
    counted_at: string
  }[]
  run_id: string | null
  code_sha: string | null
}
type Measure = 'rate' | 'words' | 'standardised' | 'crude'

const BASE = 'sweden/language/'
const MEASURE: Record<Measure, [string, string, number]> = {
  rate: [
    'Matches per 1,000 words, occupation mix fixed',
    'Träffar per 1 000 ord, fast yrkesmix',
    8,
  ],
  standardised: [
    'Share of ads, occupation mix fixed',
    'Andel annonser, fast yrkesmix',
    6,
  ],
  crude: ['Share of ads, as published', 'Andel annonser, som publicerat', 5],
  words: ['Matches per 1,000 words', 'Träffar per 1 000 ord', 7],
}
const pct = (v: number) => `${(v * 100).toFixed(1)} %`
const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
const name = (c: Category) => l(c.label_en, c.label_sv)
const value = (r: Row, m: Measure) => r[MEASURE[m][2]] as number | null
const isRate = (m: Measure) => m === 'rate' || m === 'words'
const show = (v: number, m: Measure) => (isRate(m) ? v.toFixed(2) : pct(v))
// Ads grew several times longer since 2006, so shares of ads rise with length alone: the main
// measure is the rate per thousand words with the occupation mix fixed.
const MAIN: Measure = 'rate'
const rate = (r: Row) => r[8] ?? 0

const BarField = lazy(() => import('./BarField'))

export default function Language({ route }: { route: Route }) {
  const product = productById('B')
  const [trends, setTrends] = useState<Trends | 'error' | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  useEffect(() => {
    fetchJson<Trends>(BASE + 'trends.json').then(setTrends, () =>
      setTrends('error'),
    )
    fetchJson<Coverage>(BASE + 'coverage.json').then(setCoverage, () => {})
  }, [])
  const measure = (route.params.get('matt') as Measure) || MAIN
  const picked = route.params.get('kategori')
  const year = Number(route.params.get('ar')) || null
  const set = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(route.params)
    for (const [k, v] of Object.entries(changes))
      v == null || v === '' ? params.delete(k) : params.set(k, v)
    setHashParams(route.path, params, true)
  }
  const scene3d = route.params.get('scen') === '3d'

  if (trends === null)
    return (
      <p className="sweden sw-note" role="status">
        {l('Loading…', 'Laddar…')}
      </p>
    )
  if (trends === 'error' || !trends.categories.some((c) => c.rows.length))
    return (
      <ProductEmpty product={product}>
        <EmptyState
          state="cloud"
          shows={l(
            'Job-ad language over time, by category, occupation and county.',
            'Platsannonsernas språk över tid, per kategori, yrke och län.',
          )}
          needs={l(
            'The counts in sweden/language/trends.json, written by the sweden_language pipeline subject.',
            'Räkningarna i sweden/language/trends.json, skrivna av pipeline-subjektet sweden_language.',
          )}
        />
      </ProductEmpty>
    )

  const cats = trends.categories
  const years = [...new Set(cats.flatMap((c) => c.rows.map((r) => r[0])))].sort(
    (a, b) => a - b,
  )
  const first = years[0]
  const last = years[years.length - 1]
  const at = (c: Category, y: number) => c.rows.find((r) => r[0] === y)
  // The occupation-standardised rate starts with the first year that records occupations.
  const from =
    years.find((y) => cats.every((c) => at(c, y)?.[8] != null)) ?? first
  // A year counted only from quarterly archives (2026-Q1, …) is still running.
  const quarters = (coverage?.archives ?? []).filter((a) =>
    a.archive.includes('-Q'),
  )
  const partial = [...new Set(quarters.map((a) => a.archive.slice(0, 4)))].map(
    (year) => ({
      year,
      archives: quarters
        .filter((a) => a.archive.startsWith(year))
        .map((a) => a.archive),
    }),
  )
  const end = lastComplete(
    years,
    partial.map((p) => p.year),
  )
  /** Relative change of the main rate from a baseline year to the last complete year. */
  const change = (c: Category, base = from) => {
    const a = at(c, base)
    const b = at(c, end)
    return a && b && rate(a) > 0 ? rate(b) / rate(a) - 1 : 0
  }
  const personal = cats.filter((c) => c.family === 'personal')
  const competence = cats.find((c) => c.family === 'skill')
  const rising = [...personal].sort((a, b) => change(b) - change(a))
  const falling = rising.filter((c) => change(c) < 0)
  const selected = cats.find((c) => c.id === picked) ?? null
  const spanNote = years.length < last - first + 1
  const rel = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)} %`
  const words = (y: number) => {
    const r = competence && at(competence, y)
    return r ? r[4] / r[1] : 0
  }

  const findings: Finding[] = []
  if (years.length >= 2 && words(first) > 0)
    findings.push({
      key: 'length',
      contrary: true,
      statement: l(
        `Ads grew from ${Math.round(words(first))} to ${Math.round(words(end))} words between ${first} and ${end}, so almost every expectation appears in more ads; per word, the picture is different.`,
        `Annonserna växte från ${Math.round(words(first))} till ${Math.round(words(end))} ord mellan ${first} och ${end}, så nästan varje förväntan finns i fler annonser; per ord ser bilden annorlunda ut.`,
      ),
      values: (
        <ul>
          {[...cats]
            .sort((a, b) => change(b) - change(a))
            .map((c) => (
              <li key={c.id}>
                {name(c)}: {l('share of ads', 'andel annonser')} {first}–{end}{' '}
                {pct(value(at(c, first)!, 'crude')!)} →{' '}
                {pct(value(at(c, end)!, 'crude')!)};{' '}
                {l('per 1,000 words', 'per 1 000 ord')} {from}–{end}{' '}
                {rel(change(c))}
              </li>
            ))}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'JobTech historical ads (CC0), distinct texts, occupation mix fixed',
        'JobTechs historiska annonser (CC0), unika texter, fast yrkesmix',
      ),
      onShow: () => set({ matt: 'crude' }),
    })
  if (years.length >= 2 && rising.length) {
    const top = rising[0]
    findings.push({
      key: 'rise',
      statement: l(
        `Per thousand words, ${name(top).toLowerCase()} rose most among the personal expectations: ${show(rate(at(top, from)!), MAIN)} in ${from}, ${show(rate(at(top, end)!), MAIN)} in ${end}.`,
        `Per tusen ord ökade ${name(top).toLowerCase()} mest bland de personliga förväntningarna: ${show(rate(at(top, from)!), MAIN)} ${from}, ${show(rate(at(top, end)!), MAIN)} ${end}.`,
      ),
      values: (
        <ul>
          {rising.slice(0, 3).map((c) => (
            <li key={c.id}>
              {name(c)}: {show(rate(at(c, from)!), MAIN)} →{' '}
              {show(rate(at(c, end)!), MAIN)} ({rel(change(c))})
            </li>
          ))}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'Matches per 1,000 words, occupation mix fixed',
        'Träffar per 1 000 ord, fast yrkesmix',
      ),
      onShow: () => set({ kategori: top.id, matt: null }),
    })
  }
  if (falling.length || (competence && change(competence) < 0))
    findings.push({
      key: 'fall',
      statement: l(
        `Per word, some expectations became rarer: ${[...falling, ...(competence && change(competence) < 0 ? [competence] : [])].map(name).join(', ')}.`,
        `Per ord blev vissa förväntningar ovanligare: ${[...falling, ...(competence && change(competence) < 0 ? [competence] : [])].map(name).join(', ')}.`,
      ),
      values: (
        <ul>
          {[
            ...falling,
            ...(competence && change(competence) < 0 ? [competence] : []),
          ].map((c) => (
            <li key={c.id}>
              {name(c)}: {show(rate(at(c, from)!), MAIN)} →{' '}
              {show(rate(at(c, end)!), MAIN)} ({rel(change(c))})
            </li>
          ))}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'Matches per 1,000 words, occupation mix fixed',
        'Träffar per 1 000 ord, fast yrkesmix',
      ),
      onShow: () =>
        set({ kategori: (falling[0] ?? competence)!.id, matt: null }),
    })

  const scene = (
    <Scene
      product={product}
      line={l(
        `How often job ads use each kind of expectation, ${first}–${last}. Columns are the years counted so far; missing years are gaps, not estimates.`,
        `Hur ofta platsannonser använder varje slags förväntan, ${first}–${last}. Kolumnerna är de år som räknats hittills; saknade år är luckor, inte skattningar.`,
      )}
      legend={
        <>
          <b>{l(...(MEASURE[measure].slice(0, 2) as [string, string]))}</b>
          <p className="sw-note">
            {l(
              'Rows split into stated qualifications and personal expectations.',
              'Raderna delas i uttalade kvalifikationer och personliga förväntningar.',
            )}
          </p>
          <div className="sw-ramp" aria-hidden="true" />
        </>
      }
      control={
        <div className="sw-controls">
          <ViewToggle
            view={scene3d ? '3d' : 'matrix'}
            onChange={(v) => set({ scen: v === '3d' ? '3d' : null })}
          />
          <label>
            {l('Measure', 'Mått')}
            <select
              value={measure}
              onChange={(e) =>
                set({
                  matt: e.target.value === MAIN ? null : e.target.value,
                })
              }
            >
              {(Object.keys(MEASURE) as Measure[]).map((m) => (
                <option key={m} value={m}>
                  {l(MEASURE[m][0], MEASURE[m][1])}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      info={
        selected ? (
          <>
            <b>{name(selected)}</b>
            {year && at(selected, year) && (
              <p className="sw-mono">
                {year}:{' '}
                {value(at(selected, year)!, measure) == null
                  ? l('no occupations recorded', 'inga yrken registrerade')
                  : show(value(at(selected, year)!, measure)!, measure)}{' '}
                · {num(at(selected, year)![2])} {l('of', 'av')}{' '}
                {num(at(selected, year)![1])} {l('texts', 'texter')}
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
            rows={cats.length}
            cols={years.length}
            cells={(() => {
              const top = Math.max(
                ...cats.flatMap((c) =>
                  c.rows.map((r) => value(r, measure) ?? 0),
                ),
                1e-9,
              )
              return cats.flatMap((c, row) =>
                years.map((y, col) => {
                  const r = at(c, y)
                  const v = r ? value(r, measure) : null
                  return {
                    row,
                    col,
                    height: (v ?? 0) / top,
                    key: `${c.id}|${y}`,
                    label: `${name(c)}, ${y}: ${v == null ? '–' : show(v, measure)}`,
                  }
                }),
              )
            })()}
            picked={picked && year ? `${picked}|${year}` : null}
            onPick={(key) => {
              const [c, y] = key.split('|')
              set({ kategori: c, ar: y })
            }}
            label={l('3D view of the matrix', '3D-vy av matrisen')}
            fallback={
              <LanguageMatrix
                cats={cats}
                years={years}
                measure={measure}
                picked={picked}
                year={year}
                onPick={(c, y) => set({ kategori: c, ar: String(y) })}
              />
            }
          />
        </Suspense>
      ) : (
        <LanguageMatrix
          cats={cats}
          years={years}
          measure={measure}
          picked={picked}
          year={year}
          onPick={(c, y) => set({ kategori: c, ar: String(y) })}
        />
      )}{' '}
    </Scene>
  )

  const method: Method = {
    question: <p>{l(product.question.en, product.question.sv)}</p>,
    theory: (
      <p>
        {l(
          'Marx on labour power as the commodity a worker sells; Foucault on norms that shape the self; Bourdieu on dispositions valued as capital; Byung-Chul Han on the achievement subject who exploits itself; Mark Fisher on the demand to be passionate. Each predicts more personality and less skill in what employers ask for; the counts can show whether ad language moved that way, not why.',
          'Marx om arbetskraften som den vara arbetaren säljer; Foucault om normer som formar jaget; Bourdieu om dispositioner som värderas som kapital; Byung-Chul Han om prestationssubjektet som exploaterar sig självt; Mark Fisher om kravet att vara passionerad. Var och en förutser mer personlighet och mindre kompetens i det arbetsgivare efterfrågar; räkningarna kan visa om annonsspråket rört sig så, inte varför.',
        )}
      </p>
    ),
    data: (
      <ul>
        <li>
          <a href="https://data.arbetsformedlingen.se/annonser/historiska/">
            JobTech, {l('historical job ads', 'historiska platsannonser')}
          </a>{' '}
          — CC0 ({l('stated in', 'angivet i')}{' '}
          <a href="https://gitlab.com/arbetsformedlingen/job-ads/getting-started-code-examples/historical-ads-info">
            historical-ads-info
          </a>
          )
        </li>
        {coverage && (
          <li>
            {l('Counted', 'Räknade')}:{' '}
            {coverage.archives.map((a) => a.archive).join(', ')} ·{' '}
            {num(coverage.archives.reduce((s, a) => s + a.distinct_texts, 0))}{' '}
            {l('distinct texts', 'unika texter')}
          </li>
        )}
      </ul>
    ),
    method: (
      <ol>
        <li>
          {l(
            'Stream each yearly archive once in GitHub Actions, keep no ad, and delete the archive.',
            'Strömma varje årsarkiv en gång i GitHub Actions, behåll ingen annons och radera arkivet.',
          )}
        </li>
        <li>
          {l(
            'Count each distinct text once (an ad posted for many workplaces repeats its text).',
            'Räkna varje unik text en gång (en annons för många arbetsplatser upprepar sin text).',
          )}
        </li>
        <li>
          {l(
            'Match nine categories of regular expressions in headline and description (Swedish and English), listed with their patterns under Explore.',
            'Matcha nio kategorier av reguljära uttryck i rubrik och beskrivning (svenska och engelska), listade med sina mönster under Utforska.',
          )}
        </li>
        <li>
          {l(
            'Report the share of texts using a category, the same share with the occupation-field mix held at its pooled level (direct standardisation), and matches per thousand words.',
            'Redovisa andelen texter som använder en kategori, samma andel med yrkesområdesmixen hållen på sin sammanlagda nivå (direkt standardisering), och träffar per tusen ord.',
          )}
        </li>
        <li>
          {l(
            'Where at least six years exist, the single least-squares break in each standardised series is shown as exploratory.',
            'Där minst sex år finns visas den enda minsta-kvadrat-brytpunkten i varje standardiserad serie som explorativ.',
          )}
        </li>
      </ol>
    ),
    results: (
      <p>
        {l(
          'The findings and Explore views above are computed from the published counts.',
          'Resultaten och Utforska-vyerna ovan räknas fram ur de publicerade räkningarna.',
        )}
      </p>
    ),
    alternatives: (
      <ul>
        <li>
          {l(
            'Ad templates: recruitment systems and agencies spread stock phrases ("personlig lämplighet", "brinner för"), so a rise can be a change in templates rather than in demands.',
            'Annonsmallar: rekryteringssystem och bemanningsföretag sprider standardfraser ("personlig lämplighet", "brinner för"), så en ökning kan vara en ändring i mallar snarare än i krav.',
          )}
        </li>
        <li>
          {l(
            'Longer ads: when ads grow, every category becomes more likely to appear at least once; per-thousand-word rates correct for length, shares do not.',
            'Längre annonser: när annonser växer blir varje kategori mer sannolik att förekomma minst en gång; frekvens per tusen ord korrigerar för längd, andelar gör det inte.',
          )}
        </li>
        <li>
          {l(
            'Who advertises on Platsbanken: the mix of employers and occupations publishing there has changed since 2006; standardisation holds the occupation-field mix, not the employer mix.',
            'Vilka som annonserar på Platsbanken: mixen av arbetsgivare och yrken som publicerar där har förändrats sedan 2006; standardiseringen håller yrkesområdesmixen, inte arbetsgivarmixen.',
          )}
        </li>
      </ul>
    ),
    limitations: (
      <ul>
        {spanNote && (
          <li>
            {l(
              `Only ${years.join(', ')} are counted so far; the other years run in the weekly cloud build.`,
              `Bara ${years.join(', ')} är räknade hittills; övriga år körs i den veckovisa molnbygget.`,
            )}
          </li>
        )}
        {partial.length > 0 && (
          <li>
            {l(
              `${partial.map((p) => p.year).join(', ')} is still running: it covers only the quarterly archives ${partial.map((p) => p.archives.join(', ')).join('; ')}. Changes are measured to ${end}, the last complete year.`,
              `${partial.map((p) => p.year).join(', ')} pågår fortfarande: året bygger bara på kvartalsarkiven ${partial.map((p) => p.archives.join(', ')).join('; ')}. Förändringar mäts till ${end}, det senaste hela året.`,
            )}
          </li>
        )}
        <li>
          {l(
            'A pattern matches wherever the words occur: an employer describing itself ("our passion for…") counts like a demand on the applicant.',
            'Ett mönster träffar var orden än står: en arbetsgivare som beskriver sig själv ("vår passion för…") räknas som ett krav på den sökande.',
          )}
        </li>
        <li>
          {l(
            'The 2020–2023 archives also use eight occupation-field names outside the taxonomy ("Pedagogiskt arbete" beside "Pedagogik"); they are mapped to the 21 taxonomy fields. A field with fewer than 30 texts in a year drops out of that year’s standardised value.',
            'Arkiven 2020–2023 använder också åtta namn på yrkesområden utanför taxonomin ("Pedagogiskt arbete" bredvid "Pedagogik"); de förs till taxonomins 21 områden. Ett område med färre än 30 texter ett år faller bort ur årets standardiserade värde.',
          )}
        </li>
        <li>
          {l(
            'Ads published near a year boundary can appear in two archives and are then counted in both.',
            'Annonser publicerade nära ett årsskifte kan finnas i två arkiv och räknas då i båda.',
          )}
        </li>
        <li>
          {l(
            'Advertisement language does not measure workers’ mental states, actual hiring, or what employers value in practice.',
            'Annonsspråk mäter inte arbetstagares sinnestillstånd, faktiska anställningar eller vad arbetsgivare värderar i praktiken.',
          )}
        </li>
      </ul>
    ),
    references: (
      <ul>
        <li>Marx, K. (1867). Das Kapital, vol. 1.</li>
        <li>Foucault, M. (1975). Surveiller et punir. Gallimard.</li>
        <li>Bourdieu, P. (1979). La Distinction. Minuit.</li>
        <li>Han, B.-C. (2010). Müdigkeitsgesellschaft. Matthes & Seitz.</li>
        <li>Fisher, M. (2009). Capitalist Realism. Zero Books.</li>
      </ul>
    ),
    reproducibility: coverage ? (
      <dl>
        {coverage.archives.map((a) => (
          <div key={a.archive} style={{ display: 'contents' }}>
            <dt>{a.archive}</dt>
            <dd className="sw-mono">
              {a.sha256.slice(0, 16)} · {num(a.ads)} {l('ads', 'annonser')} ·{' '}
              {num(a.distinct_texts)} {l('distinct', 'unika')} · {a.counted_at}
            </dd>
          </div>
        ))}
        <dt>{l('Pipeline run', 'Pipelinekörning')}</dt>
        <dd className="sw-mono">
          {coverage.run_id ?? l('local build', 'lokal körning')}
        </dd>
        <dt>{l('Reproduce', 'Reproducera')}</dt>
        <dd className="sw-mono">
          python platform/pipeline.py run sweden_language
        </dd>
      </dl>
    ) : (
      <p className="sw-note">–</p>
    ),
  }

  // Each reading is checked from every baseline year; its verdict needs them all to agree.
  const bases = baselines(years, from, end)
  const meanFrom = (base: number) =>
    personal.reduce((s, c) => s + change(c, base), 0) /
    Math.max(1, personal.length)
  const means = bases.map(meanFrom)
  const skills = bases.map((b) => (competence ? change(competence, b) : 0))
  const meanChange = meanFrom(from)
  const skillChange = competence ? change(competence) : 0
  const span = (v: number[]) =>
    `${rel(Math.min(...v))} ${l('to', 'till')} ${rel(Math.max(...v))}`
  const range = (v: number[]) =>
    bases.length > 1
      ? l(
          ` With ${bases.join(', ')} as the starting year the value runs from ${span(v)}; the verdict holds only if every starting year gives it.`,
          ` Med ${bases.join(', ')} som startår ligger värdet mellan ${span(v)}; utslaget gäller bara om varje startår ger det.`,
        )
      : ''
  const achievement = (v: number): Verdict =>
    v > 0.1 ? 'supports' : v < -0.1 ? 'challenges' : 'undetermined'
  const skillsFirst = (v: number): Verdict =>
    v >= -0.1 ? 'supports' : 'challenges'
  const readings: Reading[] = [
    {
      theory: 'Han and Fisher: the achievement subject',
      expects: l(
        'Ads ask increasingly for passion, drive and self-realisation, and present work as identity.',
        'Annonser efterfrågar alltmer passion, driv och självförverkligande och framställer arbete som identitet.',
      ),
      verdict:
        years.length < 2 ? 'undetermined' : agreed(means.map(achievement)),
      why:
        l(
          `Per thousand words, the personal categories changed by ${rel(meanChange)} on average between ${from} and ${end} (occupation mix fixed; a change within ±10 % is read as no change).`,
          `Per tusen ord förändrades de personliga kategorierna med ${rel(meanChange)} i genomsnitt mellan ${from} och ${end} (fast yrkesmix; en förändring inom ±10 % läses som ingen förändring).`,
        ) + range(means),
      limits: l(
        'A change in wording is not a change in the self; templates and ad length are competing explanations.',
        'En ändring i ordval är inte en ändring i jaget; mallar och annonslängd är konkurrerande förklaringar.',
      ),
    },
    {
      theory: 'Human capital: skills first',
      expects: l(
        'Stated qualifications keep their weight or grow as work becomes more specialised.',
        'Uttalade kvalifikationer behåller sin vikt eller växer när arbetet blir mer specialiserat.',
      ),
      verdict:
        years.length < 2 ? 'undetermined' : agreed(skills.map(skillsFirst)),
      why:
        l(
          `Per thousand words, stated qualifications changed by ${rel(skillChange)} between ${from} and ${end}.`,
          `Per tusen ord förändrades uttalade kvalifikationer med ${rel(skillChange)} mellan ${from} och ${end}.`,
        ) + range(skills),
      limits: l(
        'The competence pattern counts the mention of a qualification, not how demanding it is.',
        'Kompetensmönstret räknar att en kvalifikation nämns, inte hur krävande den är.',
      ),
    },
    {
      theory: 'Bourdieu: dispositions as capital',
      expects: l(
        'Personal demands concentrate in occupations where cultural capital is rewarded (administration, communication, culture).',
        'Personliga krav koncentreras till yrken där kulturellt kapital belönas (administration, kommunikation, kultur).',
      ),
      verdict: 'undetermined',
      why: l(
        'The occupation comparison under Explore shows where categories are common; it does not measure the capital of applicants.',
        'Yrkesjämförelsen under Utforska visar var kategorierna är vanliga; den mäter inte de sökandes kapital.',
      ),
      limits: l(
        'Needs data on who is hired, not only on what is advertised.',
        'Kräver data om vilka som anställs, inte bara om vad som annonseras.',
      ),
    },
  ]

  return (
    <SwedenResearchPage
      product={product}
      scene={scene}
      findings={findings}
      explore={
        <Explore
          cats={cats}
          years={years}
          picked={picked}
          onPick={(c) => set({ kategori: c })}
        />
      }
      exploreSummary={l(
        'Trends per category, comparisons by occupation and county, the patterns, and masked examples.',
        'Trender per kategori, jämförelser per yrke och län, mönstren och maskade exempel.',
      )}
      method={method}
      readings={readings}
    />
  )
}

function LanguageMatrix({
  cats,
  years,
  measure,
  picked,
  year,
  onPick,
}: {
  cats: Category[]
  years: number[]
  measure: Measure
  picked: string | null
  year: number | null
  onPick: (category: string, year: number) => void
}) {
  const all = cats.flatMap((c) => c.rows.map((r) => value(r, measure) ?? 0))
  const top = Math.max(...all, 1e-9)
  const groups: [Category['family'], string, string][] = [
    ['skill', 'Stated qualifications', 'Uttalade kvalifikationer'],
    ['personal', 'Personal expectations', 'Personliga förväntningar'],
  ]
  return (
    <div className="sw-table-wrap sw-matrix">
      <table className="sw-table">
        <caption className="visually-hidden">
          {l(
            'Job-ad language per category and year',
            'Annonsspråk per kategori och år',
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col">{l('Category', 'Kategori')}</th>
            {years.map((y) => (
              <th key={y} scope="col" className="sw-n">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map(([family, en, sv]) => (
          <tbody key={family}>
            <tr>
              <th
                scope="rowgroup"
                colSpan={years.length + 1}
                className="sw-group"
              >
                {l(en, sv)}
              </th>
            </tr>
            {cats
              .filter((c) => c.family === family)
              .map((c) => (
                <tr key={c.id} aria-current={c.id === picked || undefined}>
                  <th scope="row">{name(c)}</th>
                  {years.map((y) => {
                    const r = c.rows.find((x) => x[0] === y)
                    const v = r ? value(r, measure) : null
                    const t = v == null ? 0 : v / top
                    return (
                      <td
                        key={y}
                        className="sw-cell"
                        data-zero={v == null || undefined}
                        style={{
                          background:
                            v == null
                              ? undefined
                              : `color-mix(in oklab, var(--sw-seq-hi) ${Math.round(t * 100)}%, var(--sw-seq-lo))`,
                          outline:
                            c.id === picked && y === year
                              ? '2px solid var(--sw-ink)'
                              : undefined,
                        }}
                      >
                        <button
                          type="button"
                          className="sw-cell-button"
                          aria-label={`${name(c)}, ${y}: ${v == null ? l('not counted', 'inte räknat') : show(v, measure)}`}
                          onClick={() => onPick(c.id, y)}
                        >
                          <span>{v == null ? '·' : show(v, measure)}</span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function Explore({
  cats,
  years,
  picked,
  onPick,
}: {
  cats: Category[]
  years: number[]
  picked: string | null
  onPick: (category: string) => void
}) {
  const [fields, setFields] = useState<Cells | null>(null)
  const [regions, setRegions] = useState<Cells | null>(null)
  const [examples, setExamples] = useState<Examples | null>(null)
  const [by, setBy] = useState<'field' | 'region'>('field')
  const category = picked ?? cats[1]?.id ?? cats[0].id
  const last = years[years.length - 1]
  const [year, setYear] = useState(last)
  useEffect(() => {
    fetchJson<Cells>(BASE + 'fields.json').then(setFields, () => {})
    fetchJson<Cells>(BASE + 'regions.json').then(setRegions, () => {})
    fetchJson<Examples>(BASE + 'examples.json').then(setExamples, () => {})
  }, [])
  const lines = useMemo(() => {
    const keys = [...new Set([category, ...cats.map((c) => c.id)])].slice(0, 5)
    return keys.map((k) => {
      const c = cats.find((x) => x.id === k)!
      return {
        key: k,
        name: name(c),
        // The mix-fixed rate exists from the first year that records occupations.
        points: c.rows
          .filter((r) => r[8] != null)
          .map((r, i, rows) => ({
            date: `${r[0]}-01-01`,
            label: String(r[0]),
            value: r[8]!,
            // A gap of more than a year is a break in the line, never an interpolation.
            breakBefore: i > 0 && r[0] - rows[i - 1][0] > 1,
          })),
      }
    })
  }, [cats, category])
  const cells = by === 'field' ? fields : regions
  const ranked = (cells?.rows ?? [])
    .filter((r) => r[1] === category && r[2] === year)
    .map((r) => ({
      key: r[0],
      label: r[0],
      value: r[4] / r[3],
      note: `${num(r[4])} / ${num(r[3])}`,
    }))
    .sort((a, b) => b.value - a.value)
  const cat = cats.find((c) => c.id === category)!
  return (
    <>
      <div className="sw-controls">
        <label>
          {l('Category', 'Kategori')}
          <select value={category} onChange={(e) => onPick(e.target.value)}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {name(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3>
        {l(
          'Matches per 1,000 words, occupation mix fixed',
          'Träffar per 1 000 ord, fast yrkesmix',
        )}
      </h3>
      <MultiLineChart
        series={lines}
        label={l(
          'Standardised rate per year',
          'Standardiserad frekvens per år',
        )}
        format={(v) => v.toFixed(2)}
        colorOf={(k) => lines.findIndex((s) => s.key === k) + 1}
        yFrom={0}
      />
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption>
            {l('Every category and year', 'Varje kategori och år')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Category', 'Kategori')}</th>
              <th scope="col" className="sw-n">
                {l('Year', 'År')}
              </th>
              <th scope="col" className="sw-n">
                {l('Distinct texts', 'Unika texter')}
              </th>
              <th scope="col" className="sw-n">
                {l('Using it', 'Använder den')}
              </th>
              <th scope="col" className="sw-n">
                {l('Share', 'Andel')}
              </th>
              <th scope="col" className="sw-n">
                {l('Standardised', 'Standardiserad')}
              </th>
              <th scope="col" className="sw-n">
                {l('Per 1,000 words', 'Per 1 000 ord')}
              </th>
              <th scope="col" className="sw-n">
                {l('Per 1,000 words, mix fixed', 'Per 1 000 ord, fast mix')}
              </th>
              <th scope="col" className="sw-n">
                {l('Words per text', 'Ord per text')}
              </th>
            </tr>
          </thead>
          <tbody>
            {cats.flatMap((c) =>
              c.rows.map((r) => (
                <tr key={c.id + r[0]}>
                  <th scope="row">{name(c)}</th>
                  <td className="sw-n">{r[0]}</td>
                  <td className="sw-n">{num(r[1])}</td>
                  <td className="sw-n">{num(r[2])}</td>
                  <td className="sw-n">{pct(r[5])}</td>
                  <td className="sw-n">{r[6] == null ? '–' : pct(r[6])}</td>
                  <td className="sw-n">{r[7].toFixed(2)}</td>
                  <td className="sw-n">
                    {r[8] == null ? '–' : r[8].toFixed(2)}
                  </td>
                  <td className="sw-n">{Math.round(r[4] / r[1])}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <h3>{l('By occupation field or county', 'Per yrkesområde eller län')}</h3>
      <div className="sw-controls">
        <label>
          {l('Compare', 'Jämför')}
          <select
            value={by}
            onChange={(e) => setBy(e.target.value as 'field' | 'region')}
          >
            <option value="field">
              {l('Occupation fields', 'Yrkesområden')}
            </option>
            <option value="region">{l('Counties', 'Län')}</option>
          </select>
        </label>
        <label>
          {l('Year', 'År')}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {ranked.length ? (
        <RankBars
          rows={ranked}
          format={pct}
          max={1}
          label={l(
            `${name(cat)} by ${by}`,
            `${name(cat)} per ${by === 'field' ? 'yrkesområde' : 'län'}`,
          )}
        />
      ) : (
        <p className="sw-note">{l('Loading…', 'Laddar…')}</p>
      )}
      <p className="sw-note">
        {l(
          'Crude shares; cells with fewer than 30 distinct texts are left out.',
          'Råa andelar; celler med färre än 30 unika texter är utelämnade.',
        )}
      </p>

      <h3>{l('The pattern and examples', 'Mönstret och exempel')}</h3>
      <p className="sw-note">{cat.description_en}</p>
      <pre className="sw-mono sw-pattern">{cat.pattern}</pre>
      {examples && (
        <ul className="sw-examples">
          {examples.rows
            .filter((r) => r[0] === category)
            .map((r, i) => (
              <li key={i}>
                <span className="sw-mono">
                  {r[1]} · {r[3]}
                </span>{' '}
                <q>{r[6]}</q>
              </li>
            ))}
        </ul>
      )}
      <p className="sw-note">
        {l(
          'Drawn reproducibly by the lowest hash of the ad text; e-mail addresses and phone numbers masked.',
          'Dragna reproducerbart med lägsta hash av annonstexten; e-postadresser och telefonnummer maskerade.',
        )}
      </p>
    </>
  )
}
