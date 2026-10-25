/**
 * The feed of every chart the site's data allows, on the meaning page. Posts come from
 * ./posts/*.tsx and are grouped by subject, each under a short heading, the strongest first.
 * Thumbnails animate their own slicers while on screen; a click opens one.
 */
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Card, usePageVisible } from './Card'
import { type Post } from './kit'
import './meaning.css'
import './feed-chrome.css'

const modules = import.meta.glob<{ posts: Post[] }>('./posts/*.tsx', {
  eager: true,
})

/**
 * Posts left out of the feed after a visual review: empty or near-uniform frames, tangles of
 * lines that read as noise at card size, squeezed scatters and repeats of a stronger number.
 */
const DROPPED = new Set<string>([
  // A single number, a test pass rate or a weak relation (rho 0.10, r 0.04): a sentence says
  // as much, or a sibling already shows the number.
  'wel-population-kpi',
  'wel-connections-scatter',
  'wel-health-trust',
  'wel-tax-kpi',
  'job-ai-big',
  'pol-meaning-ring',
  'pol-debate-kpis',
  // Answered more plainly by a sibling: issue bars and the stacked vote share.
  'pol-issue-multiples',
  'pol-share-multiples',
  // Too fine to read at card size, or a near-uniform frame.
  'job-sparks',
  'job-calendar',
  'txt-act-signal-multiples',
  'txt-ml-tension-boxes',
  // Thin samples: three setups compared on 16 to 20 questions.
  'txt-ml-gauges',
  // Internal diagnostics (sample tables, node counts) that answer no reader's question.
  'txt-plat-gold-rows',
  'txt-plat-arch-stack',
  // A stale file (the debate summary the pipeline no longer refreshes) and a one-off news
  // count with no time in it.
  'pol-topic-tree',
  'pol-news-topics',
])

/** The strongest posts, which open their sections in this order; the rest follow. */
const LEAD = [
  'pol-ai-speech-line',
  'pol-share-stacked',
  'pol-riksdag-eras-heat',
  'wel-wedge-lines',
  'wel-tax-nordic-lines',
  'job-ai-lines',
  'txt-act-apply-step',
]
const lead = (p: Post) => {
  const i = LEAD.indexOf(p.id)
  return i < 0 ? LEAD.length : i
}

/** Round-robin across groups so neighbouring posts come from different files. */
function interleave(groups: Post[][]) {
  const out: Post[] = []
  const longest = Math.max(0, ...groups.map((g) => g.length))
  for (let i = 0; i < longest; i++)
    for (const g of groups) if (g[i]) out.push(g[i])
  return out
}

/**
 * The feed reads as one long scroll by subject. A post joins the first section whose pattern
 * matches its id; the last section takes the rest.
 */
const SECTIONS = [
  {
    key: 'politics',
    title: 'Politics',
    line: "Elections, polls, news and the Riksdag's votes and debates.",
    match: /^pol-/,
  },
  {
    key: 'sweden',
    title: 'Sweden',
    line: 'Welfare, taxes, trust, and how counties and municipalities differ.',
    match: /^wel-/,
  },
  {
    key: 'jobs',
    title: 'Jobs',
    line: 'Swedish job ads: demand, fields, language and AI.',
    match: /^job-/,
  },
  {
    key: 'ai-act',
    title: 'AI Act',
    line: 'The EU AI Act: what applies, to whom and when, and how often AI comes up in ads and debates.',
    match: /^txt-act-/,
  },
  {
    key: 'law',
    title: 'Swedish law',
    line: 'The statute book (SFS): its growth, length and largest laws.',
    match: /^txt-plat-sfs-/,
  },
  {
    key: 'symbols',
    title: 'Symbols',
    line: 'Myth and religious symbols across 101 public-domain books.',
    match: /^txt-ml-(symbol|book|model|research|cluster-skyline|gauges)/,
  },
  {
    key: 'philosophy',
    title: 'Philosophy',
    line: 'Ideas, works and tensions in the philosophy corpus.',
    match:
      /^txt-ml-(phil|works|tension|eval|cluster-stacks|words|ethics|foundations)/,
  },
  {
    key: 'concepts',
    title: 'Concepts',
    line: 'How concepts relate across law, myth, philosophy and politics.',
    match: /^txt-ml-(concept|pair)/,
  },
  {
    key: 'platform',
    title: 'Platform',
    line: 'The models, data quality and lineage behind these charts.',
    match: /./,
  },
] as const

/** Per section, the posts of each file, interleaved so neighbours come from different files. */
const grouped = new Map<string, Post[][]>()
for (const key of Object.keys(modules).sort()) {
  const byFile = new Map<string, Post[]>()
  for (const p of modules[key].posts ?? []) {
    if (DROPPED.has(p.id)) continue
    const section = SECTIONS.find((s) => s.match.test(p.id))!.key
    byFile.set(section, [...(byFile.get(section) ?? []), p])
  }
  for (const [section, posts] of byFile)
    grouped.set(section, [...(grouped.get(section) ?? []), posts])
}
const PARTS = SECTIONS.map((s) => ({
  ...s,
  // A stable sort, so the posts after the lead keep their interleaved order.
  posts: interleave(grouped.get(s.key) ?? []).sort((a, b) => lead(a) - lead(b)),
})).filter((s) => s.posts.length)
export const FEED = PARTS.flatMap((s) => s.posts)

/** Grid reflow animated by the View Transitions API where the browser has it. */
function morph(change: () => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown
  }
  if (doc.startViewTransition) doc.startViewTransition(() => flushSync(change))
  else change()
}

/** `level` is the section heading level: 2 under the meaning page's h1. */
export default function Feed({ level = 2 }: { level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3'
  const [openId, setOpenId] = useState<string | null>(null)
  const pageVisible = usePageVisible()
  // Sections the reader paused; their thumbnails stay still while the page is open.
  const [paused, setPaused] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string | null) => morph(() => setOpenId(id))
  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') morph(() => setOpenId(null))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [openId])
  const pause = (key: string) =>
    setPaused((was) => {
      const now = new Set(was)
      if (!now.delete(key)) now.add(key)
      return now
    })
  return (
    <div className="mean-feed">
      {PARTS.map((s) => (
        <section
          key={s.key}
          className="mean-section"
          aria-labelledby={`mean-${s.key}`}
        >
          <header className="mean-section-head">
            <Heading id={`mean-${s.key}`}>{s.title}</Heading>
            <p>{s.line}</p>
            <button
              type="button"
              className="mean-pause"
              aria-pressed={paused.has(s.key)}
              onClick={() => pause(s.key)}
            >
              Pause<span className="visually-hidden"> {s.title} charts</span>
            </button>
          </header>
          <div className="mean-grid">
            {s.posts.map((p) => (
              <Card
                key={p.id}
                post={p}
                section={s.title}
                index={FEED.indexOf(p)}
                open={p.id === openId}
                moving={pageVisible && !paused.has(s.key)}
                toggle={toggle}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
