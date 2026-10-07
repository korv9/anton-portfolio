/**
 * Number formatting shared across the site, in the reader's language (en-GB or sv-SE).
 * Views with their own conventions (the tax pages always in sv-SE, a figure with a fixed
 * separator) keep their own helpers.
 */
import { l } from './i18n'

const locale = () => l('en-GB', 'sv-SE')

/** A number with exactly `digits` decimals: 1 234,5. */
export const fixed = (v: number, digits = 0) =>
  v.toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

/** A count with the locale's grouping: 12 345. */
export const count = (v: number) => v.toLocaleString(locale())

/** A share (0–1) as a whole percentage: 0.356 → "36 %". */
export const share = (v: number) =>
  `${(v * 100).toLocaleString(locale(), { maximumFractionDigits: 0 })} %`
