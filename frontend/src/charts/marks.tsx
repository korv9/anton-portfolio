import type { Marker } from '../parties/identity'

/** A point marker in a party's shape, centred on (x, y). */
export function MarkerShape({
  shape,
  x,
  y,
  size = 5,
  fill,
  stroke = '#ffffff',
}: {
  shape: Marker
  x: number
  y: number
  size?: number
  fill: string
  stroke?: string
}) {
  const common = { fill, stroke, strokeWidth: 1.5 }
  switch (shape) {
    case 'square':
      return (
        <rect
          x={x - size}
          y={y - size}
          width={size * 2}
          height={size * 2}
          {...common}
        />
      )
    case 'diamond':
      return (
        <polygon
          points={`${x},${y - size * 1.3} ${x + size * 1.3},${y} ${x},${y + size * 1.3} ${x - size * 1.3},${y}`}
          {...common}
        />
      )
    case 'triangle':
      return (
        <polygon
          points={`${x},${y - size * 1.3} ${x + size * 1.2},${y + size} ${x - size * 1.2},${y + size}`}
          {...common}
        />
      )
    case 'triangle-down':
      return (
        <polygon
          points={`${x},${y + size * 1.3} ${x + size * 1.2},${y - size} ${x - size * 1.2},${y - size}`}
          {...common}
        />
      )
    default:
      return <circle className="round" cx={x} cy={y} r={size} {...common} />
  }
}

/**
 * Spread end labels vertically so none overlap: each label keeps its order and moves the
 * least it can to stay `gap` away from its neighbours, within [top, bottom].
 */
export function spreadLabels<T extends { y: number }>(
  labels: T[],
  gap: number,
  top: number,
  bottom: number,
): (T & { labelY: number })[] {
  const sorted = [...labels]
    .sort((a, b) => a.y - b.y)
    .map((l) => ({ ...l, labelY: l.y }))
  for (let i = 1; i < sorted.length; i++)
    sorted[i].labelY = Math.max(sorted[i].labelY, sorted[i - 1].labelY + gap)
  const overflow = (sorted.at(-1)?.labelY ?? 0) - bottom
  if (overflow > 0) {
    sorted[sorted.length - 1].labelY -= overflow
    for (let i = sorted.length - 2; i >= 0; i--)
      sorted[i].labelY = Math.min(sorted[i].labelY, sorted[i + 1].labelY - gap)
  }
  for (const l of sorted) l.labelY = Math.max(top, l.labelY)
  return sorted
}
