/**
 * B — The Ideal Human: which years a change is measured between, and how a reading's verdict
 * holds up when the baseline year moves. Pure functions so the rules can be tested alone.
 */
export type Verdict = 'supports' | 'challenges' | 'undetermined'

/** The last year counted from a full-year archive; a year built only from quarterly
 * archives (2026-Q1, …) is still running and is not an endpoint. */
export const lastComplete = (years: number[], running: string[]) =>
  [...years].reverse().find((y) => !running.includes(String(y))) ??
  years[years.length - 1]

/** The first year with a standardised value and the years two and four later, when counted
 * and before the endpoint: a change that depends on one baseline year is fragile. */
export const baselines = (years: number[], from: number, end: number) =>
  [from, from + 2, from + 4].filter((y) => y < end && years.includes(y))

/** A verdict stands only when every baseline gives it. */
export const agreed = (verdicts: Verdict[]): Verdict =>
  verdicts.length > 0 && verdicts.every((v) => v === verdicts[0])
    ? verdicts[0]
    : 'undetermined'
