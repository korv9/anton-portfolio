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
import { Suspense, lazy, useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import { setHashParams, type Route } from '../router'
import { productById } from './products'
import {
  agreed,
  baselines,
  lastComplete,
  leaveOneOut,
  type Verdict,
} from './languageChange'
import {
  MEASURES,
  MeasureAgreement,
  changeIn,
  stability,
  type Sub,
} from './LanguageMeasures'
import Explore, {
  BASE,
  name,
  num,
  pct,
  type Category,
  type Row,
} from './LanguageExplore'
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

type Trends = {
  categories: Category[]
  subterms?: Sub[]
  length_bands?: { cuts: number[] | null }
}
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
type Measure = 'rate' | 'words' | 'standardised' | 'banded' | 'crude'

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
  banded: [
    'Share of ads at 2010 lengths, occupation mix fixed',
    'Andel annonser vid 2010 års längder, fast yrkesmix',
    9,
  ],
  crude: ['Share of ads, as published', 'Andel annonser, som publicerat', 5],
  words: ['Matches per 1,000 words', 'Träffar per 1 000 ord', 7],
}
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
  const scene3d = route.params.get('scen') !== '2d'

  if (trends === null)
    return (
      <p className="sw-section sw-note" role="status">
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
  // As a share of ads (mix fixed) from the same baseline: the other side of the per-word fall.
  const shareRose = cats.filter(
    (c) => (changeIn(c.rows, from, end, 6) ?? 0) > 0,
  ).length
  const asShare =
    shareRose === cats.length
      ? l(
          ` As a share of ads, every category rose; ads grew from ${Math.round(words(from))} to ${Math.round(words(end))} words.`,
          ` Som andel av annonserna ökade varje kategori; annonserna växte från ${Math.round(words(from))} till ${Math.round(words(end))} ord.`,
        )
      : l(
          ` As a share of ads, ${shareRose} of ${cats.length} categories rose; ads grew from ${Math.round(words(from))} to ${Math.round(words(end))} words.`,
          ` Som andel av annonserna ökade ${shareRose} av ${cats.length} kategorier; annonserna växte från ${Math.round(words(from))} till ${Math.round(words(end))} ord.`,
        )
  if (falling.length || (competence && change(competence) < 0))
    findings.push({
      key: 'fall',
      statement:
        l(
          `Per word, some expectations became rarer: ${[...falling, ...(competence && change(competence) < 0 ? [competence] : [])].map(name).join(', ')}.`,
          `Per ord blev vissa förväntningar ovanligare: ${[...falling, ...(competence && change(competence) < 0 ? [competence] : [])].map(name).join(', ')}.`,
        ) + asShare,
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
  const bases = baselines(years, from, end)
  const relOr = (v: number | null) => (v == null ? '–' : rel(v))
  const stable = cats.filter((c) => stability(c.rows, bases, end) !== 'mixed')
  if (bases.length && cats.some((c) => c.rows.some((r) => r[9] != null)))
    findings.push({
      key: 'measures',
      statement: l(
        `${stable.length} of ${cats.length} categories move the same way as a share of ads, per 1,000 words and at equal length, from every starting year (${bases.join(', ')}); for the rest the direction depends on the measure.`,
        `${stable.length} av ${cats.length} kategorier rör sig åt samma håll som andel annonser, per 1 000 ord och vid samma längd, från varje startår (${bases.join(', ')}); för resten beror riktningen på måttet.`,
      ),
      values: (
        <ul>
          {cats
            .filter((c) => !stable.includes(c))
            .map((c) => (
              <li key={c.id}>
                {name(c)} {from}–{end}:{' '}
                {MEASURES.map(
                  ([i, en, sv]) =>
                    `${l(en, sv).toLowerCase()} ${relOr(changeIn(c.rows, from, end, i))}`,
                ).join(', ')}
              </li>
            ))}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'Distinct texts, occupation mix fixed; length bands cut at the 2010 quartiles of words per text',
        'Unika texter, fast yrkesmix; längdband skurna vid 2010 års kvartiler av ord per text',
      ),
      onShow: () => set({ matt: 'banded' }),
    })

  const scene = (
    <Scene
      product={product}
      line={
        l(
          `How often job ads use each kind of expectation, ${first}–${last}. `,
          `Hur ofta platsannonser använder varje slags förväntan, ${first}–${last}. `,
        ) +
        (spanNote
          ? l(
              'Missing years are gaps, not estimates.',
              'Saknade år är luckor, inte skattningar.',
            )
          : l(
              `Every year ${first}–${last} is counted`,
              `Varje år ${first}–${last} är räknat`,
            ) +
            (partial.length
              ? l(
                  `; ${partial.map((p) => p.year).join(', ')} is a partial year.`,
                  `; ${partial.map((p) => p.year).join(', ')} är ett ofullständigt år.`,
                )
              : '.'))
      }
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
            onChange={(v) => set({ scen: v === '3d' ? null : '2d' })}
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
            cols={years[years.length - 1] - years[0] + 1}
            gaps={Array.from(
              { length: years[years.length - 1] - years[0] + 1 },
              (_, i) => i,
            ).filter((i) => !years.includes(years[0] + i))}
            rowLabels={cats.map(name)}
            colLabels={years.map((y) => ({
              col: y - years[0],
              text: String(y),
            }))}
            cells={(() => {
              const top = Math.max(
                ...cats.flatMap((c) =>
                  c.rows.map((r) => value(r, measure) ?? 0),
                ),
                1e-9,
              )
              // A year without a count is a gap in the ground, never a zero bar.
              return cats.flatMap((c, row) =>
                years.flatMap((y) => {
                  const r = at(c, y)
                  const v = r ? value(r, measure) : null
                  if (v == null) return []
                  return [
                    {
                      row,
                      col: y - years[0],
                      height: v / top,
                      key: `${c.id}|${y}`,
                      label: `${name(c)}, ${y}: ${show(v, measure)}`,
                      tone:
                        c.family === 'skill'
                          ? ('stone' as const)
                          : ('glass' as const),
                    },
                  ]
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

  const cuts = trends.length_bands?.cuts ?? null
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
        {cuts && (
          <li>
            {l(
              `Sort each text into four length bands cut at the 2010 quartiles of words per text (${cuts.join(', ')} words), and combine the share within each band with the 2010 band weights. A change counts as stable only when the share of ads, the rate per thousand words and this share agree in sign from every starting year.`,
              `Sortera varje text i fyra längdband skurna vid 2010 års kvartiler av ord per text (${cuts.join(', ')} ord), och väg ihop andelen inom varje band med 2010 års bandvikter. En förändring räknas som stabil bara när andelen annonser, frekvensen per tusen ord och denna andel har samma tecken från varje startår.`,
            )}
          </li>
        )}
        <li>
          {l(
            'Split passion into engage* words and the rest, and identity into the recruitment formulas ("personlig lämplighet", "personliga egenskaper") and the rest. Each match goes to exactly one part.',
            'Dela passion i engage*-ord och resten, och identitet i rekryteringsformlerna ("personlig lämplighet", "personliga egenskaper") och resten. Varje träff hamnar i exakt en del.',
          )}
        </li>
        <li>
          {l(
            'Split each change into a part within groups and a part from the groups’ mix (shift-share), by occupation field, SSYK-4 occupation group and employer type. Staffing and recruitment agencies are read from the employer name.',
            'Dela varje förändring i en del inom grupper och en del från gruppernas mix (shift-share), efter yrkesområde, SSYK-4-yrkesgrupp och arbetsgivartyp. Bemannings- och rekryteringsföretag läses ur arbetsgivarnamnet.',
          )}
        </li>
        <li>
          {l(
            'Draw a seeded sample of matches (17 per category from 2006–2012 and from 2019–2025) for two readers to code. Until it is coded, how often a pattern matches the wrong sense is not known.',
            'Dra ett seedat urval av träffar (17 per kategori från 2006–2012 och från 2019–2025) för två läsare att koda. Tills det är kodat är det okänt hur ofta ett mönster träffar fel betydelse.',
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
            'Who advertises on Platsbanken: the mix of employers and occupations publishing there has changed since 2006; standardisation holds the occupation-field mix, and Explore splits each change by SSYK-4 group and employer type.',
            'Vilka som annonserar på Platsbanken: mixen av arbetsgivare och yrken som publicerar där har förändrats sedan 2006; standardiseringen håller yrkesområdesmixen, och Utforska delar varje förändring efter SSYK-4-grupp och arbetsgivartyp.',
          )}
        </li>
      </ul>
    ),
    limitations: (
      <ul>
        {spanNote && (
          <li>
            {l(
              `The counted years are ${years.join(', ')}; the others are gaps, not estimates.`,
              `De räknade åren är ${years.join(', ')}; övriga år är luckor, inte skattningar.`,
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

  // Each reading is checked from every baseline year and in every measure (share of ads, per
  // 1,000 words, share at equal length); its verdict needs them all to agree.
  const meanIn = (base: number, index: number) => {
    const v = personal.map((c) => changeIn(c.rows, base, end, index))
    return v.some((x) => x == null)
      ? null
      : (v as number[]).reduce((s, x) => s + x, 0) / Math.max(1, v.length)
  }
  const skillIn = (base: number, index: number) =>
    competence ? changeIn(competence.rows, base, end, index) : null
  const everywhere = (
    f: (base: number, index: number) => number | null,
    rule: (v: number) => Verdict,
  ): Verdict => {
    const v = bases.flatMap((b) => MEASURES.map(([i]) => f(b, i)))
    return years.length < 2 || v.some((x) => x == null)
      ? 'undetermined'
      : agreed(v.map((x) => rule(x!)))
  }
  const means = bases.map((b) => meanIn(b, 8) ?? 0)
  const meanChange = meanIn(from, 8) ?? 0
  // Claim 11: how far a single category moves the per-word mean.
  const personalChanges = personal.map((c) => change(c))
  const loo = leaveOneOut(personalChanges)
  const passionAt = personal.findIndex((c) => c.id === 'passion')
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
      theory: l(
        'Han and Fisher: the achievement subject',
        'Han och Fisher: prestationssubjektet',
      ),
      expects: l(
        'Ads ask increasingly for passion, drive and self-realisation, and present work as identity.',
        'Annonser efterfrågar alltmer passion, driv och självförverkligande och framställer arbete som identitet.',
      ),
      verdict: everywhere(meanIn, achievement),
      why:
        l(
          `Per thousand words, the personal categories changed by ${rel(meanChange)} on average between ${from} and ${end} (occupation mix fixed). This page reads a mean change within ±10 % as no change; that is a convention, not a test. As a share of ads the mean is ${relOr(meanIn(from, 6))}, at equal length ${relOr(meanIn(from, 9))}.`,
          `Per tusen ord förändrades de personliga kategorierna med ${rel(meanChange)} i genomsnitt mellan ${from} och ${end} (fast yrkesmix). Sidan läser en genomsnittlig förändring inom ±10 % som ingen förändring; det är en konvention, inte ett test. Som andel av annonserna är medelvärdet ${relOr(meanIn(from, 6))}, vid samma längd ${relOr(meanIn(from, 9))}.`,
        ) +
        range(means) +
        (loo.length
          ? l(
              ` Leaving one category out, the per-word mean runs from ${span(loo)}${passionAt >= 0 ? `; without passion it is ${rel(loo[passionAt])}` : ''}.`,
              ` Utan en kategori i taget ligger medelvärdet per ord mellan ${span(loo)}${passionAt >= 0 ? `; utan passion är det ${rel(loo[passionAt])}` : ''}.`,
            )
          : ''),
      limits: l(
        'A change in wording is not a change in the self; templates and ad length are competing explanations.',
        'En ändring i ordval är inte en ändring i jaget; mallar och annonslängd är konkurrerande förklaringar.',
      ),
    },
    {
      theory: l(
        'Human capital: skills first',
        'Humankapital: kompetensen först',
      ),
      expects: l(
        'Stated qualifications keep their weight or grow as work becomes more specialised.',
        'Uttalade kvalifikationer behåller sin vikt eller växer när arbetet blir mer specialiserat.',
      ),
      verdict: everywhere(skillIn, skillsFirst),
      why: l(
        `Between ${from} and ${end}, stated qualifications changed by ${relOr(skillIn(from, 6))} as a share of ads, ${relOr(skillIn(from, 8))} per thousand words and ${relOr(skillIn(from, 9))} at equal length (occupation mix fixed). The verdict stands only if every measure and every starting year (${bases.join(', ')}) gives it.`,
        `Mellan ${from} och ${end} förändrades uttalade kvalifikationer med ${relOr(skillIn(from, 6))} som andel av annonserna, ${relOr(skillIn(from, 8))} per tusen ord och ${relOr(skillIn(from, 9))} vid samma längd (fast yrkesmix). Utslaget gäller bara om varje mått och varje startår (${bases.join(', ')}) ger det.`,
      ),
      limits: l(
        'The competence pattern counts the mention of a qualification, not how demanding it is.',
        'Kompetensmönstret räknar att en kvalifikation nämns, inte hur krävande den är.',
      ),
    },
    {
      theory: l(
        'Bourdieu: dispositions as capital',
        'Bourdieu: dispositioner som kapital',
      ),
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
          agreement={
            bases.length > 0 && (
              <MeasureAgreement
                cats={cats}
                subs={trends.subterms ?? []}
                bases={bases}
                end={end}
              />
            )
          }
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
