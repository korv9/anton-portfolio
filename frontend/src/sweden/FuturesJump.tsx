/**
 * E — The Lost Futures, Explore: the DiVA 2024–25 rise taken apart, from `academic.jump` in
 * trends.json (export_futures_theses.py). Which words of the marker carry it, and how much a shift
 * in subject areas or institutions explains.
 */
import { l } from '../i18n'
import { pct } from './FuturesExplore'

export type Jump = {
  columns: string[]
  rows: number[][]
  periods: [number[], number[]]
  shift_share: Record<
    string,
    {
      composition: number
      within: number
      interaction: number
      cells: number
      cells_rising: number
    }
  >
}

const points = (v: number) => (v * 100).toFixed(1)

export default function FuturesJump({ jump }: { jump: Jump }) {
  const col = (c: string) => jump.columns.indexOf(c)
  const at = (y: number) => jump.rows.find((r) => r[0] === y)
  const [before, after] = jump.periods
  const base = at(before[before.length - 1])
  const last = at(after[after.length - 1])
  if (!base || !last) return null
  const [y0, y1] = [base[0], last[0]]
  const rest = col('future_share_without_research_long_term')
  const earlier = jump.rows.filter((r) => r[0] < after[0]).map((r) => r[rest])
  const area = jump.shift_share.area
  const inst = jump.shift_share.institution
  const change = inst.composition + inst.within + inst.interaction
  const v = (r: number[], c: string) => pct(r[col(c)])
  return (
    <p className="sw-note">
      {l(
        `The rise in ${after.join(' and ')} sits in two of the marker’s words. Abstracts using “långsiktig” or “på lång sikt” (long-term) went from ${v(base, 'using_long_term')} in ${y0} to ${v(last, 'using_long_term')} in ${y1}, and those using “framtida forskning” (future research) and its kin from ${v(base, 'using_research')} to ${v(last, 'using_research')}. Without these two the share is ${pct(base[rest])} in ${y0} and ${pct(last[rest])} in ${y1}, against ${pct(Math.min(...earlier))}–${pct(Math.max(...earlier))} in ${jump.rows[0][0]}–${after[0] - 1}. The rise appears in ${area.cells_rising} of ${area.cells} subject areas and ${inst.cells_rising} of ${inst.cells} large institutions. A change in which institutions deposit accounts for ${points(inst.composition)} of the ${points(change)} points. DiVA’s records do not give the degree level, and word counts cannot tell whether the wording comes from writing habits, supervision or generated text.`,
        `Ökningen ${after.join(' och ')} ligger i två av markörens ord. Andelen sammanfattningar med ”långsiktig” eller ”på lång sikt” gick från ${v(base, 'using_long_term')} ${y0} till ${v(last, 'using_long_term')} ${y1}, och andelen med ”framtida forskning” och liknande från ${v(base, 'using_research')} till ${v(last, 'using_research')}. Utan de två är andelen ${pct(base[rest])} ${y0} och ${pct(last[rest])} ${y1}, mot ${pct(Math.min(...earlier))}–${pct(Math.max(...earlier))} ${jump.rows[0][0]}–${after[0] - 1}. Ökningen syns i ${area.cells_rising} av ${area.cells} ämnesområden och ${inst.cells_rising} av ${inst.cells} stora lärosäten. Att andra lärosäten lämnar in förklarar ${points(inst.composition)} av ${points(change)} procentenheter. DiVA:s poster anger inte examensnivå, och ordräkning kan inte avgöra om formuleringarna kommer från skrivvanor, handledning eller genererad text.`,
      )}
    </p>
  )
}
