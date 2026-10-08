/**
 * The semantic map of IT job ads. Every ad is a dot placed by how its text reads (UMAP); the
 * groups HDBSCAN found are numbered on the map by size. One picked group is drawn in ink and
 * the rest stay grey, so the map has one focus; the ranked list beside it picks the group and
 * its profile follows under the map. "Job titles" recolours the same dots by the title family
 * the employer chose, which shows whether the language groups follow the titles.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import RankBars from '../charts/RankBars'
import { currentLocale, l } from '../i18n'
import { Tag } from '../ui/Editorial'
import { Disclosure } from '../ui/Disclosure'
import {
  jsonData,
  projectCoordinates,
  ROLES,
  type Cluster,
  type JobPoint,
  type Summary,
} from './clusterData'
import '../charts/feature/feature.css'
import './clusters.css'

const pct = (v: number) => `${Math.round(v * 100)} %`
const num = (v: number) => v.toLocaleString(currentLocale())
// The four title families in the site's data-series tokens, in fixed order.
const ROLE_TOKENS = [
  '--data-blue',
  '--data-ochre',
  '--data-rust',
  '--data-green',
]

type View = 'groups' | 'titles'

export default function ClusterMap() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<{
    summary: Summary
    points: JobPoint[]
  } | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [view, setView] = useState<View>('groups')
  const [picked, setPicked] = useState<number | null>(null)
  const [hover, setHover] = useState<JobPoint | null>(null)
  const [size, setSize] = useState({ width: 800, height: 500 })

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    jsonData<Summary>('jobs/cluster-summary.json', controller.signal)
      .then(async (summary) => {
        if (summary.schema_version !== 1)
          throw new Error('Unsupported analysis format')
        const points: JobPoint[] = []
        // Sequential shards bound peak parsing memory and can be aborted on navigation.
        for (const shard of summary.shards) {
          const part = await jsonData<{ run_id: string; points: JobPoint[] }>(
            shard,
            controller.signal,
          )
          if (part.run_id !== summary.run_id)
            throw new Error('Mismatched analysis run')
          points.push(...part.points)
        }
        if (
          points.length !== summary.diagnostics.dataset_size ||
          points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
        )
          throw new Error('Invalid point dataset')
        if (!controller.signal.aborted) setData({ summary, points })
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [retry])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = Math.max(260, entries[0].contentRect.width)
      setSize({ width, height: Math.min(560, Math.max(300, width * 0.66)) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [data])

  const points = data?.points
  // Groups ranked by size; the number on the map is the rank, not the run's internal id.
  const groups = useMemo(
    () =>
      (data?.summary.clusters ?? [])
        .filter((c) => c.cluster_id !== -1)
        .sort((a, b) => b.job_count - a.job_count),
    [data],
  )
  const rank = useMemo(
    () => new Map(groups.map((c, i) => [c.cluster_id, i + 1])),
    [groups],
  )
  const focus = picked ?? groups[0]?.cluster_id ?? null
  const assigned = useMemo(
    () => (points ?? []).filter((p) => p.cluster !== -1),
    [points],
  )
  // The frame fits the middle 98 % of the grouped ads, so a few far-off ads do not shrink
  // the groups to a speck; dots beyond the frame are clipped.
  const frame = useMemo(() => {
    const cut = (v: number[]) => {
      const s = [...v].sort((a, b) => a - b)
      return [s[Math.floor(s.length * 0.01)], s[Math.ceil(s.length * 0.99) - 1]]
    }
    const [x0, x1] = cut(assigned.map((p) => p.x))
    const [y0, y1] = cut(assigned.map((p) => p.y))
    return assigned.filter(
      (p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1,
    )
  }, [assigned])
  const coords = useMemo(
    () => projectCoordinates(points ?? [], size.width, size.height, frame),
    [points, frame, size],
  )
  // Each group's label sits at the median of its dots.
  const labels = useMemo(() => {
    const byGroup = new Map<number, [number[], number[]]>()
    for (const p of assigned) {
      const pos = coords.get(p.id)
      if (!pos) continue
      const entry = byGroup.get(p.cluster) ?? [[], []]
      entry[0].push(pos[0])
      entry[1].push(pos[1])
      byGroup.set(p.cluster, entry)
    }
    const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1]
    return [...byGroup].map(([id, [xs, ys]]) => ({
      id,
      x: median(xs),
      y: median(ys),
    }))
  }, [assigned, coords])

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !points) return
    const css = getComputedStyle(el)
    const token = (name: string) => css.getPropertyValue(name).trim()
    const ink = token('--ink')
    const grey = token('--line-strong')
    const roleColours = ROLE_TOKENS.map(token)
    const dpr = window.devicePixelRatio || 1
    el.width = size.width * dpr
    el.height = size.height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size.width, size.height)
    const r = Math.max(0.9, Math.min(2, 2 * Math.sqrt(4000 / points.length)))
    const dot = (p: JobPoint, colour: string, alpha: number, radius = r) => {
      const [x, y] = coords.get(p.id)!
      ctx.globalAlpha = alpha
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    if (view === 'titles') {
      for (const p of points) {
        const i = ROLES.indexOf(p.role)
        dot(p, i < 0 ? grey : roleColours[i], p.cluster === -1 ? 0.3 : 0.6)
      }
    } else {
      // The grey field first, the picked group last so it sits on top.
      for (const p of points)
        if (p.cluster !== focus) dot(p, grey, p.cluster === -1 ? 0.18 : 0.35)
      for (const p of points)
        if (p.cluster === focus) dot(p, ink, 0.85, r * 1.15)
      ctx.globalAlpha = 1
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      for (const g of labels) {
        const on = g.id === focus
        ctx.font = `${on ? 700 : 500} ${on ? 14 : 12}px ${css.fontFamily}`
        ctx.lineWidth = 4
        ctx.strokeStyle = token('--paper-strong')
        ctx.fillStyle = on ? ink : token('--muted')
        const text = String(rank.get(g.id) ?? '')
        ctx.strokeText(text, g.x, g.y)
        ctx.fillText(text, g.x, g.y)
      }
    }
    if (hover && coords.has(hover.id)) {
      const [x, y] = coords.get(hover.id)!
      ctx.globalAlpha = 1
      ctx.strokeStyle = ink
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.stroke()
    }
  }, [points, coords, labels, rank, view, focus, hover, size])

  if (error)
    return (
      <div className="cluster-status" role="status">
        <p>
          {l(
            'The clustering analysis is unavailable just now.',
            'Klustringsanalysen är inte tillgänglig just nu.',
          )}
        </p>
        <button className="btn-quiet" onClick={() => setRetry((v) => v + 1)}>
          {l('Try again', 'Försök igen')}
        </button>
      </div>
    )
  if (!data)
    return (
      <p role="status">
        {l('Loading the semantic map…', 'Laddar den semantiska kartan…')}
      </p>
    )

  const { summary } = data
  const d = summary.diagnostics
  const noise = summary.clusters.find((c) => c.cluster_id === -1)
  // The archive years read in full, not the odd ad published just outside them.
  const years = [
    ...new Set(
      (summary.coverage ?? [])
        .filter((c) => c.status === 'complete')
        .map((c) => c.month.slice(0, 4)),
    ),
  ].sort()
  const span =
    years.length > 1 ? `${years[0]}–${years.at(-1)}` : (years[0] ?? '')
  const largest = groups[0]
  const current = groups.find((c) => c.cluster_id === focus)
  const name = (c: Cluster) => `${rank.get(c.cluster_id)} · ${c.cluster_label}`
  const roleCount = (role: string) =>
    data.points.filter((p) => p.role === role).length

  function nearest(clientX: number, clientY: number) {
    const bounds = canvas.current!.getBoundingClientRect()
    const x = clientX - bounds.left
    const y = clientY - bounds.top
    let best = 144
    let hit: JobPoint | null = null
    for (const p of data!.points) {
      const pos = coords.get(p.id)!
      const dist = (pos[0] - x) ** 2 + (pos[1] - y) ** 2
      if (dist < best) {
        best = dist
        hit = p
      }
    }
    return hit
  }

  return (
    <div className="cluster-explorer">
      <p className="cluster-finding">
        {l(
          `${num(d.dataset_size)} IT ads from ${span} form ${groups.length} groups. The largest, “${largest?.cluster_label}”, holds ${pct(largest?.dataset_share ?? 0)} of the ads; ${pct(d.noise_share)} fit no group.`,
          `${num(d.dataset_size)} IT-annonser från ${span} bildar ${groups.length} grupper. Den största, ”${largest?.cluster_label}”, rymmer ${pct(largest?.dataset_share ?? 0)} av annonserna; ${pct(d.noise_share)} passar inte i någon grupp.`,
        )}
      </p>

      <div
        className="cluster-view feature-pick"
        role="group"
        aria-label={l('Colour the dots by', 'Färga prickarna efter')}
      >
        {(
          [
            ['groups', l('Groups found in the text', 'Grupper i texten')],
            ['titles', l('Job titles', 'Jobbtitlar')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <figure className="cluster-figure">
        <canvas
          ref={canvas}
          style={{ height: size.height }}
          role="img"
          aria-label={l(
            `Map of ${num(d.dataset_size)} job ads; ads written alike sit close together. The groups are listed beside the map.`,
            `Karta över ${num(d.dataset_size)} jobbannonser; annonser som är skrivna lika ligger nära varandra. Grupperna listas bredvid kartan.`,
          )}
          onMouseMove={(e) => setHover(nearest(e.clientX, e.clientY))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const hit = nearest(e.clientX, e.clientY)
            if (hit && hit.cluster !== -1) setPicked(hit.cluster)
          }}
        />
        <figcaption className="cluster-caption" aria-live="polite">
          {hover ? (
            <>
              <strong>{hover.title}</strong> · {hover.role} · {hover.year} ·{' '}
              {hover.cluster === -1
                ? l('no group', 'ingen grupp')
                : `${l('group', 'grupp')} ${rank.get(hover.cluster)}`}
            </>
          ) : view === 'titles' ? (
            <span className="cluster-key">
              {ROLES.map((role, i) => (
                <span key={role}>
                  <i style={{ background: `var(${ROLE_TOKENS[i]})` }} />
                  {role} {num(roleCount(role))}
                </span>
              ))}
            </span>
          ) : (
            l(
              'Each dot is an ad. Ads written alike sit close; the axes have no unit. Point at a dot to read it, click to pick its group.',
              'Varje prick är en annons. Annonser som är skrivna lika ligger nära; axlarna saknar enhet. Peka på en prick för att läsa den, klicka för att välja dess grupp.',
            )
          )}
        </figcaption>
      </figure>

      <div className="cluster-pair">
        <div className="cluster-list">
          <h2>{l('The groups by size', 'Grupperna efter storlek')}</h2>
          <RankBars
            label={l('Ads per group', 'Annonser per grupp')}
            rows={groups.map((c) => ({
              key: String(c.cluster_id),
              label: name(c),
              value: c.job_count,
              note: pct(c.dataset_share),
            }))}
            format={num}
            limit={10}
            onPick={(key) => setPicked(Number(key))}
            picked={focus === null ? null : String(focus)}
          />
          {noise && (
            <p className="cluster-noise">
              {l(
                `${num(noise.job_count)} ads (${pct(noise.dataset_share)}) fit no group and stay grey.`,
                `${num(noise.job_count)} annonser (${pct(noise.dataset_share)}) passar inte i någon grupp och är grå.`,
              )}
            </p>
          )}
        </div>
        {current && <Profile cluster={current} name={name(current)} />}
      </div>

      <Disclosure
        label={l(
          'Groups against job titles (table)',
          'Grupper mot jobbtitlar (tabell)',
        )}
      >
        <div className="cluster-table-wrap">
          <table>
            <caption>
              {l(
                'Number of ads; all analysis years',
                'Antal annonser; alla analysår',
              )}
            </caption>
            <thead>
              <tr>
                <th scope="col">{l('Group', 'Grupp')}</th>
                {ROLES.map((role) => (
                  <th key={role} scope="col">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...groups, ...(noise ? [noise] : [])].map((c) => (
                <tr key={c.cluster_id}>
                  <th scope="row">
                    {c.cluster_id === -1
                      ? l('No group', 'Ingen grupp')
                      : name(c)}
                  </th>
                  {ROLES.map((role) => (
                    <td key={role}>
                      {num(
                        c.role_distribution.find((r) => r.label === role)
                          ?.count ?? 0,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>

      <Disclosure label={l('Method and limits', 'Metod och begränsningar')}>
        <p>
          {l(
            `Title, description and technology mentions of every ad are embedded locally with ${summary.config.model}, combined with title and technology features, reduced with UMAP to ${summary.config.dimensions ?? 10} dimensions and grouped with HDBSCAN. A group needs agreement from at least two of three runs with different seeds. A separate two-dimensional UMAP draws this map.`,
            `Rubrik, beskrivning och teknikomnämnanden i varje annons bäddas in lokalt med ${summary.config.model}, kombineras med rubrik- och teknikegenskaper, reduceras med UMAP till ${summary.config.dimensions ?? 10} dimensioner och grupperas med HDBSCAN. En grupp kräver stöd från minst två av tre körningar med olika slumpfrön. En separat tvådimensionell UMAP ritar kartan.`,
          )}
        </p>
        <p>
          {l('Map neighbour preservation', 'Kartans bevarande av grannar')}:{' '}
          {(d.feature_trustworthiness ?? d.trustworthiness).toFixed(2)}.
          Silhouette: {d.silhouette?.toFixed(2) ?? '–'}.{' '}
          {l(
            'Mean agreement across runs',
            'Genomsnittligt stöd mellan körningar',
          )}
          : {d.mean_cluster_probability?.toFixed(2) ?? '–'}.{' '}
          {l(
            `Diagnostics use a sample of ${num(d.trustworthiness_sample_size)} ads.`,
            `Diagnostiken använder ett urval på ${num(d.trustworthiness_sample_size)} annonser.`,
          )}
        </p>
        <p>
          {l(
            'Only the four selected software and data title families are included. An ad is not a hire. Group names are automatic descriptions from distinctive skills or frequent titles, not a validated occupational taxonomy; employer templates can create dense groups. The axes have no meaning.',
            'Bara de fyra utvalda titelfamiljerna inom mjukvara och data ingår. En annons är inte en anställning. Gruppnamnen är automatiska beskrivningar från särskiljande kompetenser eller vanliga rubriker, inte en validerad yrkesindelning; arbetsgivares mallar kan skapa täta grupper. Axlarna saknar betydelse.',
          )}
        </p>
        <p className="cluster-run">
          {l('Source', 'Källa')}: JobTech Historical Ads {span} ·{' '}
          {summary.generated_at.slice(0, 10)} · {summary.run_id}
        </p>
      </Disclosure>
    </div>
  )
}

function Profile({ cluster: c, name }: { cluster: Cluster; name: string }) {
  const employer = c.top_employers?.[0]
  return (
    <section className="cluster-profile" aria-live="polite">
      <h2>{name}</h2>
      <p className="cluster-profile-lead">
        {l(
          `${num(c.job_count)} ads, ${pct(c.dataset_share)} of all. Junior in the title: ${pct(c.junior_share)}; senior: ${pct(c.senior_share)}.`,
          `${num(c.job_count)} annonser, ${pct(c.dataset_share)} av alla. Junior i titeln: ${pct(c.junior_share)}; senior: ${pct(c.senior_share)}.`,
        )}
      </p>
      <div className="cluster-profile-grid">
        <div>
          <h3>{l('Job titles in the group', 'Jobbtitlar i gruppen')}</h3>
          <RankBars
            label={l('Share per title family', 'Andel per titelfamilj')}
            rows={c.role_distribution.map((r) => ({
              key: r.label,
              label: r.label,
              value: r.share,
            }))}
            format={pct}
            max={1}
          />
        </div>
        {c.years && c.years.length > 1 && (
          <div>
            <h3>{l('Ads per year', 'Annonser per år')}</h3>
            <RankBars
              label={l('Ads per year', 'Annonser per år')}
              rows={[...c.years]
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((y) => ({ key: y.label, label: y.label, value: y.count }))}
              format={num}
            />
          </div>
        )}
        <div>
          <h3>
            {l('Skills that set it apart', 'Kompetenser som skiljer ut den')}
          </h3>
          <div className="cluster-tags">
            {c.top_skills.slice(0, 8).map((s) => (
              <Tag key={s.skill}>{s.skill}</Tag>
            ))}
          </div>
          <h3>{l('Common titles', 'Vanliga rubriker')}</h3>
          <ul className="cluster-titles">
            {c.top_titles.slice(0, 5).map((t) => (
              <li key={t.label}>
                {t.label} <span>{num(t.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {employer && employer.share > 0.5 && (
        <p className="cluster-warning">
          {l(
            `${employer.label} supplies ${pct(employer.share)} of this group; its templates may be what holds the group together.`,
            `${employer.label} står för ${pct(employer.share)} av gruppen; dess annonsmallar kan vara det som håller ihop gruppen.`,
          )}
        </p>
      )}
    </section>
  )
}
