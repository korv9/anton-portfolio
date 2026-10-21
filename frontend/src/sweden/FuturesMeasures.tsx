/**
 * E — The Lost Futures, Explore: the future share at equal speech length, and the security and
 * culture themes split into their sub-terms. Both come from export_futures.py.
 */
import { l } from '../i18n'
import MultiLineChart from '../charts/MultiLineChart'
import { name, num, type Trends } from './FuturesExplore'

const point = (y: number, v: number) => ({
  date: `${y}-01-01`,
  label: String(y),
  value: v * 100,
})

export default function FuturesMeasures({
  trends,
  theme,
}: {
  trends: Trends
  theme: string
}) {
  const bands = trends.length_bands
  const parts = (trends.subterms ?? []).filter((s) => s.theme === theme)
  const cut = bands?.upper_words ?? []
  const bandName = (b: number) =>
    b === 0
      ? l(`Up to ${num(cut[0])} words`, `Högst ${num(cut[0])} ord`)
      : b === 3
        ? l(`Over ${num(cut[2])} words`, `Över ${num(cut[2])} ord`)
        : `${num(cut[b - 1] + 1)}–${num(cut[b])} ${l('words', 'ord')}`
  return (
    <>
      {bands && cut.length === 3 && (
        <>
          <h3>
            {l(
              'Speeches about the future at equal length (%)',
              'Anföranden om framtiden vid samma längd (%)',
            )}
          </h3>
          <p className="sw-note">
            {l(
              'Longer speeches match the marker more often. Each line compares speeches of one length band, cut at the quartiles of speech length over all years shown.',
              'Längre anföranden träffar markören oftare. Varje linje jämför anföranden i ett längdband, skuret vid kvartilerna av anförandenas längd över alla visade år.',
            )}
          </p>
          <MultiLineChart
            series={[0, 1, 2, 3].map((b) => ({
              key: String(b),
              name: bandName(b),
              points: bands.rows
                .filter((r) => r[1] === b)
                .map((r) => point(r[0], r[3])),
            }))}
            label={l(
              'Share of speeches about the future, by length band',
              'Andel anföranden om framtiden, per längdband',
            )}
            format={(v) => `${v.toFixed(1)} %`}
            colorOf={(k) => Number(k) + 2}
            yFrom={0}
          />
        </>
      )}
      {parts.length > 0 && (
        <>
          <h3>
            {l(
              'The theme split into its words (%)',
              'Temat uppdelat på sina ord (%)',
            )}
          </h3>
          <p className="sw-note">
            {l(
              'Share of future-oriented speeches using each group of words. A speech can use several, so the lines do not add up to the theme.',
              'Andel framtidsinriktade anföranden som använder varje ordgrupp. Ett anförande kan använda flera, så linjerna summerar inte till temat.',
            )}
          </p>
          <MultiLineChart
            series={parts.map((s) => ({
              key: s.id,
              name: name(s),
              points: s.rows.map((r) => point(r[0], r[3])),
            }))}
            label={l('Sub-terms per year', 'Delord per år')}
            format={(v) => `${v.toFixed(1)} %`}
            colorOf={(k) => parts.findIndex((s) => s.id === k) + 1}
            yFrom={0}
          />
          <ul className="sw-note">
            {parts.map((s) => (
              <li key={s.id}>
                {name(s)}: <code className="sw-mono">{s.pattern}</code>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
