import { currentLocale, l } from '../i18n'
import { PARTIES, partyStats, type Decision } from './data'
import { committeeLabel } from './committees'

type Measure = { rows: number; no: number }
const share = (value: Measure) => value.rows ? value.no / value.rows * 100 : 0
const percent = (value: Measure) => value.rows
  ? `${share(value).toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB', { maximumFractionDigits: 0 })}%`
  : '—'

export default function CommitteeComparison({ selected, all, committee, onParty }: {
  selected: Decision[]
  all: Decision[]
  committee: string
  onParty: (party: string) => void
}) {
  const other = all.filter(decision => decision.committee !== committee)
  const rows = PARTIES.map(party => ({
    party,
    selected: partyStats(selected, party),
    other: partyStats(other, party),
  })).sort((a, b) => share(b.selected) - share(a.selected) || a.party.localeCompare(b.party))

  return <section className="politics-card committee-comparison" aria-labelledby="committee-comparison-title">
    <p className="eyebrow">{l('Selected committee / rest of the session', 'Valt utskott / resten av riksmötet')}</p>
    <h4 id="committee-comparison-title">{committeeLabel(committee)}</h4>
    <p>{l('How often did each party vote No to this committee’s proposal, compared with proposals from all other committees in the same session? Parties are sorted by their No share in the selected committee.', 'Hur ofta röstade varje parti Nej till detta utskotts förslag jämfört med förslag från övriga utskott under samma riksmöte? Partierna sorteras efter andelen Nej i det valda utskottet.')}</p>
    <p className="committee-comparison-count">{selected.length} {l('roll calls here', 'voteringar här')} · {other.length} {l('in other committees', 'i övriga utskott')}</p>
    <div className="committee-comparison-key"><span><i className="selected" />{l('Selected committee', 'Valt utskott')}</span><span><i className="other" />{l('Other committees', 'Övriga utskott')}</span></div>
    <div className="committee-comparison-rows">
      {rows.map(row => <button key={row.party} className="committee-comparison-row" onClick={() => onParty(row.party)} aria-label={l(`${row.party}: ${row.selected.no} of ${row.selected.rows} No votes in ${committeeLabel(committee)}; ${row.other.no} of ${row.other.rows} in other committees`, `${row.party}: ${row.selected.no} av ${row.selected.rows} Nej i ${committeeLabel(committee)}; ${row.other.no} av ${row.other.rows} i övriga utskott`)}>
        <b>{row.party}</b>
        <span className="committee-pair">
          <span className="committee-track"><i className="selected" style={{ width: `${share(row.selected)}%` }} /></span>
          <span className="committee-track"><i className="other" style={{ width: `${share(row.other)}%` }} /></span>
        </span>
        <span className="committee-pair-values"><strong>{percent(row.selected)} <small>({row.selected.no}/{row.selected.rows})</small></strong><span>{percent(row.other)} <small>({row.other.no}/{row.other.rows})</small></span></span>
      </button>)}
    </div>
    <p className="evidence-note">{l('The denominator is imported roll calls in each group, including abstentions. A No refers to the committee proposal, which may itself reject a motion. This comparison does not show why a party voted No or measure its support for an issue.', 'Nämnaren är importerade voteringar i respektive grupp, inklusive nedlagda röster. Nej gäller utskottets förslag, som i sig kan avstyrka en motion. Jämförelsen visar inte varför ett parti röstade Nej eller dess stöd för en sakfråga.')}</p>
  </section>
}
