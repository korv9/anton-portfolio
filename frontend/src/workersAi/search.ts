/**
 * Vector search in the browser for the Workers AI demos (docs/workers-ai.md): a bge-m3 vector is
 * projected with the corpus's PCA, compared with every int8 passage vector, and, on the debate
 * map, placed among its nearest neighbours. No imports, so the unit tests run it in Node.
 */

export type Pca = {
  model: string
  dims_in: number
  dims: number
  mean: number[]
  /** dims rows of dims_in values. */
  components: number[][]
  /** int8 = round(clamp(v / scale, -127, 127)) per dimension. */
  scale: number[]
}

/** Centre, project and L2-normalise a full vector, as the corpus vectors were. */
export function project(vector: ArrayLike<number>, pca: Pca): Float32Array {
  const out = new Float32Array(pca.dims)
  const centred = Float32Array.from(pca.mean, (m, j) => vector[j] - m)
  for (let d = 0; d < pca.dims; d++) {
    const row = pca.components[d]
    let sum = 0
    for (let j = 0; j < centred.length; j++) sum += centred[j] * row[j]
    out[d] = sum
  }
  const norm = Math.hypot(...out) || 1
  for (let d = 0; d < out.length; d++) out[d] /= norm
  return out
}

export type Hit = { index: number; score: number }

/** Brute-force cosine k nearest neighbours against row-major int8 vectors. */
export function knn(
  query: Float32Array,
  vectors: Int8Array,
  scale: number[],
  k: number,
): Hit[] {
  const dims = query.length
  const weights = Float32Array.from(query, (q, d) => q * scale[d])
  const hits: Hit[] = []
  for (let i = 0, n = vectors.length / dims; i < n; i++) {
    let score = 0
    for (let d = 0, at = i * dims; d < dims; d++)
      score += weights[d] * vectors[at + d]
    if (hits.length === k && score <= hits[k - 1].score) continue
    let at = hits.length === k ? k - 1 : hits.length
    while (at > 0 && hits[at - 1].score < score) {
      hits[at] = hits[at - 1]
      at--
    }
    hits[at] = { index: i, score }
  }
  return hits
}

export type Neighbour = { score: number; x: number; y: number; cluster: number }

/**
 * Where a new point lands: the neighbours' 2D positions weighted by closeness (1 / cosine
 * distance), and the cluster most of them belong to; -1 when most are noise.
 */
export function place(neighbours: Neighbour[]) {
  let x = 0
  let y = 0
  let total = 0
  const votes = new Map<number, { count: number; weight: number }>()
  for (const n of neighbours) {
    const weight = 1 / Math.max(1 - n.score, 1e-3)
    x += n.x * weight
    y += n.y * weight
    total += weight
    const vote = votes.get(n.cluster) ?? { count: 0, weight: 0 }
    vote.count++
    vote.weight += weight
    votes.set(n.cluster, vote)
  }
  const [cluster] = [...votes].sort(
    ([, a], [, b]) => b.count - a.count || b.weight - a.weight,
  )[0] ?? [-1]
  return { x: x / total, y: y / total, cluster: cluster < 0 ? -1 : cluster }
}
