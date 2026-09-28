/**
 * Swedish personal tax for one income year, following Skatteverket's rules (see rules.ts).
 *
 * One implementation, used by the site and tested against Skatteverket's own withholding
 * tables (frontend/tests/unit/tax-calculator.test.ts). It computes the final annual tax on
 * the incomes given, not the monthly withholding, and it states what it leaves out.
 *
 * Order, as in the tables and the income tax act: taxable earned income is earned income
 * less the basic allowance; state and municipal tax, burial and church fees are charged on
 * it; the pension-fee reduction, the in-work tax credit, the reduction for sickness and
 * activity compensation and the earned-income reduction are set off against municipal tax;
 * capital income is taxed at 30 %, and a capital deficit reduces the remaining tax.
 */
import { RULES, type TaxRules } from './rules.ts'

export type TaxInput = {
  year: number
  /** Year of birth: decides the higher allowance at 66, the pension fee and employer rates. */
  birthYear: number
  /** Annual amounts in kronor. */
  salary: number
  pension: number
  /** Other pension-qualifying benefits: unemployment benefit, parental benefit, sickness benefit. */
  benefits: number
  /** Sjuk- och aktivitetsersättning. */
  sicknessCompensation: number
  /** Profit of a sole proprietorship before self-employment contributions. */
  businessProfit: number
  /** Kommunal + regional tax rate, burial fee and church fee, in per cent. */
  municipalRate: number
  burialRate: number
  churchRate: number
  interestAndDividends: number
  capitalGains: number
  capitalLosses: number
  /** Capital base of investment savings accounts (ISK) and capital insurance. */
  iskCapital: number
  interestExpenses: number
  /** Assessed value (taxeringsvärde) of a small house; 0 for none. */
  propertyAssessedValue: number
  /** Houses built 2012 or later pay no property fee for their first 15 years. */
  propertyFeeExempt: boolean
}

export type TaxLine = { key: string; amount: number }

export type TaxResult = {
  rules: TaxRules
  isSenior: boolean
  earnedIncome: number
  basicAllowance: number
  taxableEarnedIncome: number
  /** Charges, positive. */
  municipalTax: number
  stateTax: number
  burialFee: number
  churchFee: number
  pensionFee: number
  publicServiceFee: number
  capitalTax: number
  propertyFee: number
  /** Reductions, positive amounts that are subtracted. */
  pensionFeeReduction: number
  inWorkTaxCredit: number
  sicknessCompensationReduction: number
  earnedIncomeReduction: number
  capitalDeficitReduction: number
  /** The tax the person pays for the year. */
  totalTax: number
  /** Everything received, less the tax: salary, pensions, benefits, business, capital. */
  netIncome: number
  /** Share of the person's gross income paid in tax, per cent. */
  averageRate: number
  /** Tax on the next 100 kr of salary, per cent. */
  marginalRate: number
  /** What an employer pays on the salary, on top of it. */
  employerContributions: number
  selfEmploymentContributions: number
  /** Salary plus employer contributions: what the job costs the employer. */
  labourCost: number
  /** Tax and contributions together as a share of labour cost (the OECD "tax wedge"), per cent. */
  taxWedge: number
}

export const EMPTY_INPUT: Omit<TaxInput, 'year' | 'birthYear'> = {
  salary: 0,
  pension: 0,
  benefits: 0,
  sicknessCompensation: 0,
  businessProfit: 0,
  municipalRate: 32.41,
  burialRate: 0.293,
  churchRate: 0,
  interestAndDividends: 0,
  capitalGains: 0,
  capitalLosses: 0,
  iskCapital: 0,
  interestExpenses: 0,
  propertyAssessedValue: 0,
  propertyFeeExempt: false,
}

/**
 * Whole kronor, dropping öre. The epsilon keeps binary floating point from turning an exact
 * product (200 000 x 1,16 % = 2 320) into 2 319,999... and losing a krona.
 */
const floor = (value: number) => Math.floor(value + 1e-7)
const clamp0 = (value: number) => Math.max(0, value)
const roundUp100 = (value: number) => Math.ceil(value / 100) * 100
const roundDown100 = (value: number) => floor(value / 100) * 100
/** Nearest hundred, an amount ending in 50 going down (the pension-fee rule). */
const roundHalfDown100 = (value: number) => {
  const hundreds = value / 100
  const lower = Math.floor(hundreds + 1e-9)
  return (hundreds - lower > 0.5 + 1e-9 ? lower + 1 : lower) * 100
}

/** Grundavdrag, plus förhöjt grundavdrag at 66, for a fastställd förvärvsinkomst (FFI). */
export function basicAllowance(ffi: number, rules: TaxRules, senior: boolean) {
  if (ffi <= 0) return 0
  const p = rules.pbb
  let ordinary: number
  if (ffi <= 0.99 * p) ordinary = 0.423 * p
  else if (ffi <= 2.72 * p) ordinary = 0.423 * p + 0.2 * (ffi - 0.99 * p)
  else if (ffi <= 3.11 * p) ordinary = 0.77 * p
  else if (ffi <= 7.88 * p) ordinary = 0.77 * p - 0.1 * (ffi - 3.11 * p)
  else ordinary = 0.293 * p

  let raised = 0
  if (senior) {
    if (ffi <= 0.91 * p) raised = 0.687 * p
    else if (ffi <= 1.11 * p) raised = 0.885 * p - 0.2 * ffi
    else if (ffi <= 1.965 * p) raised = 0.6 * p + 0.057 * ffi
    else if (ffi <= 2.72 * p) raised = 0.333 * p + 0.1949 * ffi
    else if (ffi <= 3.11 * p) raised = 0.3949 * ffi - 0.212 * p
    else if (ffi <= 3.24 * p) raised = 0.4949 * ffi - 0.523 * p
    else if (ffi <= 5.0 * p) raised = 0.356 * ffi - 0.073 * p
    else if (ffi <= 7.88 * p) raised = 0.017 * p + 0.338 * ffi
    else if (ffi <= 8.08 * p) raised = 0.703 * p + 0.251 * ffi
    else if (ffi <= 11.16 * p) raised = 2.732 * p
    else if (ffi <= 12.84 * p) raised = 9.651 * p - 0.62 * ffi
    else raised = 1.691 * p
  }
  return Math.min(roundUp100(ordinary + raised), ffi)
}

/** Skattereduktion för arbetsinkomst (jobbskatteavdrag), before it is limited by the tax. */
export function inWorkTaxCredit(
  workIncome: number,
  allowance: number,
  municipalRate: number,
  rules: TaxRules,
  senior: boolean,
) {
  const ai = roundDown100(workIncome)
  if (ai <= 0) return 0
  const p = rules.pbb
  if (senior) {
    if (ai <= 1.75 * p) return floor(0.22 * ai)
    if (ai <= 5.24 * p) return floor(0.2635 * p + 0.07 * ai)
    return floor(0.6293 * p)
  }
  const ki = municipalRate / 100
  let base: number
  if (ai <= 0.91 * p) base = ai
  else if (ai <= 3.24 * p) base = 0.91 * p + 0.3874 * (ai - 0.91 * p)
  else if (ai <= 8.08 * p) base = 1.813 * p + 0.251 * (ai - 3.24 * p)
  else base = 3.027 * p
  return clamp0(floor((base - allowance) * ki))
}

/** Skattereduktion för sjuk- och aktivitetsersättning, before it is limited by the tax. */
export function sicknessReduction(
  compensation: number,
  allowance: number,
  municipalRate: number,
  rules: TaxRules,
) {
  const ul = roundDown100(compensation)
  if (ul <= 0) return 0
  const p = rules.pbb
  const ki = municipalRate / 100
  let base: number
  if (ul <= 0.91 * p) base = ul
  else if (ul <= 3.24 * p) base = 0.91 * p + 0.3874 * (ul - 0.91 * p)
  else base = 1.813 * p + 0.251 * (ul - 3.24 * p)
  return floor(Math.max((base - allowance) * ki, 0.045 * ul * ki))
}

export function employerRate(birthYear: number, rules: TaxRules) {
  const { reduced, standard } = rules.employer
  if (birthYear < reduced.bornFrom) return 0
  if (birthYear <= reduced.bornTo) return reduced.rate
  return standard
}

/** Employer contributions on an annual salary, with the youth reduction where it applies. */
export function employerContributions(
  salary: number,
  birthYear: number,
  rules: TaxRules,
) {
  const rate = employerRate(birthYear, rules)
  const youth = rules.employer.youth
  if (
    !youth ||
    birthYear < youth.bornFrom ||
    birthYear > youth.bornTo ||
    rate !== rules.employer.standard
  )
    return floor(salary * rate)
  const monthly = salary / 12
  const reducedPart = Math.min(monthly, youth.monthlyCap)
  const youthMonths = youth.months
  const fullMonths = 12 - youthMonths
  return floor(
    fullMonths * monthly * rate +
      youthMonths * (reducedPart * youth.rate + (monthly - reducedPart) * rate),
  )
}

function selfEmployedRate(birthYear: number, rules: TaxRules) {
  const { reduced, standard } = rules.selfEmployed
  if (birthYear < reduced.bornFrom) return 0
  if (birthYear <= reduced.bornTo) return reduced.rate
  return standard
}

/** The tax for the year, without the derived measures (wedge, marginal rate). */
function computeTax(
  input: TaxInput,
): Omit<TaxResult, 'marginalRate' | 'taxWedge'> {
  const rules = RULES[input.year]
  if (!rules) throw new Error(`No tax rules for ${input.year}`)
  // "Fyllt 66 år vid årets ingång": born at least 67 years before the income year.
  const isSenior = input.birthYear <= input.year - 67
  const bornBefore1938 = input.birthYear < 1938

  // Business profit carries the contributions it pays for: the base U solves U = P - r U.
  const seRate = selfEmployedRate(input.birthYear, rules)
  const businessIncome =
    input.businessProfit > 0 ? input.businessProfit / (1 + seRate) : 0
  const selfEmploymentContributions = floor(businessIncome * seRate)

  const earnedIncome = roundDown100(
    input.salary +
      input.pension +
      input.benefits +
      input.sicknessCompensation +
      businessIncome,
  )
  const allowance = basicAllowance(earnedIncome, rules, isSenior)
  const taxable = clamp0(earnedIncome - allowance)

  const excess = taxable - rules.state.threshold
  const stateTax =
    excess >= rules.state.minExcess ? floor(excess * rules.state.rate) : 0
  const municipalTax = floor((taxable * input.municipalRate) / 100)
  const burialFee = floor((taxable * input.burialRate) / 100)
  const churchFee = floor((taxable * input.churchRate) / 100)
  const publicServiceFee =
    input.birthYear <= input.year - 19
      ? floor(
          Math.min(taxable, rules.publicService.capIbb * rules.ibb) *
            rules.publicService.rate,
        )
      : 0

  // Allmän pensionsavgift: on pension-qualifying income, not on pensions or sickness compensation.
  const pensionQualifying = input.salary + input.benefits + businessIncome
  const pensionFee =
    bornBefore1938 || pensionQualifying < rules.pensionFee.floorPbb * rules.pbb
      ? 0
      : roundHalfDown100(
          Math.min(pensionQualifying, rules.pensionFee.ceilingIbb * rules.ibb) *
            rules.pensionFee.rate,
        )

  // Reductions, in the order of the tables; each is limited by the tax left to set it against.
  const pensionFeeReduction = Math.min(pensionFee, stateTax + municipalTax)
  let municipalLeft = municipalTax - Math.min(pensionFeeReduction, municipalTax)
  const credit = inWorkTaxCredit(
    input.salary + businessIncome,
    allowance,
    input.municipalRate,
    rules,
    isSenior,
  )
  const inWorkTaxCreditUsed = Math.min(credit, municipalLeft)
  municipalLeft -= inWorkTaxCreditUsed
  const sickness = isSenior
    ? 0
    : sicknessReduction(
        input.sicknessCompensation,
        allowance,
        input.municipalRate,
        rules,
      )
  const sicknessUsed = Math.min(sickness, municipalLeft)
  municipalLeft -= sicknessUsed
  const eir = rules.earnedIncomeReduction
  const earnedIncomeReductionFull =
    taxable <= eir.from
      ? 0
      : taxable >= eir.to
        ? eir.max
        : floor((taxable - eir.from) * eir.rate)
  const earnedIncomeReduction = Math.min(
    earnedIncomeReductionFull,
    municipalLeft,
  )
  municipalLeft -= earnedIncomeReduction

  // Capital: 30 % on a surplus; a deficit reduces the tax that remains.
  const gainsNet = input.capitalGains - input.capitalLosses
  const iskIncome = floor(
    clamp0(input.iskCapital - rules.isk.taxFree) * rules.isk.deemedRate,
  )
  const capitalIncome =
    input.interestAndDividends + Math.max(gainsNet, 0) + iskIncome
  const capitalCosts =
    input.interestExpenses +
    (gainsNet < 0 ? -gainsNet * rules.capital.lossDeductibleShare : 0)
  const capitalSurplus = capitalIncome - capitalCosts
  const capitalTax =
    capitalSurplus > 0 ? floor(capitalSurplus * rules.capital.rate) : 0
  const deficit = capitalSurplus < 0 ? -capitalSurplus : 0
  const deficitReductionFull = floor(
    Math.min(deficit, rules.capital.deficitLimit) * rules.capital.deficitRate +
      clamp0(deficit - rules.capital.deficitLimit) *
        rules.capital.deficitRateAbove,
  )

  const propertyFee =
    input.propertyAssessedValue > 0 && !input.propertyFeeExempt
      ? floor(
          Math.min(
            rules.propertyFee.cap,
            input.propertyAssessedValue * rules.propertyFee.rate,
          ),
        )
      : 0

  // The deficit reduction is set against income taxes and the property fee, not the fees for
  // pension, burial, church or public service.
  const stateLeft =
    stateTax -
    (pensionFeeReduction - Math.min(pensionFeeReduction, municipalTax))
  const capitalDeficitReduction = Math.min(
    deficitReductionFull,
    municipalLeft + stateLeft + capitalTax + propertyFee,
  )

  const totalTax =
    municipalTax +
    stateTax +
    burialFee +
    churchFee +
    pensionFee +
    publicServiceFee +
    capitalTax +
    propertyFee -
    pensionFeeReduction -
    inWorkTaxCreditUsed -
    sicknessUsed -
    earnedIncomeReduction -
    capitalDeficitReduction

  const gross =
    input.salary +
    input.pension +
    input.benefits +
    input.sicknessCompensation +
    input.businessProfit +
    input.interestAndDividends +
    gainsNet
  const employer = employerContributions(input.salary, input.birthYear, rules)
  const labourCost = input.salary + employer

  return {
    rules,
    isSenior,
    earnedIncome,
    basicAllowance: allowance,
    taxableEarnedIncome: taxable,
    municipalTax,
    stateTax,
    burialFee,
    churchFee,
    pensionFee,
    publicServiceFee,
    capitalTax,
    propertyFee,
    pensionFeeReduction,
    inWorkTaxCredit: inWorkTaxCreditUsed,
    sicknessCompensationReduction: sicknessUsed,
    earnedIncomeReduction,
    capitalDeficitReduction,
    totalTax,
    netIncome: gross - totalTax - selfEmploymentContributions,
    averageRate: gross > 0 ? (100 * totalTax) / gross : 0,
    employerContributions: employer,
    selfEmploymentContributions,
    labourCost,
  }
}

/**
 * The full result. The marginal rate is the tax on the next 100 kr of salary. The tax wedge
 * is the tax on the salary alone plus employer contributions, as a share of labour cost,
 * which is how the OECD measures it, so the Swedish figure compares with other countries.
 */
export function calculate(input: TaxInput): TaxResult {
  const result = computeTax(input)
  const next = computeTax({ ...input, salary: input.salary + 100 })
  const salaryOnly =
    input.salary > 0
      ? computeTax({
          ...EMPTY_INPUT,
          year: input.year,
          birthYear: input.birthYear,
          municipalRate: input.municipalRate,
          burialRate: input.burialRate,
          churchRate: input.churchRate,
          salary: input.salary,
        }).totalTax
      : 0
  return {
    ...result,
    marginalRate: next.totalTax - result.totalTax,
    taxWedge:
      result.labourCost > 0
        ? (100 * (result.employerContributions + salaryOnly)) /
          result.labourCost
        : 0,
  }
}
