/** Jobs: occupations, from market.json's yearly occupation counts. */
import { useState } from 'react'
import { focal, Frame, Slicer, useData, type Post } from '../kit'
import { Bars, compact, D, fullYear, MARKET, type Market } from './job-kit'
import { l } from '../../i18n'

/** The focal field: its occupations are drawn in the accent. */
const FOCUS = 'Data/IT'

function OccupationBars() {
  const data = useData<Market>(MARKET)
  const [year, setYear] = useState<number | null>(null)
  return (
    <Frame data={data}>
      {(m) => {
        const years = m.years.filter((y) => y <= fullYear(m))
        const yr = year ?? years.at(-1)
        if (yr == null) return null
        const it = m.fields.find((f) => f.name === FOCUS)?.id
        return (
          <>
            <Slicer
              label={l('Year', 'År')}
              cycles
              options={years}
              value={yr}
              onChange={setYear}
            />
            <Bars
              n={20}
              label={l(
                `Occupations with the most ads in ${yr}`,
                `Yrken med flest annonser ${yr}`,
              )}
              format={compact}
              rows={m.occupations
                .filter((o) => o.ads[yr] != null)
                .sort((a, b) => b.ads[yr] - a.ads[yr])
                .slice(0, 25)
                .map((o) => ({
                  key: o.id,
                  label: o.name,
                  value: o.ads[yr],
                  color: focal(o.field === it),
                }))}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-occupation-bars',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'tall',
    title: [
      'Occupations with the most job ads',
      'Yrken med flest platsannonser',
    ],
    note: [
      'Ads per full year by occupation group (SSYK 4), Data/IT occupations highlighted; Arbetsförmedlingen',
      'Annonser per helår efter yrkesgrupp (SSYK 4), yrken inom Data/IT markerade; Arbetsförmedlingen',
    ],
    render: () => <OccupationBars />,
  },
]
