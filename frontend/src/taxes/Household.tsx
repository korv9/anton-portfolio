import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import type { Decisions } from './Decisions'

type HouseholdGroup = {
  group: string
  name: [string, string]
  vat_rate: number
  spending: number
  vat: number
  note: string | null
}
type HouseholdData = {
  year: number
  households: {
    key: string
    name: [string, string]
    groups: HouseholdGroup[]
  }[]
  method: string
  source: string
}

const kr = (value: number) => `${Math.round(value).toLocaleString('sv-SE')} kr`
/** Fuel tax changes are stated without VAT; at the pump VAT adds 25 % on top. */
const PUMP_VAT = 1.25
/** Food VAT from 1 April 2026: 6 % instead of 12 %, for nine months of the year. */
const FOOD_GROUPS = ['212', '215']

/**
 * The taxes paid through what you buy: an estimate of the VAT a household pays from SCB's
 * household budget survey, the 2026 cut in food VAT, and what the fuel tax decisions meant
 * for the litres you enter.
 */
export default function Household({ decisions }: { decisions: Decisions }) {
  const [data, setData] = useState<HouseholdData | null>(null)
  const [household, setHousehold] = useState('E90')
  const [petrol, setPetrol] = useState(0)
  const [diesel, setDiesel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<HouseholdData>('taxes/household.json')
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const chosen = data?.households.find((h) => h.key === household)
  const vat = chosen?.groups.reduce((sum, g) => sum + g.vat, 0) ?? 0
  const food = (chosen?.groups ?? [])
    .filter((g) => FOOD_GROUPS.includes(g.group))
    .reduce((sum, g) => sum + g.spending, 0)
  // Prices include VAT: at 12 % the VAT is 12/112 of the price, at 6 % 6/106.
  const foodCut = food * (12 / 112 - 6 / 112) * (9 / 12)

  const fuel = useMemo(
    () =>
      decisions.decisions
        .filter(
          (d) =>
            d.components.includes('fuel') && d.petrol_sek_per_litre != null,
        )
        .map((d) => {
          const share = (d.months ?? 12) / 12
          const change =
            (petrol * (d.petrol_sek_per_litre ?? 0) +
              diesel * (d.diesel_sek_per_litre ?? 0)) *
            share *
            PUMP_VAT
          return { d, change }
        }),
    [decisions, petrol, diesel],
  )

  if (error) return <p role="alert">{error}</p>
  if (!data || !chosen) return null
  return (
    <div className="household-taxes" data-testid="household-taxes">
      <div className="slicers">
        <label className="wide">
          {l('Household', 'Hushåll')}
          <select
            value={household}
            onChange={(e) => setHousehold(e.target.value)}
            data-field="household-type"
          >
            {data.households.map((h) => (
              <option key={h.key} value={h.key}>
                {l(...h.name)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="lead-figure">
        {l(
          `A household like this pays at least ${kr(vat)} a year in VAT on what it buys.`,
          `Ett hushåll som detta betalar minst ${kr(vat)} om året i moms på det det köper.`,
        )}
      </p>
      <table className="welfare-table" data-testid="household-vat">
        <thead>
          <tr>
            <th>{l('Spending', 'Utgift')}</th>
            <th>{l('Per year', 'Per år')}</th>
            <th>{l('VAT rate', 'Moms')}</th>
            <th>{l('VAT in it', 'Varav moms')}</th>
          </tr>
        </thead>
        <tbody>
          {[...chosen.groups]
            .sort((a, b) => b.vat - a.vat)
            .map((g) => (
              <tr key={g.group}>
                <td>
                  {l(...g.name)}
                  {g.note && (
                    <span className="muted">{l('', ` – ${g.note}`)}</span>
                  )}
                </td>
                <td>{kr(g.spending)}</td>
                <td>{g.vat_rate} %</td>
                <td>{kr(g.vat)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <p>
        {l(
          `The halved VAT on food from 1 April 2026 is worth about ${kr(foodCut)} to this household in 2026, if shops pass it on in full.`,
          `Den halverade matmomsen från 1 april 2026 är värd ungefär ${kr(foodCut)} för hushållet under 2026, om butikerna sänker priserna fullt ut.`,
        )}
      </p>

      <h3 className="analysis-subhead">
        {l('Petrol and diesel', 'Bensin och diesel')}
      </h3>
      <div className="slicers">
        <label>
          {l('Petrol, litres a year', 'Bensin, liter per år')}
          <input
            type="number"
            min={0}
            step={50}
            value={petrol || ''}
            placeholder="0"
            onChange={(e) => setPetrol(Math.max(0, Number(e.target.value)))}
            data-field="petrol-litres"
          />
        </label>
        <label>
          {l('Diesel, litres a year', 'Diesel, liter per år')}
          <input
            type="number"
            min={0}
            step={50}
            value={diesel || ''}
            placeholder="0"
            onChange={(e) => setDiesel(Math.max(0, Number(e.target.value)))}
            data-field="diesel-litres"
          />
        </label>
      </div>
      {petrol + diesel > 0 ? (
        <table className="welfare-table" data-testid="fuel-effects">
          <thead>
            <tr>
              <th>{l('From', 'Från')}</th>
              <th>{l('Decision', 'Beslut')}</th>
              <th>{l('For you that year', 'För dig det året')}</th>
            </tr>
          </thead>
          <tbody>
            {fuel.map(({ d, change }) => (
              <tr key={d.key}>
                <td>{d.in_force}</td>
                <td>
                  {l(d.title_en, d.title_sv)} ({l('bill', 'prop.')} {d.bill})
                </td>
                <td className="lower">{kr(change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">
          {l(
            'Enter how many litres you fill a year to see what each fuel tax decision meant for you.',
            'Fyll i hur många liter du tankar per år för att se vad varje beslut om bränsleskatt betydde för dig.',
          )}
        </p>
      )}
      <p className="welfare-note">
        {l(
          `${data.method} Spending from ${data.source}, in ${data.year} prices. Fuel: each bill's change in tax per litre, for the months it applied, with VAT, as a change from the tax that would otherwise have applied that year.`,
          `Utgifter från ${data.source}, i ${data.year} års priser; momsen i en utgift är utgiften × sats / (100 + sats). Bara utgiftsgrupper med en tydlig momssats räknas; hyra, vård, försäkringar, räntor och avgifter har ingen eller blandad moms, så uppskattningen är ett golv. Drivmedel: varje propositions ändring av skatten per liter, för de månader den gällde, med moms, jämfört med den skatt som annars hade gällt det året.`,
        )}
      </p>
    </div>
  )
}
