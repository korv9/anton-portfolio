/**
 * Scale and tick helpers shared by the site's SVG charts. Every axis is derived from the
 * data it draws, so a new year or a larger value moves the axis instead of breaking it.
 */

/** Map a value in `domain` linearly onto `range`. */
export function linearScale(
  [d0, d1]: [number, number],
  [r0, r1]: [number, number],
) {
  const span = d1 - d0 || 1
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0)
}

/** A step of 1, 2 or 5 times a power of ten that splits `max` into about `count` parts. */
export function niceStep(max: number, count = 4) {
  if (!(max > 0)) return 1
  const raw = max / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

/** Ticks from zero to the first nice value at or above `max`. */
export function niceTicks(max: number, count = 4) {
  const step = niceStep(max, count)
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value)
  return ticks
}

/**
 * One tick per calendar year in a series of ISO dates ('2024-03-01' or '2024-03'), placed
 * at the index of the year's first point.
 */
export function yearTicks(dates: string[]) {
  const ticks: { index: number; label: string }[] = []
  dates.forEach((date, index) => {
    const year = date.slice(0, 4)
    if (ticks.at(-1)?.label !== year) ticks.push({ index, label: year })
  })
  return ticks
}

/** First and last year of a series of ISO dates, for titles and accessible names. */
export function yearSpan(dates: string[]) {
  if (!dates.length) return null
  const years = dates.map((date) => date.slice(0, 4)).sort()
  return { first: years[0], last: years.at(-1)! }
}
