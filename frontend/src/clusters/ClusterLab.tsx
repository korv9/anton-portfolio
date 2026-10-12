import { useEffect, useRef, useState } from 'react'
import { l } from '../i18n'
import './clusterLab.css'

type Layout = {
  layout_id: string
  view: string
  preview: string | null
  drawn: number
  total: number
  parameters: Record<string, unknown>
  quality: { value: number | null; reason?: string }
}
type Run = {
  run_id: string
  dataset: string
  family: string
  stage: string
  observations: number
  clusters: number
  noise_share: number
  sample: { kind: string; selected: number; total: number }
  coverage: {
    years?: Record<string, number>
    works?: number
    languages?: Record<string, number>
    last_publication?: string
  }
  parameters: Record<string, unknown>
  metrics: Record<string, unknown>
  layouts: Layout[]
  selected: boolean
}
type Point = {
  observation_id: string
  x: number
  y: number
  cluster: number
  title?: string
  [key: string]: unknown
}
type View = {
  points: Point[]
  edges: [number, number][]
  drawn: number
  total: number
  display: { alpha: number; point_size: number; density_contours: boolean }
}
type Profile = {
  cluster: number
  size: number
  characteristic_terms?: { term: string }[]
  representative_examples: { id: string; text: string }[]
  random_examples: { id: string; text: string }[]
}
const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
const base = '/__cluster_lab/'
function contours(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  width: number,
  height: number,
) {
  const bins = 64
  let grid = new Float32Array(bins * bins)
  for (const point of points) {
    const x = Math.min(bins - 1, Math.floor((point.x / width) * bins))
    const y = Math.min(bins - 1, Math.floor((point.y / height) * bins))
    if (x >= 0 && y >= 0) grid[y * bins + x]++
  }
  for (let pass = 0; pass < 2; pass++) {
    const smoothed = new Float32Array(grid.length)
    for (let y = 1; y < bins - 1; y++)
      for (let x = 1; x < bins - 1; x++) {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            smoothed[y * bins + x] += grid[(y + dy) * bins + x + dx] / 9
      }
    grid = smoothed
  }
  const peak = grid.reduce((a, b) => Math.max(a, b), 0)
  for (const fraction of [0.2, 0.4, 0.6]) {
    const level = peak * fraction
    if (!level) continue
    ctx.beginPath()
    for (let y = 0; y < bins - 1; y++)
      for (let x = 0; x < bins - 1; x++) {
        const corners = [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ]
        const intersections: [number, number][] = []
        for (let edge = 0; edge < 4; edge++) {
          const a = corners[edge],
            b = corners[(edge + 1) % 4]
          const va = grid[a[1] * bins + a[0]],
            vb = grid[b[1] * bins + b[0]]
          if (va < level === vb < level) continue
          const t = (level - va) / (vb - va)
          intersections.push([
            ((a[0] + (b[0] - a[0]) * t) * width) / bins,
            ((a[1] + (b[1] - a[1]) * t) * height) / bins,
          ])
        }
        for (let i = 0; i + 1 < intersections.length; i += 2) {
          ctx.moveTo(...intersections[i])
          ctx.lineTo(...intersections[i + 1])
        }
      }
    ctx.stroke()
  }
}
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(base + path, { signal })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json()
}

function LabMap({
  view,
  colour,
  group,
}: {
  view: View
  colour: string
  group: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(900)
  const [point, setPoint] = useState<Point | null>(null)
  const projected = useRef<{ x: number; y: number; p: Point }[]>([])
  useEffect(() => {
    const el = canvas.current?.parentElement
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.round(entry.contentRect.width))),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const el = canvas.current
    if (!el || !view.points.length) return
    const height = Math.round(Math.min(700, width * 0.62))
    const ratio = window.devicePixelRatio || 1
    el.width = width * ratio
    el.height = height * ratio
    el.style.width = `${width}px`
    el.style.height = `${height}px`
    const ctx = el.getContext('2d')!
    ctx.scale(ratio, ratio)
    const xs = view.points.map((p) => p.x)
    const ys = view.points.map((p) => p.y)
    const min = (values: number[]) =>
      values.reduce((a, b) => Math.min(a, b), Infinity)
    const max = (values: number[]) =>
      values.reduce((a, b) => Math.max(a, b), -Infinity)
    const x0 = min(xs),
      x1 = max(xs),
      y0 = min(ys),
      y1 = max(ys)
    const scale = Math.min(
      (width - 24) / (x1 - x0 || 1),
      (height - 24) / (y1 - y0 || 1),
    )
    const ox = (width - scale * (x1 - x0)) / 2,
      oy = (height - scale * (y1 - y0)) / 2
    const styles = getComputedStyle(el)
    const palette = [
      '--cv-ground',
      '--cv-olive',
      '--cv-apricot',
      '--cv-powder',
      '--cv-butter',
      '--cv-pistachio',
    ].map((key) => styles.getPropertyValue(key).trim())
    const groups = new Map<string, number>()
    projected.current = view.points.map((p) => ({
      x: ox + (p.x - x0) * scale,
      y: oy + (p.y - y0) * scale,
      p,
    }))
    ctx.globalAlpha = 0.12
    ctx.strokeStyle = styles.getPropertyValue('--cv-ground')
    for (const [a, b] of view.edges || []) {
      const start = projected.current[a],
        end = projected.current[b]
      if (!start || !end) continue
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
    }
    // Display density is calculated from the saved coordinates; point positions are unchanged.
    if (view.display.density_contours) {
      contours(ctx, projected.current, width, height)
    }
    for (const { x, y, p } of projected.current) {
      const value = colour === 'neutral' ? 'all' : String(p[colour] ?? '')
      if (!groups.has(value)) groups.set(value, groups.size)
      ctx.fillStyle =
        palette[
          (colour === 'cluster' ? Math.max(0, p.cluster) : groups.get(value)!) %
            palette.length
        ]
      ctx.globalAlpha =
        group && value !== group
          ? 0.07
          : p.cluster < 0
            ? 0.15
            : view.display.alpha
      ctx.beginPath()
      ctx.arc(x, y, Math.max(0.6, view.display.point_size), 0, Math.PI * 2)
      ctx.fill()
    }
  }, [view, width, colour, group])
  return (
    <div className="clab-map">
      <canvas
        ref={canvas}
        role="img"
        aria-label={l(
          `${num(view.drawn)} drawn points from ${num(view.total)} observations. Saved UMAP coordinates, unchanged cluster assignments.`,
          `${num(view.drawn)} ritade punkter av ${num(view.total)} observationer. Sparade UMAP-koordinater och klusteretiketter.`,
        )}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - box.left,
            y = event.clientY - box.top
          const nearest = projected.current.find(
            (p) => Math.hypot(p.x - x, p.y - y) < 5,
          )
          setPoint(nearest?.p || null)
        }}
        onPointerLeave={() => setPoint(null)}
      />
      <p className="clab-point" aria-live="polite">
        {point
          ? `${point.title || point.observation_id} · ${l('cluster', 'kluster')} ${point.cluster}`
          : l(
              'Point at a passage or ad. Use the group filter and profiles to inspect with the keyboard.',
              'Peka på en passage eller annons. Använd gruppfiltret och profilerna för att granska med tangentbordet.',
            )}
      </p>
    </div>
  )
}

function OpenRun({ run }: { run: Run }) {
  const [layoutId, setLayoutId] = useState(() => {
    const saved = new URLSearchParams(
      window.location.hash.split('?')[1] || '',
    ).get(`lab_layout_${run.run_id}`)
    return run.layouts.some((layout) => layout.layout_id === saved)
      ? saved!
      : run.layouts[0]?.layout_id || ''
  })
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState('')
  const [colour, setColour] = useState('cluster')
  const [group, setGroup] = useState('')
  const [showContours, setShowContours] = useState(false)
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [config, setConfig] = useState<unknown>(null)
  const layout = run.layouts.find((item) => item.layout_id === layoutId)
  useEffect(() => {
    const [path, query = ''] = window.location.hash.split('?')
    const params = new URLSearchParams(query)
    if (layoutId) params.set(`lab_layout_${run.run_id}`, layoutId)
    window.history.replaceState(null, '', `${path}?${params}`)
  }, [layoutId, run.run_id])
  useEffect(() => {
    setView(null)
    if (!layout) return
    const controller = new AbortController()
    read<View>(layout.view, controller.signal)
      .then(setView)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(String(e))
      })
    return () => controller.abort()
  }, [layout?.view])
  const options =
    run.family === 'jobs'
      ? ['cluster', 'occupation_field', 'year', 'region', 'neutral']
      : ['cluster', 'symbol_id', 'document_id', 'tradition', 'neutral']
  const groups = view
    ? [...new Set(view.points.map((p) => String(p[colour] ?? '')))].sort()
    : []
  return (
    <article className="clab-open">
      <h3>
        {run.dataset} · <code>{run.run_id}</code>
      </h3>
      <p>
        {num(run.observations)} {l('observations', 'observationer')} ·{' '}
        {run.clusters} {l('clusters', 'kluster')} · {l('noise', 'brus')}{' '}
        {(run.noise_share * 100).toFixed(1)} % ·{' '}
        {run.sample.kind === 'full'
          ? l('full available corpus', 'hela tillgängliga korpusen')
          : `${l('sample of', 'urval av')} ${num(run.sample.total)}`}
      </p>
      <div className="clab-controls">
        <label>
          {l('Layout', 'Layout')}
          <select
            value={layoutId}
            onChange={(e) => {
              setLayoutId(e.target.value)
              setError('')
            }}
          >
            {run.layouts.map((item) => (
              <option key={item.layout_id} value={item.layout_id}>
                {item.layout_id.slice(0, 8)} · n{' '}
                {String(item.parameters.n_neighbors)}, d{' '}
                {String(item.parameters.min_dist)}, seed{' '}
                {String(item.parameters.random_state)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Colour', 'Färgläggning')}
          <select
            value={colour}
            onChange={(e) => {
              setColour(e.target.value)
              setGroup('')
            }}
          >
            {options.map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
        <label>
          {l('Highlight group', 'Markera grupp')}
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{l('All', 'Alla')}</option>
            {groups.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{l('Density contours', 'Densitetskonturer')}</span>
          <input
            type="checkbox"
            checked={showContours}
            onChange={(event) => setShowContours(event.target.checked)}
          />
        </label>
      </div>
      {layout && (
        <p className="clab-meta">
          {l('Drawn', 'Ritade')} {num(layout.drawn)} / {num(layout.total)} ·
          trustworthiness{' '}
          {layout.quality.value?.toFixed(3) ??
            l('unavailable', 'ej tillgänglig')}
          {layout.quality.reason ? `: ${layout.quality.reason}` : ''}
        </p>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : view ? (
        <LabMap
          view={{
            ...view,
            display: { ...view.display, density_contours: showContours },
          }}
          colour={colour}
          group={group}
        />
      ) : (
        <p role="status">
          {layout
            ? l('Loading…', 'Laddar…')
            : l('No saved layout yet.', 'Ingen sparad layout ännu.')}
        </p>
      )}
      <details
        onToggle={(event) => {
          if (event.currentTarget.open && !config)
            read(`${run.run_id}/config.json`)
              .then(setConfig)
              .catch((e) => setError(String(e)))
        }}
      >
        <summary>
          {l('Exact resolved configuration', 'Exakt upplöst konfiguration')}
        </summary>
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </details>
      <details>
        <summary>
          {l('Coverage and evaluation', 'Täckning och utvärdering')}
        </summary>
        <pre>
          {JSON.stringify(
            {
              coverage: run.coverage,
              sample: run.sample,
              metrics: run.metrics,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <details
        onToggle={(event) => {
          if (event.currentTarget.open && !profiles)
            read<{ profiles: Profile[] }>(`${run.run_id}/profiles.json`)
              .then((data) => setProfiles(data.profiles))
              .catch((e) => setError(String(e)))
        }}
      >
        <summary>{l('Profiles and examples', 'Profiler och exempel')}</summary>
        <p>
          {l(
            'Automatic terms are preliminary. Examples retain their observation IDs.',
            'Automatiska teman är preliminära. Exemplen behåller sina observations-ID:n.',
          )}
        </p>
        {profiles?.map((profile) => (
          <details key={profile.cluster}>
            <summary>
              {l('Cluster', 'Kluster')} {profile.cluster} · {num(profile.size)}{' '}
              ·{' '}
              {profile.characteristic_terms
                ?.map((term) => term.term)
                .join(', ')}
            </summary>
            <h4>{l('Representative examples', 'Representativa exempel')}</h4>
            {profile.representative_examples.map((example) => (
              <blockquote key={example.id}>
                <p>{example.text}</p>
                <cite>{example.id}</cite>
              </blockquote>
            ))}
            <h4>{l('Random examples', 'Slumpmässiga exempel')}</h4>
            {profile.random_examples.map((example) => (
              <blockquote key={example.id}>
                <p>{example.text}</p>
                <cite>{example.id}</cite>
              </blockquote>
            ))}
          </details>
        ))}
      </details>
    </article>
  )
}

export default function ClusterLab() {
  const [runs, setRuns] = useState<Run[]>([])
  const [open, setOpen] = useState<string[]>(
    () =>
      new URLSearchParams(window.location.hash.split('?')[1] || '')
        .get('lab_runs')
        ?.split(',')
        .filter(Boolean) || [],
  )
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('cluster-lab-selected') || '[]')
    } catch {
      return []
    }
  })
  const [dataset, setDataset] = useState(
    () =>
      new URLSearchParams(window.location.hash.split('?')[1] || '').get(
        'lab_dataset',
      ) || '',
  )
  const [status, setStatus] = useState(
    l('Loading local experiments…', 'Läser lokala experiment…'),
  )
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(
        window.location.hash.split('?')[1] || '',
      )
      setOpen(params.get('lab_runs')?.split(',').filter(Boolean) || [])
      setDataset(params.get('lab_dataset') || '')
    }
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])
  useEffect(() => {
    let active = true
    const refresh = () =>
      read<{ runs: Run[] }>('index.json')
        .then((data) => {
          if (active) {
            setRuns(data.runs)
            setStatus(
              data.runs.length
                ? ''
                : l(
                    'No completed experiments yet.',
                    'Inga färdiga experiment ännu.',
                  ),
            )
          }
        })
        .catch(() => {
          if (active)
            setStatus(
              l(
                'No local export yet. Run or export Cluster Lab to see saved experiments here.',
                'Ingen lokal export ännu. Kör eller exportera Cluster Lab för att se sparade experiment här.',
              ),
            )
        })
    refresh()
    const interval = window.setInterval(refresh, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])
  function toggle(id: string) {
    setOpen((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current.slice(-1), id],
    )
  }
  useEffect(() => {
    const [path, query = ''] = window.location.hash.split('?')
    const params = new URLSearchParams(query)
    if (open.length) params.set('lab_runs', open.join(','))
    else params.delete('lab_runs')
    if (dataset) params.set('lab_dataset', dataset)
    else params.delete('lab_dataset')
    window.history.replaceState(
      null,
      '',
      `${path}${params.size ? `?${params}` : ''}`,
    )
  }, [open, dataset])
  function mark(id: string) {
    const updated = selected.includes(id)
      ? selected.filter((value) => value !== id)
      : [...selected, id]
    setSelected(updated)
    localStorage.setItem('cluster-lab-selected', JSON.stringify(updated))
  }
  const filtered = runs.filter((run) => !dataset || run.dataset === dataset)
  const comparing = runs.filter((run) => open.includes(run.run_id))
  return (
    <section className="clab" aria-labelledby="clab-title">
      <header className="cv-head">
        <p className="cv-project">
          {l('Local experiments', 'Lokala experiment')}
        </p>
        <h2 id="clab-title">Cluster Lab</h2>
        <p>
          {l(
            'Compare saved clusterings and switch their UMAP layouts. Each experiment shows the data it actually used.',
            'Jämför sparade klustringar och byt mellan deras UMAP-layouter. Varje experiment visar den data det faktiskt använde.',
          )}
        </p>
      </header>
      <p role="status">{status}</p>
      {runs.length > 0 && (
        <>
          <label>
            {l('Dataset', 'Dataset')}{' '}
            <select
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
            >
              <option value="">{l('All datasets', 'Alla dataset')}</option>
              {[...new Set(runs.map((run) => run.dataset))].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="clab-table">
            <table>
              <caption>
                {l(
                  'Saved runs. Open two to compare. Selected marks are saved in this browser.',
                  'Sparade körningar. Öppna två för att jämföra. Markeringar sparas i den här webbläsaren.',
                )}
              </caption>
              <thead>
                <tr>
                  <th>{l('Dataset / run', 'Dataset / körning')}</th>
                  <th>{l('Scope', 'Omfattning')}</th>
                  <th>{l('Clusters', 'Kluster')}</th>
                  <th>{l('Noise', 'Brus')}</th>
                  <th>{l('Review', 'Granska')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => (
                  <tr key={run.run_id}>
                    <td>
                      {run.dataset}
                      {run.layouts[0]?.preview && (
                        <img
                          src={base + run.layouts[0].preview}
                          width={180}
                          height={108}
                          loading="lazy"
                          alt={l(
                            `UMAP preview for ${run.dataset}`,
                            `UMAP-preview för ${run.dataset}`,
                          )}
                        />
                      )}
                      <br />
                      <code>{run.run_id.slice(0, 12)}</code>
                      <br />
                      {run.family} · {run.stage}
                    </td>
                    <td>
                      {num(run.observations)} / {num(run.sample.total)} ·{' '}
                      {run.sample.kind}
                      <br />
                      {run.coverage.years
                        ? Object.entries(run.coverage.years)
                            .map(([year, count]) => `${year}: ${num(count)}`)
                            .join(' · ')
                        : `${run.coverage.works} ${l('works', 'verk')}`}
                      {run.coverage.years && (
                        <>
                          <br />
                          {l(
                            '2026 is an incomplete calendar year.',
                            '2026 är ett ofullständigt kalenderår.',
                          )}
                        </>
                      )}
                    </td>
                    <td>{run.clusters}</td>
                    <td>{(run.noise_share * 100).toFixed(1)} %</td>
                    <td>
                      <button
                        type="button"
                        aria-pressed={open.includes(run.run_id)}
                        onClick={() => toggle(run.run_id)}
                      >
                        {l('Open / compare', 'Öppna / jämför')}
                      </button>
                      <button
                        type="button"
                        aria-pressed={
                          selected.includes(run.run_id) || run.selected
                        }
                        onClick={() => mark(run.run_id)}
                      >
                        {l('Selected', 'Utvald')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="clab-comparison">
            {comparing.map((run) => (
              <OpenRun key={run.run_id} run={run} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
