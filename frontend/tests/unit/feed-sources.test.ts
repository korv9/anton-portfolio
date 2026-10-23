import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const POSTS = 'frontend/src/meaning/posts'
const DATA = 'frontend/public/data'
const files = readdirSync(POSTS).filter((f) => f.endsWith('.tsx'))
const read = (f: string) => readFileSync(`${POSTS}/${f}`, 'utf8')
const literals = (s: string) =>
  [...s.matchAll(/'([^']+\.(?:json|parquet))'/g)].map((m) => m[1])

/** Path constants, the file's own first, then those of the kits it may import. */
const kitConsts = Object.fromEntries(
  files.filter((f) => f.endsWith('-kit.tsx')).flatMap((f) => constsOf(read(f))),
)
function constsOf(text: string) {
  return [...text.matchAll(/const ([A-Z_][A-Z0-9_]*) = '([^']+)'/g)].map(
    (m) => [m[1], m[2]] as const,
  )
}

/** The data paths a file's `useData` calls can read. A template literal is expanded by hand. */
const TEMPLATES: Record<string, string[]> = {
  'cluster-research/': [
    'cluster-research/debate-topics.json',
    'cluster-research/philosophy-topics.json',
    'cluster-research/municipalities.json',
  ],
}
function reads(text: string) {
  const own = { ...kitConsts, ...Object.fromEntries(constsOf(text)) }
  return [
    ...text.matchAll(/useData(?:<[^()]*?>)?\(\s*([^)]*?)\s*\)/gs),
  ].flatMap(([, arg]) => {
    if (literals(arg).length) return literals(arg)
    if (own[arg]) return [own[arg]]
    const t = Object.keys(TEMPLATES).find((k) => arg.startsWith(`\`${k}`))
    if (t) return TEMPLATES[t]
    throw new Error(`cannot resolve useData(${arg})`)
  })
}

/** Each post's id and its declared sources, from the `posts` array. */
function declared(text: string) {
  const list = text.slice(text.indexOf('export const posts'))
  return list
    .split(/\n {2}\{/)
    .slice(1)
    .map((post) => ({
      id: /id: '([^']+)'/.exec(post)?.[1] ?? '?',
      sources: /sources: \[([^\]]*)\]/.exec(post)?.[1],
    }))
}

/** Live R2 objects outside the release catalogue, as LIVE in feed_provenance.py, and the post
 * files that read each one through loadStatus() in freshness.ts. */
const LIVE: Record<string, string[]> = {
  'status/ingestion.json': ['how-pipeline.tsx'],
}
const catalog = new Set(
  (
    JSON.parse(readFileSync(`${DATA}/catalog.json`, 'utf8')) as {
      files: { path: string }[]
    }
  ).files.map((f) => f.path),
)

test('every feed post declares the data it reads, and only published paths', () => {
  let posts = 0
  for (const f of files) {
    const text = read(f)
    if (!text.includes('export const posts')) continue
    const all = new Set<string>()
    for (const p of declared(text)) {
      posts++
      assert.ok(p.sources !== undefined, `${f}: ${p.id} has no sources`)
      const paths = literals(p.sources)
      assert.ok(paths.length, `${f}: ${p.id} declares no paths`)
      for (const path of paths) {
        assert.ok(
          catalog.has(path) || path in LIVE || existsSync(`${DATA}/${path}`),
          `${f}: ${p.id} declares an unknown path ${path}`,
        )
        all.add(path)
      }
    }
    const used = new Set(reads(text))
    for (const path of used)
      assert.ok(all.has(path), `${f}: reads ${path} but no post declares it`)
    for (const path of all)
      assert.ok(
        used.has(path) || LIVE[path]?.includes(f),
        `${f}: declares ${path} but never reads it`,
      )
  }
  assert.ok(posts > 150, `only ${posts} posts found`)
})

test('the provenance file covers every declared path', () => {
  const prov = JSON.parse(
    readFileSync(`${DATA}/architecture/feed-provenance.json`, 'utf8'),
  ) as { paths: Record<string, unknown> }
  for (const f of files)
    for (const p of declared(read(f)))
      for (const path of literals(p.sources ?? ''))
        assert.ok(path in prov.paths, `${path} missing; run feed_provenance.py`)
})
