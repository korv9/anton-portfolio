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
import {
  RULES,
  type ContributionBand,
  type Schedule,
  type TaxRules,
} from './rules.ts'

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
  /**
   * Reproduce the withholding tables up to 2019, which rounded municipal tax and the fees to
   * the nearest krona (SKV 433 2018, bilaga 3). Only the tests use it.
   */
  nearestRounding?: boolean
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
  /** Tillfällig skattereduktion för arbetsinkomster, 2021 and 2022. */
  temporaryWorkReduction: number
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
/** Nearest krona, 50 öre going down. */
const roundHalfDown = (value: number) => Math.ceil(value - 0.5 - 1e-7)
const clamp0 = (value: number) => Math.max(0, value)
const roundUp100 = (value: number) => Math.ceil(value / 100) * 100
const roundDown100 = (value: number) => floor(value / 100) * 100
/** Nearest hundred, an amount ending in 50 going down (the pension-fee rule). */
const roundHalfDown100 = (value: number) => {
  const hundreds = value / 100
  const lower = Math.floor(hundreds + 1e-9)
  return (hundreds - lower > 0.5 + 1e-9 ? lower + 1 : lower) * 100
}

/** The value of a piecewise-linear schedule at x (kronor). */
export function evaluate(schedule: Schedule, x: number, pbb: number) {
  const unit = schedule.unit === 'pbb' ? pbb : 1
  const piece =
    schedule.pieces.find((p) => p.to === null || x <= p.to * unit) ??
    schedule.pieces[schedule.pieces.length - 1]
  return piece.base * unit + piece.rate * (x - piece.over * unit)
}

/** Grundavdrag, plus förhöjt grundavdrag at the senior age, for a fastställd förvärvsinkomst. */
export function basicAllowance(ffi: number, rules: TaxRules, senior: boolean) {
  if (ffi <= 0) return 0
  const ordinary = evaluate(rules.basicAllowance, ffi, rules.pbb)
  const raised =
    senior && rules.raisedAllowance
      ? evaluate(rules.raisedAllowance, ffi, rules.pbb)
      : 0
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
  const { young, phaseOut, senior: seniorSchedule } = rules.inWorkCredit
  const ki = municipalRate / 100
  if (senior && rules.inWorkCredit.seniorLessAllowance)
    return clamp0(
      floor((evaluate(seniorSchedule, ai, rules.pbb) - allowance) * ki),
    )
  if (senior) return clamp0(floor(evaluate(seniorSchedule, ai, rules.pbb)))
  let credit = (evaluate(young, ai, rules.pbb) - allowance) * ki
  if (phaseOut && ai > phaseOut.fromPbb * rules.pbb)
    credit -= phaseOut.rate * (ai - phaseOut.fromPbb * rules.pbb)
  return clamp0(floor(credit))
}

/** Skattereduktion för sjuk- och aktivitetsersättning, before it is limited by the tax. */
export function sicknessReduction(
  compensation: number,
  allowance: number,
  municipalRate: number,
  rules: TaxRules,
) {
  const reduction = rules.sicknessReduction
  const ul = roundDown100(compensation)
  if (!reduction || ul <= 0) return 0
  const ki = municipalRate / 100
  const value = evaluate(reduction.schedule, ul, rules.pbb)
  if (reduction.mode === 'share') return floor(value * ki)
  return floor(Math.max((value - allowance) * ki, reduction.minShare * ul * ki))
}

/**
 * Social contributions on an annual amount for someone born in a given year: the bands that
 * apply, for their months and up to their monthly cap, and the standard rate for the rest.
 */
function contributions(
  amount: number,
  birthYear: number,
  standard: number,
  bands: ContributionBand[],
) {
  const monthly = amount / 12
  let months = 0
  let total = 0
  for (const b of bands) {
    if (b.bornFrom !== null && birthYear < b.bornFrom) continue
    if (b.bornTo !== null && birthYear > b.bornTo) continue
    const part = Math.min(monthly, b.monthlyCap ?? Infinity)
    total += b.months * (part * b.rate + (monthly - part) * standard)
    months += b.months
  }
  return total + Math.max(12 - months, 0) * monthly * standard
}

/** The employer contribution rate on the first krona of pay, averaged over the year. */
export function employerRate(birthYear: number, rules: TaxRules) {
  const { standard, bands } = rules.employer
  return contributions(12, birthYear, standard, bands) / 12
}

/** Employer contributions on an annual salary, with the reductions that apply. */
export function employerContributions(
  salary: number,
  birthYear: number,
  rules: TaxRules,
) {
  const { standard, bands } = rules.employer
  return floor(contributions(salary, birthYear, standard, bands))
}

/** The self-employment contribution rate for the year, averaged over its months. */
function selfEmployedRate(birthYear: number, rules: TaxRules) {
  const { standard, bands } = rules.selfEmployed
  return contributions(12, birthYear, standard, bands) / 12
}

/**
 * The tax for the year, without the derived measures (wedge, marginal rate). The rules are
 * the year's own unless others are given, as the comparison of years does (history.ts).
 */
export function computeTax(
  input: TaxInput,
  rules: TaxRules = RULES[input.year],
): Omit<TaxResult, 'marginalRate' | 'taxWedge'> {
  if (!rules) throw new Error(`No tax rules for ${input.year}`)
  // "Fyllt 66 år vid årets ingång": born at least 67 years before the income year. The ages
  // for the higher allowance and the higher in-work credit have not always been the same.
  const isSenior = input.birthYear <= input.year - 1 - rules.seniorAge.allowance
  const isCreditSenior =
    input.birthYear <= input.year - 1 - rules.seniorAge.credit
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

  const stateTax = floor(
    rules.state.brackets.reduce(
      (sum, b) => sum + clamp0(taxable - b.threshold) * b.rate,
      0,
    ),
  )
  // Each rounded down to whole kronor; the tables up to 2019 rounded each to the nearest
  // krona instead, 50 öre going down.
  const round = input.nearestRounding ? roundHalfDown : floor
  const municipalTax = round((taxable * input.municipalRate) / 100)
  const burialFee = round((taxable * input.burialRate) / 100)
  const churchFee = round((taxable * input.churchRate) / 100)
  const ps = rules.publicService
  const publicServiceFee =
    ps && input.birthYear <= input.year - 19
      ? floor(Math.min(taxable, ps.capIbb * rules.ibb) * ps.rate)
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
    isCreditSenior,
  )
  const inWorkTaxCreditUsed = Math.min(credit, municipalLeft)
  municipalLeft -= inWorkTaxCreditUsed
  const sickness = isCreditSenior
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
  const earnedIncomeReductionFull = !eir
    ? 0
    : taxable <= eir.from
      ? 0
      : taxable >= eir.to
        ? eir.max
        : floor((taxable - eir.from) * eir.rate)
  // Against municipal tax only (2022 on), or against what is left of the tax and fees (2021).
  const taxLeft =
    municipalLeft +
    clamp0(stateTax - clamp0(pensionFeeReduction - municipalTax)) +
    burialFee +
    churchFee +
    pensionFee +
    publicServiceFee
  const earnedIncomeReduction = Math.min(
    earnedIncomeReductionFull,
    eir?.against === 'all' ? taxLeft : municipalLeft,
  )
  municipalLeft -= Math.min(earnedIncomeReduction, municipalLeft)

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

  // The temporary reduction for work income (2021-2022) comes after every other reduction and
  // is set against what is left of income tax and the property fee (SFS 2021:930, 6-7 §§).
  const temporary = rules.temporaryWorkReduction
    ? clamp0(
        floor(
          evaluate(
            rules.temporaryWorkReduction,
            input.salary + businessIncome,
            rules.pbb,
          ),
        ),
      )
    : 0
  const temporaryWorkReduction = Math.min(
    temporary,
    clamp0(
      municipalLeft +
        stateLeft +
        capitalTax +
        propertyFee -
        capitalDeficitReduction,
    ),
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
    capitalDeficitReduction -
    temporaryWorkReduction

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
    temporaryWorkReduction,
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
