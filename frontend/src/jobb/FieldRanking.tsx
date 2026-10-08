/**
 * The job market by occupation field, ranked by job ads so far this year, with the change on
 * the same months last year written after each number. Click a field to open its occupations;
 * the path above takes you back. The field bar above the page opens a field directly.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { Feature } from '../charts/feature/Feature'
import RankBars from '../charts/RankBars'
import { type Market, change, fieldName, number, signedPct } from './data'

export default function FieldRanking({
  data,
  fields,
}: {
  data: Market
  fields: string[]
}) {
  const [openField, setOpenField] = useState<string | null>(null)
  const year = data.latest_year
  const field = openField ?? (fields.length === 1 ? fields[0] : null)
  const nameOf = (id: string) =>
    fieldName(data.fields.find((f) => f.id === id)?.name ?? id)
  const items = field
    ? data.occupations
        .filter((o) => o.field === field)
        .map((o) => ({
          id: o.id,
          name: o.name,
          now: o.ytd[year] ?? 0,
          before: o.ytd[year - 1] ?? 0,
        }))
    : data.fields.map((f) => {
        const occ = data.occupations.filter((o) => o.field === f.id)
        return {
          id: f.id,
          name: fieldName(f.name),
          now: occ.reduce((s, o) => s + (o.ytd[year] ?? 0), 0),
          before: occ.reduce((s, o) => s + (o.ytd[year - 1] ?? 0), 0),
        }
      })
  const shown = items.filter((i) => i.now > 0)
  const total = shown.reduce((s, i) => s + i.now, 0)
  const before = shown.reduce((s, i) => s + i.before, 0)
  const growing = shown.filter((i) => (change(i.now, i.before) ?? 0) > 0)
  const biggest = [...shown].sort((a, b) => b.now - a.now)[0]
  const months = data.ytd_months

  return (
    <Feature
      id="treemap"
      title={l(
        `${biggest?.name}: most ads so far in ${year}. ${growing.length} of ${shown.length} ${field ? 'occupations' : 'fields'} grew on last year.`,
        `${biggest?.name}: flest annonser hittills ${year}. ${growing.length} av ${shown.length} ${field ? 'yrken' : 'yrkesområden'} ökade mot i fjol.`,
      )}
      lead={l(
        `Job ads in the first ${months} months of ${year} (${number(total)}, ${signedPct(change(total, before))} on the same months of ${year - 1}); the change is written after each number. ${field ? 'The path above goes back to all fields.' : 'Click a field to open its occupations.'}`,
        `Jobbannonser de första ${months} månaderna ${year} (${number(total)}, ${signedPct(change(total, before))} mot samma månader ${year - 1}); förändringen står efter varje tal. ${field ? 'Stigen ovanför går tillbaka till alla områden.' : 'Klicka på ett område för att öppna dess yrken.'}`,
      )}
      controls={
        <nav className="treemap-path" aria-label={l('Level', 'Nivå')}>
          <button
            type="button"
            onClick={() => setOpenField(null)}
            aria-current={!field}
          >
            {l('All fields', 'Alla områden')}
          </button>
          {field && (
            <>
              <span aria-hidden="true">›</span>
              <b>{nameOf(field)}</b>
            </>
          )}
        </nav>
      }
      table={
        <table>
          <thead>
            <tr>
              <th>
                {field ? l('Occupation', 'Yrke') : l('Field', 'Yrkesområde')}
              </th>
              <th className="num">{year}</th>
              <th className="num">{year - 1}</th>
              <th className="num">{l('Change', 'Förändring')}</th>
            </tr>
          </thead>
          <tbody>
            {[...shown]
              .sort((a, b) => b.now - a.now)
              .map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td className="num">{number(i.now)}</td>
                  <td className="num">{number(i.before)}</td>
                  <td className="num">{signedPct(change(i.now, i.before))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      }
      source={l(
        'Arbetsförmedlingen, JobTech historical job ads',
        'Arbetsförmedlingen, JobTechs historiska jobbannonser',
      )}
    >
      <RankBars
        label={l(
          `Job ads so far in ${year}, per ${field ? 'occupation' : 'field'}`,
          `Jobbannonser hittills ${year}, per ${field ? 'yrke' : 'yrkesområde'}`,
        )}
        format={number}
        limit={12}
        onPick={field ? undefined : setOpenField}
        rows={[...shown]
          .sort((a, b) => b.now - a.now)
          .map((i) => ({
            key: i.id,
            label: i.name,
            value: i.now,
            note: signedPct(change(i.now, i.before)),
          }))}
      />
    </Feature>
  )
}
