/** The start page's small picture of the atlas: every tenth real point, coloured by cluster. */
import { useEffect, useState } from 'react'
import { clusterColour, loadAtlasPreview } from './atlasData'
import type { AtlasPreview } from './atlasTypes'

export default function SymbolicPreview() {
  const [data, setData] = useState<AtlasPreview | null>(null)
  useEffect(() => {
    let live = true
    loadAtlasPreview()
      .then((d) => live && setData(d))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  if (!data) return <svg viewBox="0 0 300 200" aria-hidden="true" />
  const xs = data.points.map((p) => p[0])
  const ys = data.points.map((p) => p[1])
  const [x0, x1, y0, y1] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ]
  const sx = (v: number) => 10 + ((v - x0) / (x1 - x0 || 1)) * 280
  const sy = (v: number) => 190 - ((v - y0) / (y1 - y0 || 1)) * 180
  return (
    <svg viewBox="0 0 300 200" aria-hidden="true">
      {data.points.map(([x, y, c], i) => (
        <circle
          key={i}
          cx={sx(x)}
          cy={sy(y)}
          r={c < 0 ? 1.2 : 1.8}
          fill={clusterColour(c, c < 0 ? 0.5 : 0.85)}
        />
      ))}
    </svg>
  )
}
