/**
 * Small Workers AI exports for the e2e tests, in the contract's format (docs/workers-ai.md):
 * 1024-dimensional vectors projected onto 4 PCA dimensions, int8 passage vectors, meta.json and
 * examples.json. Debate passages sit on two groups of the published debate map, so a placed
 * sentence lands among real coordinates. Routes are mocked; nothing here is published.
 */
import fs from 'node:fs'
import type { Page, Route } from '@playwright/test'

const DIMS = 4
const unit = (d: number) => {
  const v = new Array(1024).fill(0)
  v[d] = 1
  return v
}
const pca = {
  model: '@cf/baai/bge-m3',
  dims_in: 1024,
  dims: DIMS,
  mean: new Array(1024).fill(0),
  components: [0, 1, 2, 3].map(unit),
  scale: new Array(DIMS).fill(1 / 127),
}
/** An int8 row close to axis d. */
const row = (d: number, i: number) =>
  [0, 1, 2, 3].map((j) => (j === d ? 120 : j === (d + 1) % DIMS ? i : 0))

const debateMap = JSON.parse(
  fs.readFileSync(
    new URL(
      '../public/data/cluster-research/debate-topics.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as { names: Record<string, [string, string]>; points: unknown[][] }
const at = (cluster: number) =>
  debateMap.points.find((p) => p[3] === cluster) as [
    string,
    number,
    number,
    number,
  ]

/** Clusters 0 and 2 of the published map; axis 0 leads to 0, axis 1 to 2. */
export const DEBATE = { first: 0, second: 2, names: debateMap.names }
const PARTIES = ['S', 'M', 'SD', 'C', 'V']
const debateItems = [DEBATE.first, DEBATE.second].flatMap((cluster, d) =>
  Array.from({ length: 10 }, (_, i) => {
    const [, x, y] = at(cluster)
    return {
      id: `fixture-${cluster}-${i}`,
      x: x + i * 0.01,
      y: y + i * 0.01,
      cluster,
      party: PARTIES[i % PARTIES.length],
      speaker: `Talare ${i}`,
      year: 2000 + i,
      url: 'https://data.riksdagen.se/',
      text: `Fixture passage ${i} in group ${cluster}.`,
      vector: row(d, i),
    }
  }),
)

const lawItems = Array.from({ length: 10 }, (_, i) => ({
  id: `sfs-1982-80-${i + 1}`,
  title: `Lag (1982:80) om anställningsskydd ${i + 1} §`,
  url: 'https://data.riksdagen.se/dokument/sfs-1982-80',
  text: `Fixture paragraph ${i + 1}.`,
  law: '1982:80',
  fetched: '2026-10-14',
  vector: row(i < 5 ? 0 : 1, i),
}))

function corpus(corpus: string, items: { vector: number[] }[], extra = {}) {
  return {
    'pca.json': pca,
    'vectors.bin': Buffer.from(Int8Array.from(items.flatMap((i) => i.vector))),
    'meta.json': {
      corpus,
      model: '@cf/baai/bge-m3',
      created: '2026-10-14',
      n: items.length,
      dims: DIMS,
      recall_at_10: 0.95,
      items: items.map(({ vector: _, ...item }) => item),
      ...extra,
    },
  }
}

export const FILES: Record<string, Record<string, unknown>> = {
  debate: {
    ...corpus('debate', debateItems),
    'examples.json': {
      model: '@cf/baai/bge-m3',
      examples: [
        { text: 'Fixture example near the first group.', vector: unit(0) },
        { text: 'Fixture example near the second group.', vector: unit(1) },
      ],
    },
  },
  sfs: {
    ...corpus('sfs', lawItems, {
      fetched: '2026-10-14',
      laws: [
        {
          sfs: '1982:80',
          title: 'Lag (1982:80) om anställningsskydd',
          url: 'https://data.riksdagen.se/dokument/sfs-1982-80',
        },
      ],
    }),
    'examples.json': {
      examples: [
        { question: 'Fixture question near paragraph 1?', vector: unit(0) },
      ],
    },
  },
}
export const LAW = lawItems

/**
 * Serve the fixture exports, on the site or on the R2 base the catalog may route them to;
 * `requested` records which files the page asked for.
 */
export async function serveExports(page: Page, requested: string[] = []) {
  await page.route(/\/workers-ai\/[^/]+\/[^/]+$/, (route: Route) => {
    const [, corpus, file] =
      new URL(route.request().url()).pathname.match(
        /workers-ai\/([^/]+)\/([^/]+)$/,
      ) ?? []
    requested.push(`${corpus}/${file}`)
    const body = FILES[corpus]?.[file]
    if (body == null) return route.fulfill({ status: 404 })
    return Buffer.isBuffer(body)
      ? route.fulfill({ body, contentType: 'application/octet-stream' })
      : route.fulfill({ json: body })
  })
  return requested
}

export const vectorNear = unit
