import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import {
  calculate,
  EMPTY_INPUT,
  type TaxInput,
  type TaxResult,
} from './calculator'
import { LATEST_YEAR, RULES } from './rules'

export type Municipalities = {
  year: number
  municipalities: {
    code: string
    name: string
    local_rate: number
    /** [parish, burial fee %, church fee %] */
    parishes: [string, number, number][]
  }[]
}

const kr = (value: number) => `${Math.round(value).toLocaleString('sv-SE')} kr`
const pct = (value: number, digits = 1) =>
  `${value.toLocaleString('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`

type Field = {
  key: keyof TaxInput
  label: [string, string]
  hint?: [string, string]
  /** Entered per month and stored per year. */
  monthly?: boolean
}

const INCOME: Field[] = [
  {
    key: 'salary',
    label: ['Salary before tax', 'Lön före skatt'],
    monthly: true,
  },
  { key: 'pension', label: ['Pension', 'Pension'], monthly: true },
  {
    key: 'benefits',
    label: ['Other benefits', 'Andra ersättningar'],
    hint: [
      'Unemployment, parental or sickness benefit, per year',
      'A-kassa, föräldrapenning, sjukpenning, per år',
    ],
  },
  {
    key: 'sicknessCompensation',
    label: [
      'Sickness or activity compensation',
      'Sjuk- eller aktivitetsersättning',
    ],
    hint: ['Per year', 'Per år'],
  },
  {
    key: 'businessProfit',
    label: ['Profit, sole proprietorship', 'Överskott, enskild firma'],
    hint: [
      'Before self-employment contributions, per year',
      'Före egenavgifter, per år',
    ],
  },
]
const CAPITAL: Field[] = [
  {
    key: 'interestAndDividends',
    label: ['Interest and dividends', 'Ränta och utdelningar'],
    hint: ['Per year', 'Per år'],
  },
  {
    key: 'capitalGains',
    label: ['Capital gains', 'Kapitalvinster'],
    hint: ['Per year', 'Per år'],
  },
  {
    key: 'capitalLosses',
    label: ['Capital losses', 'Kapitalförluster'],
    hint: ['Per year', 'Per år'],
  },
  {
    key: 'iskCapital',
    label: [
      'ISK and capital insurance, value',
      'ISK och kapitalförsäkring, värde',
    ],
    hint: ['The capital base', 'Kapitalunderlaget'],
  },
  {
    key: 'interestExpenses',
    label: ['Interest paid, e.g. mortgage', 'Betalda räntor, t.ex. bolån'],
    hint: ['Per year', 'Per år'],
  },
  {
    key: 'propertyAssessedValue',
    label: ['Assessed value of your house', 'Taxeringsvärde för villa'],
    hint: ['Småhus; 0 if none', 'Småhus; 0 om ingen'],
  },
]

/** The lines of the result: charges add, reductions subtract. */
function lines(
  r: TaxResult,
): { label: [string, string]; amount: number; kind: 'charge' | 'reduction' }[] {
  const all: {
    label: [string, string]
    amount: number
    kind: 'charge' | 'reduction'
  }[] = [
    {
      label: [
        'Municipal and regional income tax',
        'Kommunal inkomstskatt (kommun och region)',
      ],
      amount: r.municipalTax,
      kind: 'charge',
    },
    {
      label: ['State income tax', 'Statlig inkomstskatt'],
      amount: r.stateTax,
      kind: 'charge',
    },
    {
      label: ['General pension contribution', 'Allmän pensionsavgift'],
      amount: r.pensionFee,
      kind: 'charge',
    },
    {
      label: ['Burial fee', 'Begravningsavgift'],
      amount: r.burialFee,
      kind: 'charge',
    },
    {
      label: ['Church fee', 'Kyrkoavgift'],
      amount: r.churchFee,
      kind: 'charge',
    },
    {
      label: ['Public service fee', 'Public service-avgift'],
      amount: r.publicServiceFee,
      kind: 'charge',
    },
    {
      label: ['Tax on capital income (30 %)', 'Skatt på kapitalinkomst (30 %)'],
      amount: r.capitalTax,
      kind: 'charge',
    },
    {
      label: ['Property fee', 'Kommunal fastighetsavgift'],
      amount: r.propertyFee,
      kind: 'charge',
    },
    {
      label: [
        'Reduction for the pension contribution',
        'Skattereduktion för allmän pensionsavgift',
      ],
      amount: r.pensionFeeReduction,
      kind: 'reduction',
    },
    {
      label: ['In-work tax credit (jobbskatteavdrag)', 'Jobbskatteavdrag'],
      amount: r.inWorkTaxCredit,
      kind: 'reduction',
    },
    {
      label: [
        'Reduction for sickness compensation',
        'Skattereduktion för sjuk- och aktivitetsersättning',
      ],
      amount: r.sicknessCompensationReduction,
      kind: 'reduction',
    },
    {
      label: ['Earned-income reduction', 'Skattereduktion för förvärvsinkomst'],
      amount: r.earnedIncomeReduction,
      kind: 'reduction',
    },
    {
      label: [
        'Capital deficit reduction',
        'Skattereduktion för underskott av kapital',
      ],
      amount: r.capitalDeficitReduction,
      kind: 'reduction',
    },
  ]
  return all.filter((line) => line.amount !== 0)
}

export default function TaxCalculator({
  municipalities,
  onResult,
}: {
  municipalities: Municipalities
  /** The result, so the page can compare it with other countries. */
  onResult?: (result: TaxResult, input: TaxInput) => void
}) {
  const year = LATEST_YEAR
  const defaultMunicipality =
    municipalities.municipalities.find((m) => m.name === 'Stockholm') ??
    municipalities.municipalities[0]
  const [municipality, setMunicipality] = useState(defaultMunicipality.code)
  const current =
    municipalities.municipalities.find((m) => m.code === municipality) ??
    defaultMunicipality
  const [parish, setParish] = useState(0)
  const [churchMember, setChurchMember] = useState(false)
  const [birthYear, setBirthYear] = useState(1990)
  const [values, setValues] = useState<Record<string, number>>({
    salary: 35_000,
  })

  const input: TaxInput = useMemo(() => {
    const [, burial, church] =
      current.parishes[Math.min(parish, current.parishes.length - 1)]
    const annual = (field: Field) =>
      (values[field.key] ?? 0) * (field.monthly ? 12 : 1)
    return {
      ...EMPTY_INPUT,
      year,
      birthYear,
      municipalRate: current.local_rate,
      burialRate: burial,
      churchRate: churchMember ? church : 0,
      ...Object.fromEntries(
        [...INCOME, ...CAPITAL].map((f) => [f.key, annual(f)]),
      ),
      propertyFeeExempt: false,
    }
  }, [current, parish, churchMember, birthYear, values, year])

  const result = useMemo(() => calculate(input), [input])
  useEffect(() => onResult?.(result, input), [result, input, onResult])
  const rules = RULES[year]

  const numberField = (field: Field) => (
    <label key={field.key}>
      {l(...field.label)}
      {field.monthly && <small> {l('per month', 'per månad')}</small>}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={field.monthly ? 500 : 1000}
        value={values[field.key] ?? 0}
        onChange={(event) =>
          setValues((v) => ({
            ...v,
            [field.key]: Math.max(0, Number(event.target.value) || 0),
          }))
        }
        data-field={field.key}
      />
      {field.hint && <small>{l(...field.hint)}</small>}
    </label>
  )

  return (
    <div className="tax-calculator">
      <form className="tax-form" onSubmit={(event) => event.preventDefault()}>
        <fieldset>
          <legend>{l('About you', 'Om dig')}</legend>
          <label>
            {l('Year of birth', 'Födelseår')}
            <input
              type="number"
              min={1920}
              max={year - 15}
              value={birthYear}
              onChange={(event) =>
                setBirthYear(Number(event.target.value) || 1990)
              }
              data-field="birthYear"
            />
          </label>
          <label>
            {l('Municipality', 'Kommun')}
            <select
              value={municipality}
              onChange={(event) => {
                setMunicipality(event.target.value)
                setParish(0)
              }}
              data-field="municipality"
            >
              {municipalities.municipalities.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name} ({pct(m.local_rate, 2)})
                </option>
              ))}
            </select>
          </label>
          {current.parishes.length > 1 && (
            <label>
              {l('Parish', 'Församling')}
              <select
                value={parish}
                onChange={(event) => setParish(Number(event.target.value))}
              >
                {current.parishes.map(([name], index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={churchMember}
              onChange={(event) => setChurchMember(event.target.checked)}
            />
            {l('Member of the Church of Sweden', 'Medlem i Svenska kyrkan')}
          </label>
        </fieldset>
        <fieldset>
          <legend>{l('Income', 'Inkomster')}</legend>
          {INCOME.map(numberField)}
        </fieldset>
        <fieldset>
          <legend>{l('Capital and home', 'Kapital och bostad')}</legend>
          {CAPITAL.map(numberField)}
        </fieldset>
      </form>

      <div className="tax-result" aria-live="polite">
        <dl className="tax-headline">
          <div>
            <dt>{l('Your tax per year', 'Din skatt per år')}</dt>
            <dd data-testid="tax-total">{kr(result.totalTax)}</dd>
          </div>
          <div>
            <dt>{l('Per month', 'Per månad')}</dt>
            <dd>{kr(result.totalTax / 12)}</dd>
          </div>
          <div>
            <dt>{l('Average tax', 'Genomsnittlig skatt')}</dt>
            <dd>{pct(result.averageRate)}</dd>
          </div>
          <div>
            <dt>
              {l(
                'Tax on the next 100 kr of salary',
                'Skatt på nästa hundralapp i lön',
              )}
            </dt>
            <dd>{pct(result.marginalRate, 0)}</dd>
          </div>
          <div>
            <dt>
              {l('Left after tax, per month', 'Kvar efter skatt, per månad')}
            </dt>
            <dd>{kr(result.netIncome / 12)}</dd>
          </div>
        </dl>

        <table className="welfare-table compact tax-lines">
          <caption>
            {l('How it adds up, per year', 'Så räknas det, per år')}
          </caption>
          <tbody>
            {lines(result).map((line) => (
              <tr key={line.label[0]} className={line.kind}>
                <td>{l(...line.label)}</td>
                <td>
                  {line.kind === 'reduction' ? '− ' : ''}
                  {kr(line.amount)}
                </td>
              </tr>
            ))}
            <tr className="total">
              <td>{l('Your tax', 'Din skatt')}</td>
              <td>{kr(result.totalTax)}</td>
            </tr>
          </tbody>
        </table>

        {input.salary > 0 && (
          <div className="tax-employer">
            <h3>
              {l(
                'What your employer pays on top',
                'Vad arbetsgivaren betalar ovanpå',
              )}
            </h3>
            <p>
              {l('Employer contributions', 'Arbetsgivaravgifter')}{' '}
              <strong data-testid="employer-contributions">
                {kr(result.employerContributions)}
              </strong>{' '}
              {l('per year, so the job costs', 'per år, så jobbet kostar')}{' '}
              <strong>{kr(result.labourCost)}</strong>.{' '}
              {l(
                'Tax and contributions together take',
                'Skatt och avgifter tar tillsammans',
              )}{' '}
              <strong data-testid="tax-wedge">{pct(result.taxWedge)}</strong>{' '}
              {l(
                'of that: the "tax wedge" the OECD compares across countries.',
                'av det: den ”skattekil” som OECD jämför mellan länder.',
              )}
            </p>
          </div>
        )}
        {result.selfEmploymentContributions > 0 && (
          <p className="welfare-note">
            {l('Self-employment contributions', 'Egenavgifter')}:{' '}
            <strong>{kr(result.selfEmploymentContributions)}</strong>{' '}
            {l(
              `(${pct(rules.selfEmployed.standard * 100, 2)} of the profit after the deduction for them).`,
              `(${pct(rules.selfEmployed.standard * 100, 2)} av överskottet efter avdraget för dem).`,
            )}
          </p>
        )}
        <p className="welfare-note">
          {l(
            'Not included: VAT, which you pay when you shop (25 %, 12 % on restaurants and some repairs, 6 % on books, newspapers and passenger transport), and excise duties on fuel, alcohol and tobacco. Also left out: deductions (travel to work, double housing), the cap on the property fee for pensioners, foreign income, and benefits that are not taxed, such as child benefit.',
            'Ingår inte: moms, som du betalar när du handlar (25 %, 12 % på restaurang och vissa reparationer, 6 % på böcker, tidningar och persontransporter), och punktskatter på bränsle, alkohol och tobak. Utelämnat är också avdrag (resor till arbetet, dubbel bosättning), begränsningen av fastighetsavgiften för pensionärer, utländska inkomster och skattefria ersättningar som barnbidrag.',
          )}
        </p>
        <p className="welfare-note">
          {l(
            `Skatteverket’s rules for ${year}, ${municipalities.year} rates. Tested against every row of Skatteverket’s ${year} tax tables: the same tax to the krona.`,
            `Skatteverkets regler för ${year}, skattesatser för ${municipalities.year}. Testad mot varje rad i Skatteverkets skattetabeller för ${year}: samma skatt på kronan.`,
          )}{' '}
          {rules.sources.map((source, index) => (
            <span key={source.url}>
              {index > 0 && ' · '}
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
