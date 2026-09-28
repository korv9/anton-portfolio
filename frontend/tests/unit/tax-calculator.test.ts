import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  calculate,
  employerContributions,
  EMPTY_INPUT,
  type TaxInput,
} from '../../src/taxes/calculator.ts'
import { RULES } from '../../src/taxes/rules.ts'

const fixture = JSON.parse(
  readFileSync(
    new URL('../fixtures/skattetabeller-2026.json', import.meta.url),
    'utf8',
  ),
) as { rows: (number | null)[][] }

/** What each column of the tables covers: the income, and a birth year of that kind. */
const COLUMNS: Record<number, [keyof TaxInput, number]> = {
  1: ['salary', 1990], // pay, under 66
  2: ['pension', 1950], // pension, 66 or over
  3: ['salary', 1955], // pay, 66 or over
  4: ['sicknessCompensation', 1990], // sickness and activity compensation, under 66
  5: ['benefits', 1990], // other pension-qualifying benefits, under 66
  6: ['pension', 1965], // pension, under 66
}

test('matches every row and column of Skatteverket’s 2026 monthly withholding tables', () => {
  let checked = 0
  const misses: string[] = []
  for (const [table, , to, ...columns] of fixture.rows as number[][]) {
    if (to == null) continue
    // As SKV 433 section 7.1: the top of the band times 12, rounded down to whole hundreds.
    const annual = Math.floor((to * 12) / 100) * 100
    for (let column = 1; column <= 6; column++) {
      const expected = columns[column - 1]
      if (expected == null) continue
      const [field, birthYear] = COLUMNS[column]
      const result = calculate({
        ...EMPTY_INPUT,
        year: 2026,
        birthYear,
        // The tables' rate includes 1.16 points for burial and church fees.
        municipalRate: table - 1.16,
        burialRate: 1.16,
        churchRate: 0,
        [field]: annual,
      })
      const monthly = Math.floor(result.totalTax / 12)
      checked++
      if (monthly !== expected)
        misses.push(
          `table ${table}, column ${column}, ${to} kr: ${monthly} != ${expected}`,
        )
    }
  }
  assert.ok(checked > 40_000, `only ${checked} cases`)
  assert.deepEqual(misses.slice(0, 10), [])
})

test('the worked examples of SKV 433 section 7.5.2', () => {
  const base = {
    ...EMPTY_INPUT,
    year: 2026,
    birthYear: 1990,
    municipalRate: 32.84,
    burialRate: 1.16,
  }
  // Example 1 and 2: in-work tax credit 11 976 and 26 083 kr at table 34.
  assert.equal(calculate({ ...base, salary: 90_000 }).inWorkTaxCredit, 11_976)
  assert.equal(calculate({ ...base, salary: 240_000 }).inWorkTaxCredit, 26_083)
  // Low incomes: total tax 2 062 kr on 28 000 and 4 445 kr on 55 000.
  assert.equal(calculate({ ...base, salary: 28_000 }).totalTax, 2_062)
  assert.equal(calculate({ ...base, salary: 55_000 }).totalTax, 4_445)
})

test('employer contributions by age, with the 2026 youth reduction', () => {
  const rules = RULES[2026]
  assert.equal(
    employerContributions(480_000, 1990, rules),
    Math.floor(480_000 * 0.3142),
  )
  assert.equal(
    employerContributions(480_000, 1955, rules),
    Math.floor(480_000 * 0.1021),
  )
  assert.equal(employerContributions(480_000, 1930, rules), 0)
  // Born 2005, 20 000 kr a month: nine months at 20.81 %, three at 31.42 %.
  assert.equal(
    employerContributions(240_000, 2005, rules),
    Math.floor(3 * 20_000 * 0.3142 + 9 * 20_000 * 0.2081),
  )
  // Above the monthly cap the excess pays the full rate.
  assert.equal(
    employerContributions(360_000, 2005, rules),
    Math.floor(3 * 30_000 * 0.3142 + 9 * (25_000 * 0.2081 + 5_000 * 0.3142)),
  )
})

test('capital income, ISK, capital deficit and property fee', () => {
  const base = { ...EMPTY_INPUT, year: 2026, birthYear: 1985 }
  // ISK: 3.55 % deemed income above 300 000 kr, taxed at 30 %.
  assert.equal(calculate({ ...base, iskCapital: 1_000_000 }).capitalTax, 7_455)
  // Interest and dividends at 30 %.
  assert.equal(
    calculate({ ...base, interestAndDividends: 10_000 }).capitalTax,
    3_000,
  )
  // A deficit: 30 % up to 100 000 kr, 21 % above, set against the tax on a salary.
  const deficit = calculate({
    ...base,
    salary: 600_000,
    interestExpenses: 150_000,
  })
  assert.equal(deficit.capitalDeficitReduction, 30_000 + 10_500)
  // Property fee: 0.75 % of the assessed value, at most 10 425 kr.
  assert.equal(
    calculate({ ...base, propertyAssessedValue: 1_000_000 }).propertyFee,
    7_500,
  )
  assert.equal(
    calculate({ ...base, propertyAssessedValue: 5_000_000 }).propertyFee,
    10_425,
  )
  assert.equal(
    calculate({
      ...base,
      propertyAssessedValue: 5_000_000,
      propertyFeeExempt: true,
    }).propertyFee,
    0,
  )
})

test('the tax wedge and the marginal rate', () => {
  const r = calculate({
    ...EMPTY_INPUT,
    year: 2026,
    birthYear: 1985,
    municipalRate: 32.41,
    burialRate: 0.29,
    salary: 480_000,
  })
  assert.equal(r.labourCost, 480_000 + r.employerContributions)
  assert.ok(r.taxWedge > 35 && r.taxWedge < 50, `wedge ${r.taxWedge}`)
  // Below the state tax threshold the marginal tax is municipal tax less the credit's taper.
  assert.ok(
    r.marginalRate > 20 && r.marginalRate < 40,
    `marginal ${r.marginalRate}`,
  )
  const high = calculate({
    ...EMPTY_INPUT,
    year: 2026,
    birthYear: 1985,
    municipalRate: 32.41,
    burialRate: 0.29,
    salary: 1_200_000,
  })
  assert.ok(high.marginalRate > 50, `marginal ${high.marginalRate}`)
})
