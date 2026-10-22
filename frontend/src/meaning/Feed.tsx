/**
 * The feed of every chart the site's data allows, shared by the meaning page (dark) and the
 * end of the home page (light). Posts come from ./posts/*.tsx and are grouped by subject, each
 * under a short heading. Thumbnails animate their own slicers while on screen; a click opens one.
 */
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Card, usePageVisible } from './Card'
import { type Post } from './kit'
import './meaning.css'

const modules = import.meta.glob<{ posts: Post[] }>('./posts/*.tsx', {
  eager: true,
})

/**
 * Posts left out of the feed after a visual review: empty or near-uniform frames, tangles of
 * lines that read as noise at card size, squeezed scatters and repeats of a stronger number.
 */
const DROPPED = new Set<string>([
  // Empty or near-uniform.
  'pol-issue-welfare',
  'txt-plat-quality-waffle',
  'wel-ongoing-calendar',
  'wel-ess-heat',
  'job-ai-field-heat',
  'txt-act-signal-calendar',
  'txt-plat-compliance-funnel',
  // Tangles of lines.
  'wel-county-bump',
  'wel-county-parallel',
  'wel-tax-slope',
  'txt-ml-model-parallel',
  'job-occupation-slope',
  // Squeezed or too fine to read.
  'pol-cohesion-scatter',
  'txt-plat-sfs-repealed',
  'wel-church-swarm',
  'txt-plat-dataset-bubbles',
  'wel-headline-waffles',
  'wel-rate-kpis',
  'pol-ministers',
  // Single numbers beyond the strongest few.
  'txt-act-duty-total',
  'txt-act-references-kpi',
  'txt-act-characters',
  'txt-plat-gold-kpi',
  'txt-ml-observations',
  // Data not fit to show until the phase 1 data review: thin samples, partial periods or
  // ranges labelled wider than the data.
  'wel-wedge-bars',
  'txt-act-signal-line',
  'pol-poll-kpi',
  'pol-poll-radial',
  'pol-poll-error',
  'pol-poll-changes',
  'wel-ess-radar',
  'wel-ess-radial',
  'wel-ess-slope',
  'pol-study-bars',
  'pol-news-radial',
])

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
    match: /^txt-ml-(symbol|book|model|research|cluster-skyline)/,
  },
  {
    key: 'philosophy',
    title: 'Philosophy',
    line: 'Ideas, works and tensions in the philosophy corpus.',
    match: /^txt-ml-(phil|works|tension|eval|cluster-stacks|words)/,
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
  posts: interleave(grouped.get(s.key) ?? []),
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

/** `level` is the section heading level: 2 under the meaning page's h1, 3 on the home page. */
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
