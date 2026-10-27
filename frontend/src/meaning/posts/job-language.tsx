/** Jobs: the language of Swedish job ads since 2006, from sweden/language/*.json. */
import { focal, Frame, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Bars, change, D, linePath, pct, Svg } from './job-kit'
import { l } from '../../i18n'

/** [year, texts, texts_matching, matches, words, share, share_std, per_1000, per_1000_std] */
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
  label_en: string
  label_sv?: string
  rows: Row[]
  break: { first_year_after: number; mean_before: number; mean_after: number }
}
type Trends = { categories: Category[] }
const TRENDS = 'sweden/language/trends.json'
const name = (c: Category) => l(c.label_en, c.label_sv ?? c.label_en)
/** The first half of a two-part name: 'Passion and enthusiasm' -> 'Passion'. */
const short = (c: Category) =>
  l(c.label_en.split(' and ')[0], (c.label_sv ?? c.label_en).split(' och ')[0])

/** Change in the standardised rate per 1,000 words from before a category's break year to
 * after; categories without a rate before the break have no change to show and are left out. */
const jump = (c: Category) => c.break.mean_after / c.break.mean_before - 1
const byJump = (t: Trends) =>
  t.categories
    .filter((c) => c.break.mean_before > 0 && Number.isFinite(jump(c)))
    .sort((a, b) => jump(b) - jump(a))
/** The category whose rate changed most at its break, up or down. */
const biggest = (t: Trends) =>
  byJump(t).reduce<Category | undefined>(
    (a, c) => (!a || Math.abs(jump(c)) > Math.abs(jump(a)) ? c : a),
    undefined,
  )

function Dumbbell() {
  const data = useData<Trends>(TRENDS)
  return (
    <Frame data={data}>
      {(t) => (
        <Bars
          label={l(
            "Change in each category's rate per 1,000 words after its break year",
            'Förändring i varje kategoris frekvens per 1 000 ord efter dess brottår',
          )}
          format={change}
          rows={byJump(t).map((c) => ({
            key: c.id,
            label: short(c),
            value: jump(c),
            color: focal(c === biggest(t)),
            note: l(
              `from ${c.break.first_year_after}`,
              `från ${c.break.first_year_after}`,
            ),
          }))}
        />
      )}
    </Frame>
  )
}

function Multiples() {
  const data = useData<Trends>(TRENDS)
  return (
    <Frame data={data}>
      {(t) => {
        // The focal row is the category whose share grew most since the first year.
        const cats = t.categories.filter((c) => c.rows.length)
        if (!cats.length) return null
        const W = 300,
          cellH = 500 / cats.length
        const rise = (c: Category) => c.rows.at(-1)![5] - c.rows[0][5]
        const top = cats.reduce((a, c) => (rise(c) > rise(a) ? c : a))
        return (
          <Svg
            w={W}
            h={510}
            label={l(
              "Small multiples of each category's share of ad texts",
              'Småmultiplar av varje kategoris andel av annonstexterna',
            )}
          >
            {cats.map((c, k) => {
              const x = linearScale([c.rows[0][0], c.rows.at(-1)![0]], [4, 236])
              const y = linearScale(
                [0, 1],
                [k * cellH + cellH - 4, k * cellH + 4],
              )
              const pts = c.rows.map(
                (r) => [x(r[0]), y(r[5])] as [number, number],
              )
              return (
                <g key={c.id}>
                  <title>{name(c)}</title>
                  <path
                    d={`${linePath(pts)}L236,${y(0)}L4,${y(0)}Z`}
                    fill={focal(c === top)}
                    opacity={c === top ? 1 : 0.55}
                  />
                  <text
                    className={c === top ? 'mean-job-on' : 'mean-job-v'}
                    x={8}
                    y={k * cellH + 15}
                    stroke="var(--paper)"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {short(c)}
                  </text>
                  <text
                    className="mean-job-v"
                    x={W - 2}
                    y={k * cellH + cellH / 2 + 4}
                    textAnchor="end"
                  >
                    {pct(c.rows.at(-1)![5])}
                  </text>
                </g>
              )
            })}
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-lang-dumbbell',
    domain: D,
    sources: ['sweden/language/trends.json'],
    title: (t: Trends) => {
      const c = biggest(t)
      return c
        ? l(
            `${short(c)} words changed most at an estimated break: ${change(jump(c))} from ${c.break.first_year_after}`,
            `Ord om ${short(c).toLowerCase()} ändrades mest vid ett skattat brottår: ${change(jump(c))} från ${c.break.first_year_after}`,
          )
        : l(
            'Change in ad wording around an estimated break year',
            'Förändring i annonsernas ordval kring ett skattat brottår',
          )
    },
    note: [
      "Matches per 1,000 words, field mix held fixed; mean after against before each category's break year (an exploratory split), 2006 on",
      'Träffar per 1 000 ord, med yrkesområdenas fördelning hållen fast; medelvärde efter mot före varje kategoris brottår (en utforskande delning), från 2006',
    ],
    render: () => <Dumbbell />,
  },
  {
    id: 'job-lang-multiples',
    domain: D,
    sources: ['sweden/language/trends.json'],
    size: 'tall',
    title: [
      'Share of job-ad texts using each kind of wording, 2006 on',
      'Andel annonstexter med varje slags ordval, från 2006',
    ],
    note: [
      'Each panel 0–100 %; the latest year on the right; Arbetsförmedlingen ads',
      'Varje panel 0–100 %; senaste året till höger; annonser från Arbetsförmedlingen',
    ],
    render: () => <Multiples />,
  },
]
