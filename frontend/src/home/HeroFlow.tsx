/**
 * The start of the start page is one flow chart: every line leaves one point, Anton, and ends in
 * what it is part of. Three colours, top to bottom: about me (the profile, the roles, the CVs,
 * the contacts), experience (each job and the education) and the tech stack (each group). Each
 * line is one real thing: a sentence, a role, a CV, a task done at a job or a tool, so how thick
 * a bundle is says how much is behind it. Every end is a button that opens what is behind it
 * where the pitch was.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import {
  CVS,
  EDUCATION,
  EXPERIENCE,
  PITCH,
  STACK,
  type Bilingual,
} from './content'

const b = (text: Bilingual) => l(text.en, text.sv)

type Part = 'about' | 'work' | 'stack'
type Node = {
  id: string
  part: Part
  label: string
  /** A short real figure beside the label: a period or a count. */
  meta: string
  /** One per real thing in the node; the number of lines drawn. */
  strands: number
  title: string
  body: ReactNode
}

const PARTS: { part: Part; en: string; sv: string }[] = [
  { part: 'about', en: 'About me', sv: 'Om mig' },
  { part: 'work', en: 'Experience', sv: 'Erfarenhet' },
  { part: 'stack', en: 'Tech stack', sv: 'Tech stack' },
]

const ROLES = [
  'Software Developer',
  'Data Engineer',
  'Analytics Engineer',
  ['Applied AI', 'Tillämpad AI'],
] as const

const sentences = (text: string) =>
  text.split(/(?<=[.!?])\s+/).filter((s) => s.trim())

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flow-chips">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function contacts() {
  return [
    profile.email && {
      label: l('Email', 'Mejl'),
      href: `mailto:${profile.email}`,
    },
    profile.linkedin && { label: 'LinkedIn ↗', href: profile.linkedin },
    { label: 'GitHub ↗', href: 'https://github.com/korv9' },
  ].filter(Boolean) as { label: string; href: string }[]
}

function Contact() {
  return (
    <nav
      className="cv-actions"
      aria-label={l('Contact and CV', 'Kontakt och CV')}
    >
      <a className="cv-button primary" href={CVS[0].file} download>
        {l('Download CV', 'Ladda ned CV')} ↓
      </a>
      <a className="cv-button" href="#projekt">
        {l('See the projects', 'Se projekten')} →
      </a>
      {contacts().map((c) => (
        <a
          key={c.href}
          className="cv-button"
          href={c.href}
          {...(c.href.startsWith('http')
            ? { target: '_blank', rel: 'noreferrer' }
            : {})}
        >
          {c.label}
        </a>
      ))}
      <details className="cv-more-cvs">
        <summary>{l('CV by role', 'CV per roll')}</summary>
        <ul>
          {CVS.map((cv) => (
            <li key={cv.file}>
              <a href={cv.file} download>
                {b(cv.role)} ↓
              </a>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  )
}

function years(period: Bilingual) {
  const found = [...new Set(period.en.match(/\d{4}/g) ?? [])]
  if (found.length < 2) return found[0] ?? ''
  return `${found[0]}–${found[found.length - 1].slice(2)}`
}

function nodesOf(): Node[] {
  const roles = ROLES.map((r) => (typeof r === 'string' ? r : l(r[0], r[1])))
  const links = contacts()
  return [
    {
      id: 'profile',
      part: 'about',
      label: l('Profile', 'Profil'),
      meta: 'Stockholm',
      strands: sentences(b(PITCH)).length,
      title: l('Who I am', 'Vem jag är'),
      body: <p>{b(PITCH)}</p>,
    },
    {
      id: 'roles',
      part: 'about',
      label: l('Roles', 'Roller'),
      meta: String(roles.length),
      strands: roles.length,
      title: l('The roles I am looking for', 'Rollerna jag söker'),
      body: (
        <>
          <Chips items={roles} />
          <p>
            {l(
              'Junior roles, in Stockholm or remote.',
              'Juniora roller, i Stockholm eller på distans.',
            )}
          </p>
        </>
      ),
    },
    {
      id: 'cvs',
      part: 'about',
      label: l('CV by role', 'CV per roll'),
      meta: String(CVS.length),
      strands: CVS.length,
      title: l('A CV for each kind of role', 'Ett CV för varje sorts roll'),
      body: (
        <ul className="flow-list">
          {CVS.map((cv) => (
            <li key={cv.file}>
              <a href={cv.file} download>
                {b(cv.role)} ↓
              </a>{' '}
              · {b(cv.focus)}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'contact',
      part: 'about',
      label: l('Contact', 'Kontakt'),
      meta: String(links.length),
      strands: links.length,
      title: l('Get in touch', 'Hör av dig'),
      body: (
        <p className="flow-links">
          {links.map((c) => (
            <a
              key={c.href}
              href={c.href}
              {...(c.href.startsWith('http')
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              {c.label}
            </a>
          ))}
        </p>
      ),
    },
    ...EXPERIENCE.map((job) => ({
      id: `work-${job.org}`,
      part: 'work' as const,
      label: job.org,
      meta: years(job.period),
      strands: job.did.length + job.tech.length,
      title: `${b(job.role)} · ${job.org}`,
      body: (
        <>
          <p className="flow-meta">
            {b(job.kind)} · {b(job.period)}
          </p>
          <ul className="flow-list">
            {job.did.map((d) => (
              <li key={d.sv}>{b(d)}</li>
            ))}
          </ul>
          {job.tech.length > 0 && <Chips items={job.tech} />}
          <p className="flow-links">
            <a href="#erfarenhet">{l('All experience', 'All erfarenhet')} →</a>
          </p>
        </>
      ),
    })),
    {
      id: 'edu',
      part: 'work',
      label: 'JENSEN',
      meta: years(EDUCATION.period),
      strands: 1,
      title: `${b(EDUCATION.role)} · ${EDUCATION.org}`,
      body: (
        <>
          <p className="flow-meta">{b(EDUCATION.period)}</p>
          <p>{b(EDUCATION.short)}</p>
        </>
      ),
    },
    ...STACK.map((group) => ({
      id: `stack-${group.group.en}`,
      part: 'stack' as const,
      label: b(group.group),
      meta: String(group.items.length),
      strands: group.items.length,
      title: b(group.group),
      body: (
        <>
          <p>{b(group.use)}</p>
          <Chips items={group.items} />
          <p className="flow-links">
            <a href="#teknik">{l('The whole stack', 'Hela stacken')} →</a>
          </p>
        </>
      ),
    })),
  ]
}

/** A fixed pseudo-random sequence, so the lines look drawn by hand but never jump. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const W = 1000
const ROW = 100

/** The rows: a header row per part, then one row per node. */
function layout(nodes: Node[]) {
  const rows: ({ header: Part } | { node: Node })[] = []
  for (const { part } of PARTS) {
    rows.push({ header: part })
    for (const node of nodes.filter((n) => n.part === part)) rows.push({ node })
  }
  const height = rows.length * ROW
  const rand = seeded(7)
  const paths: { id: string; part: Part; d: string }[] = []
  rows.forEach((row, r) => {
    if (!('node' in row)) return
    const { node } = row
    const y = (r + 0.5) * ROW
    const spread = Math.min(ROW * 0.7, 10 + node.strands * 6)
    for (let k = 0; k < node.strands; k++) {
      const t = node.strands === 1 ? 0.5 : k / (node.strands - 1)
      const end = y - spread / 2 + t * spread
      const c1 = 260 + rand() * 260
      const c2 = 480 + rand() * 260
      const oy = height / 2 + (rand() - 0.5) * 8
      paths.push({
        id: node.id,
        part: node.part,
        d: `M0 ${oy.toFixed(1)} C${c1.toFixed(0)} ${oy.toFixed(1)} ${c2.toFixed(0)} ${end.toFixed(1)} ${W} ${end.toFixed(1)}`,
      })
    }
  })
  return { rows, height, paths }
}

const still = () =>
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * On its own the chart is a hero (the name, the pitch, the contacts). Given `children` it is
 * embedded in a section (About me on the start page): the children take the pitch's place and
 * the section's heading stands above it.
 */
export default function HeroFlow({ children }: { children?: ReactNode } = {}) {
  const embedded = children !== undefined
  const nodes = useMemo(nodesOf, [])
  const { rows, height, paths } = useMemo(() => layout(nodes), [nodes])
  const [open, setOpen] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [pulse, setPulse] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Now and then one bundle runs, so the chart feels alive; never with reduced motion.
  useEffect(() => {
    if (still()) return
    let i = 0
    const id = window.setInterval(() => {
      if (document.hidden) return
      i = (i + 5) % nodes.length
      setPulse(nodes[i].id)
    }, 2600)
    return () => window.clearInterval(id)
  }, [nodes])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    if (window.matchMedia?.('(max-width: 760px)').matches)
      panel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const chosen = nodes.find((n) => n.id === open) ?? null
  const Root = embedded ? 'div' : 'header'
  const Heading = embedded ? 'h3' : 'h2'
  const focus = hover ?? open
  const running = focus ?? pulse
  const count = (part: Part) =>
    nodes.filter((n) => n.part === part).reduce((s, n) => s + n.strands, 0)
  const total = PARTS.reduce((s, p) => s + count(p.part), 0)

  return (
    <Root
      className={`flow${embedded ? ' is-embedded' : ''}${focus ? ' has-focus' : ''}`}
      id={embedded ? undefined : 'start'}
      style={{ '--rows': rows.length } as CSSProperties}
    >
      <div
        className={`flow-panel${chosen ? ' has-detail' : ''}`}
        id="flow-panel"
        ref={panel}
        aria-live="polite"
      >
        {!embedded && (
          <>
            <p className="home-eyebrow">
              <span className="home-dot round" aria-hidden="true" />
              {l(
                'Stockholm · open to junior roles',
                'Stockholm · öppen för juniora roller',
              )}
            </p>
            <h1 className="cv-name">Anton Ernstsson</h1>
          </>
        )}
        {chosen ? (
          <article className={`flow-detail is-${chosen.part}`}>
            <div className="flow-detail-head">
              <span className="flow-kind">
                {l(
                  PARTS.find((p) => p.part === chosen.part)!.en,
                  PARTS.find((p) => p.part === chosen.part)!.sv,
                )}
              </span>
              <button
                type="button"
                className="flow-close"
                onClick={() => setOpen(null)}
                aria-label={l('Close', 'Stäng')}
              >
                ✕
              </button>
            </div>
            <Heading>{chosen.title}</Heading>
            {chosen.body}
          </article>
        ) : (
          <div className="flow-intro">
            {embedded ? (
              children
            ) : (
              <>
                <p className="cv-role">
                  {l(
                    'Software Developer · Data Engineer · Analytics Engineer · Applied AI',
                    'Software Developer · Data Engineer · Analytics Engineer · Tillämpad AI',
                  )}
                </p>
                <p className="cv-pitch">{b(PITCH)}</p>
                <Contact />
              </>
            )}
          </div>
        )}
      </div>

      <div className="flow-chart">
        <svg
          className="flow-lines"
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              pathLength={1}
              className={`flow-line is-${p.part}${focus === p.id ? ' on' : focus ? ' off' : ''}`}
              style={{ '--i': i } as CSSProperties}
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setOpen(open === p.id ? null : p.id)}
            />
          ))}
          {paths
            .filter((p) => p.id === running)
            .map((p, i) => (
              <path
                key={`${running}-${i}`}
                d={p.d}
                pathLength={1}
                className={`flow-run is-${p.part}`}
              />
            ))}
        </svg>
        <span className="flow-origin round" aria-hidden="true" />

        <ol
          className="flow-ends"
          aria-label={l('What I am made of', 'Vad jag består av')}
        >
          {rows.map((row, r) =>
            'header' in row ? (
              <li
                key={row.header}
                className={`flow-head is-${row.header}`}
                style={{ '--r': r } as CSSProperties}
              >
                <b>
                  {l(
                    PARTS.find((p) => p.part === row.header)!.en,
                    PARTS.find((p) => p.part === row.header)!.sv,
                  )}
                </b>{' '}
                <span>{Math.round((count(row.header) / total) * 100)} %</span>
              </li>
            ) : (
              <li
                key={row.node.id}
                className={`flow-end is-${row.node.part}${open === row.node.id ? ' open' : ''}`}
                style={{ '--r': r } as CSSProperties}
              >
                <button
                  type="button"
                  aria-expanded={open === row.node.id}
                  aria-controls="flow-panel"
                  onClick={() =>
                    setOpen(open === row.node.id ? null : row.node.id)
                  }
                  onMouseEnter={() => setHover(row.node.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(row.node.id)}
                  onBlur={() => setHover(null)}
                >
                  <span className="flow-label">{row.node.label}</span>
                  <span className="flow-count">{row.node.meta}</span>
                </button>
              </li>
            ),
          )}
        </ol>
      </div>

      <p className="flow-note">
        {l(
          `Every line is one real thing: a sentence, a role, a CV, a task at a job or a tool, ${total} in all. The percentages are each part's share of the lines. Open any end.`,
          `Varje linje är en riktig sak: en mening, en roll, ett CV, en arbetsuppgift eller ett verktyg, ${total} totalt. Procenten är varje dels andel av linjerna. Öppna vilken ände som helst.`,
        )}
      </p>
    </Root>
  )
}
