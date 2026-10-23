/**
 * Small Workers AI exports for the e2e tests, in the contract's format (docs/workers-ai.md):
 * 1024-dimensional vectors projected onto 4 PCA dimensions, int8 passage vectors, meta.json and
 * examples.json. Debate passages sit on two groups of the published debate map, so a placed
 * sentence lands among real coordinates. Routes are mocked; nothing here is published.
 */
import fs from 'node:fs'
import type { Page, Route } from '@playwright/test'

const DIMS = 4
const ANSWER_MODEL = '@cf/google/gemma-4-26b-a4b-it'
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

// Ask the platform: passages with their file, commit and graph nodes; the first names a gold
// model of the published graph, so the answer draws its path.
const platformItems = Array.from({ length: 10 }, (_, i) => ({
  id: i === 0 ? 'dbt:fct_election' : `docs/pipeline.md#fixture-${i}`,
  title:
    i === 0
      ? 'fct_election (platform/models/gold/parliament/schema.yml)'
      : `docs/pipeline.md › Fixture ${i}`,
  url: `https://github.com/korv9/anton-portfolio/blob/abc1234/${i === 0 ? 'platform/models/gold/parliament/schema.yml' : 'docs/pipeline.md'}`,
  text: `Fixture platform passage ${i}.`,
  path:
    i === 0 ? 'platform/models/gold/parliament/schema.yml' : 'docs/pipeline.md',
  commit: 'abc1234',
  nodes: i === 0 ? ['dbt:fct_election'] : [],
  vector: row(i < 5 ? 0 : 1, i),
}))
export const PLATFORM = platformItems
const platformAnswer = {
  status: 'verified',
  answer: `From the election model [[${platformItems[0].id}]]"Fixture platform passage 0."`,
  quotes: [{ id: platformItems[0].id, quote: 'Fixture platform passage 0.' }],
  model: ANSWER_MODEL,
}
export const PLATFORM_ANSWER = platformAnswer

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
    // As the eval publishes them: the Swedish question, its English version, and the Worker's
    // checked answer. The answer cites with a colon, a variant the Worker's parser accepts.
    'examples.json': {
      model: ANSWER_MODEL,
      created: '2026-10-15T00:46:51Z',
      examples: [
        {
          question: 'Fixturefråga nära paragraf 1?',
          question_en: 'Fixture question near paragraph 1?',
          vector: unit(0),
          passages: lawItems.slice(0, 8).map((i) => i.id),
          status: 'verified',
          answer: {
            status: 'verified',
            answer: `Det gäller [[${lawItems[0].id}]]: "Fixture paragraph 1."`,
            quotes: [{ id: lawItems[0].id, quote: 'Fixture paragraph 1.' }],
            model: ANSWER_MODEL,
          },
        },
      ],
    },
  },
  platform: {
    ...corpus('platform', platformItems),
    'examples.json': {
      model: ANSWER_MODEL,
      created: '2026-10-22T20:57:00Z',
      examples: [
        {
          question: 'Fixture platform question?',
          vector: unit(0),
          passages: platformItems.slice(0, 8).map((i) => i.id),
          status: 'verified',
          answer: platformAnswer,
        },
      ],
    },
  },
  // The English AI Act has passages but, like the real export, no examples.json.
  'ai-act-en': corpus('ai-act-en', lawItems),
}
export const LAW = lawItems

/** eval.json as the model comparison writes it, gpt-oss with a lower-bound cost. */
export const EVAL = {
  model: ANSWER_MODEL,
  setting: 'thinking off',
  questions: 20,
  verified_share: 0.75,
  recall_at_k: 0.85,
  k: 8,
  tokens_per_answer: 2672,
  compared: [
    {
      model: ANSWER_MODEL,
      setting: 'thinking off',
      questions: 20,
      verified_share: 0.75,
      recall_at_k: 0.85,
      k: 8,
      tokens_in: 2341,
      tokens_out: 331,
      neurons_per_answer: 30.2,
    },
    {
      model: '@cf/openai/gpt-oss-20b',
      setting: 'reasoning low',
      questions: 19,
      verified_share: 0.632,
      recall_at_k: 0.842,
      k: 8,
      tokens_in: 2328,
      tokens_out: 293,
      neurons_per_answer: 50.3,
      neurons_lower_bound: true,
    },
  ],
}

/**
 * Serve the fixture exports, on the site or on the R2 base the catalog may route them to;
 * `requested` records which files the page asked for.
 */
export async function serveExports(page: Page, requested: string[] = []) {
  await page.route(/\/workers-ai\/eval\.json$/, (route) =>
    route.fulfill({ json: EVAL }),
  )
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
