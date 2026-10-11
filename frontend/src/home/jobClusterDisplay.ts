type Point = { x: number; y: number; c: number }

/** Display-only filtering: keep substantial connected islands in the published UMAP. */
export function largeJobClusters(points: Point[]) {
  const groups = new Map<number, Point[]>()
  for (const point of points) {
    if (point.c < 0) continue
    const group = groups.get(point.c) ?? []
    group.push(point)
    groups.set(point.c, group)
  }
  const result: Point[] = []
  const cellSize = 0.25
  for (const group of groups.values()) {
    const cells = new Map<string, Point[]>()
    for (const point of group) {
      const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`
      const cell = cells.get(key) ?? []
      cell.push(point)
      cells.set(key, cell)
    }
    while (cells.size) {
      const start = cells.keys().next().value!
      const pending = [start]
      const island: Point[] = []
      island.push(...cells.get(start)!)
      cells.delete(start)
      while (pending.length) {
        const [x, y] = pending.pop()!.split(',').map(Number)
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const key = `${x + dx},${y + dy}`
            const cell = cells.get(key)
            if (!cell) continue
            island.push(...cell)
            cells.delete(key)
            pending.push(key)
          }
        }
      }
      if (island.length >= 250) result.push(...island)
    }
  }
  return result
}
