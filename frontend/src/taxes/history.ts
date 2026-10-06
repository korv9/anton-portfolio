/**
 * How the tax decisions of each year changed one person's tax.
 *
 * The person is the same every year: the same age, and the same real income, moved with the
 * price base amount (prisbasbelopp). Each year's tax is worked out with that year's rules.
 * A year's change is then split by the part of the rules that changed: the tax with this
 * year's rules, less the tax with this year's rules but that one part as it was the year
 * before. Amounts in kronor are moved the way the law moves them when nothing is decided:
 * the state tax threshold with prices plus two percentage points (inkomstskattelagen 65 kap.
 * 5 §), other amounts with prices, so a part counts as changed only when a decision moved
 * it otherwise. What the parts leave is shown as the rest.
 */
import { computeTax, type TaxInput } from './calculator.ts'
import { RULES, type Schedule, type TaxRules } from './rules.ts'

export const YEARS = Object.keys(RULES)
  .map(Number)
  .sort((a, b) => a - b)

/** The parts of the rules a decision can change, as the decision catalogue names them. */
export const PARTS = {
  in_work_credit: 'inWorkCredit',
  raised_allowance: 'raisedAllowance',
  state_tax: 'state',
  public_service: 'publicService',
  sickness_reduction: 'sicknessReduction',
  earned_income_reduction: 'earnedIncomeReduction',
  temporary_work_reduction: 'temporaryWorkReduction',
  senior_age: 'seniorAge',
  isk: 'isk',
} as const satisfies Record<string, keyof TaxRules>
export type Part = keyof typeof PARTS

const MONEY_FIELDS = [
  'salary',
  'pension',
  'benefits',
  'sicknessCompensation',
  'businessProfit',
  'interestAndDividends',
  'capitalGains',
  'capitalLosses',
  'iskCapital',
  'interestExpenses',
  'propertyAssessedValue',
] as const

/** The same person in another year: the same age, the same real income. */
export function inYear(input: TaxInput, year: number): TaxInput {
  const factor = RULES[year].pbb / RULES[input.year].pbb
  const moved = {
    ...input,
    year,
    birthYear: input.birthYear + year - input.year,
  }
  for (const field of MONEY_FIELDS) moved[field] = input[field] * factor
  return moved
}

const scaleSchedule = (schedule: Schedule, factor: number): Schedule =>
  schedule.unit === 'pbb'
    ? schedule
    : {
        unit: 'kr',
        pieces: schedule.pieces.map((p) => ({
          to: p.to === null ? null : p.to * factor,
          base: p.base * factor,
          rate: p.rate,
          over: p.over * factor,
        })),
      }

/**
 * Last year's rules as they would stand this year without a decision: amounts in kronor moved
 * with prices (the ratio of price base amounts), the state tax threshold with prices plus two
 * percentage points, and this year's price and income base amounts.
 */
export function indexRules(rules: TaxRules, next: TaxRules): TaxRules {
  const factor = next.pbb / rules.pbb
  return {
    ...rules,
    year: next.year,
    pbb: next.pbb,
    ibb: next.ibb,
    state: {
      brackets: rules.state.brackets.map((b) => ({
        ...b,
        threshold: b.threshold * (factor + 0.02),
      })),
    },
    inWorkCredit: {
      ...rules.inWorkCredit,
      young: scaleSchedule(rules.inWorkCredit.young, factor),
      senior: scaleSchedule(rules.inWorkCredit.senior, factor),
    },
    earnedIncomeReduction: rules.earnedIncomeReduction && {
      ...rules.earnedIncomeReduction,
      from: rules.earnedIncomeReduction.from * factor,
      to: rules.earnedIncomeReduction.to * factor,
      max: rules.earnedIncomeReduction.max * factor,
    },
    temporaryWorkReduction:
      rules.temporaryWorkReduction &&
      scaleSchedule(rules.temporaryWorkReduction, factor),
    isk: { ...rules.isk, taxFree: rules.isk.taxFree * factor },
  }
}

export type YearTax = {
  year: number
  /** Income and tax in the year's own kronor. */
  income: number
  tax: number
  /** The tax in the base year's kronor, moved with the price base amount. */
  taxToday: number
  averageRate: number
}

export type YearChange = {
  year: number
  /** The change from the year before, in the base year's kronor: + is more tax. */
  total: number
  parts: { part: Part; change: number }[]
  rest: number
}

const gross = (i: TaxInput) =>
  i.salary +
  i.pension +
  i.benefits +
  i.sicknessCompensation +
  i.businessProfit +
  i.interestAndDividends +
  i.capitalGains -
  i.capitalLosses

/** The person's tax under every year's rules. */
export function taxByYear(input: TaxInput): YearTax[] {
  return YEARS.map((year) => {
    const moved = inYear(input, year)
    const tax = computeTax(moved).totalTax
    const factor = RULES[year].pbb / RULES[input.year].pbb
    const income = gross(moved)
    return {
      year,
      income,
      tax,
      taxToday: tax / factor,
      averageRate: income > 0 ? (100 * tax) / income : 0,
    }
  })
}

/** Each year's change in the person's tax, split by the part of the rules that changed. */
export function changesByYear(input: TaxInput): YearChange[] {
  return YEARS.slice(1).map((year) => {
    const previous = year - 1
    const moved = inYear(input, year)
    const toToday = RULES[input.year].pbb / RULES[year].pbb
    const rules = RULES[year]
    const before = indexRules(RULES[previous], rules)
    const now = computeTax(moved, rules).totalTax
    const then = computeTax(moved, before).totalTax
    const parts = (Object.keys(PARTS) as Part[])
      .map((part) => {
        const key = PARTS[part]
        const swapped = { ...rules, [key]: before[key] } as TaxRules
        return {
          part,
          change: (now - computeTax(moved, swapped).totalTax) * toToday,
        }
      })
      .filter((p) => Math.abs(p.change) >= 1)
    const total = (now - then) * toToday
    return {
      year,
      total,
      parts,
      rest: total - parts.reduce((sum, p) => sum + p.change, 0),
    }
  })
}
