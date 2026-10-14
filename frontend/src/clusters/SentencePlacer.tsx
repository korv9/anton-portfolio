/**
 * A visitor's sentence on the party-leader debate map (docs/workers-ai.md): the Worker embeds it
 * with bge-m3, the browser finds its 15 nearest passages among the int8 vectors and places it at
 * their closeness-weighted position. Three examples carry their vectors and work without the
 * Worker. The vectors load when the reader first focuses the box or picks an example. Shown only
 * when the export is published.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../welfare/data'
import RankBars from '../charts/RankBars'
import ClusterScatter from './ClusterScatter'
import type { Loaded } from './ClusterVisualsPage'
import {
  embed,
  loadCorpus,
  nearest,
  fallback,
  Unavailable,
} from '../workersAi/corpus'
import { place } from '../workersAi/search'

type Item = {
  id: string
  x: number
  y: number
  cluster: number
  party: string
  speaker: string
  year: number
  url: string
  text: string
}
type Example = { text: string; vector: number[] }
type Placed = {
  x: number
  y: number
  cluster: number
  neighbours: { item: Item; score: number }[]
}

const K = 15
const MAX = 500
const cut = (text: string, n = 220) =>
  text.length > n ? `${text.slice(0, n).trimEnd()}…` : text

export default function SentencePlacer({
  loadMap,
}: {
  loadMap: () => Promise<Loaded>
}) {
  const [examples, setExamples] = useState<Example[] | null>(null)
  const [map, setMap] = useState<Loaded | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [placed, setPlaced] = useState<Placed | null>(null)

  useEffect(() => {
    fetchJson<{ examples: Example[] }>('workers-ai/debate/examples.json').then(
      (e) => setExamples(e.examples),
      () => setExamples([]),
    )
  }, [])
  useEffect(() => {
    if (examples?.length) loadMap().then(setMap, () => setExamples([]))
  }, [examples, loadMap])

  const warm = () => void loadCorpus<Item>('debate').catch(() => {})

  async function run(vector: Promise<number[]>) {
    setBusy(true)
    setNotice(null)
    try {
      const [corpus, v] = await Promise.all([
        loadCorpus<Item>('debate'),
        vector,
      ])
      const neighbours = nearest(corpus, v, K)
      setPlaced({
        ...place(neighbours.map((n) => ({ ...n.item, score: n.score }))),
        neighbours,
      })
    } catch (error) {
      setNotice(
        error instanceof Unavailable
          ? fallback(error.reason)
          : l(
              'The passage vectors did not load.',
              'Passagernas vektorer kunde inte läsas.',
            ),
      )
    } finally {
      setBusy(false)
    }
  }

  const group = placed
    ? placed.cluster < 0
      ? l('no clear group', 'ingen tydlig grupp')
      : (map?.name?.(placed.cluster) ?? String(placed.cluster))
    : ''
  const marker = useMemo(
    () =>
      placed && {
        x: placed.x,
        y: placed.y,
        label: `${l('Your sentence', 'Din mening')}: ${group}`,
      },
    [placed, group],
  )
  const parties = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { item } of placed?.neighbours ?? [])
      counts.set(item.party, (counts.get(item.party) ?? 0) + 1)
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([party, value]) => ({ key: party, label: party, value, party }))
  }, [placed])

  if (!examples?.length) return null
  return (
    <section
      className="cv-place"
      aria-labelledby="cv-place-title"
      id="cv-place"
    >
      <header className="cv-head">
        <p className="cv-project">
          <a href="#politik-tal">Political Observatory · Workers AI</a>
        </p>
        <h2 id="cv-place-title">
          {l(
            'Your sentence on the party-leader debate map',
            'Din mening på kartan över partiledardebatterna',
          )}
        </h2>
        <p className="cv-meaning">
          {l(
            'Write a sentence about politics. It lands among the debate passages that are closest to it in meaning, and the panel shows which group they form, what was said and by which parties. Your text goes to Cloudflare Workers AI to be embedded and is not logged or stored.',
            'Skriv en mening om politik. Den hamnar bland de debattpassager som ligger närmast i betydelse, och panelen visar vilken grupp de bildar, vad som sades och av vilka partier. Texten skickas till Cloudflare Workers AI för inbäddning och loggas eller sparas inte.',
          )}
        </p>
      </header>
      <form
        className="cv-place-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) run(embed(text.trim()))
        }}
      >
        <label htmlFor="cv-place-text">
          {l('Your sentence', 'Din mening')}
        </label>
        <textarea
          id="cv-place-text"
          rows={2}
          maxLength={MAX}
          value={text}
          onFocus={warm}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="cv-place-count"
        />
        <div className="cv-place-actions">
          <span id="cv-place-count" className="cv-place-count">
            {text.length} / {MAX}
          </span>
          <button type="submit" className="btn" disabled={busy || !text.trim()}>
            {busy ? l('Placing…', 'Placerar…') : l('Place it', 'Placera')}
          </button>
        </div>
        <div
          className="cv-variants"
          role="group"
          aria-label={l('Examples', 'Exempel')}
        >
          {examples.map((e) => (
            <button
              key={e.text}
              type="button"
              disabled={busy}
              onClick={() => {
                setText(e.text)
                run(Promise.resolve(e.vector))
              }}
            >
              {e.text}
            </button>
          ))}
        </div>
      </form>
      {notice && (
        <p className="cv-place-notice" role="status">
          {notice}
        </p>
      )}
      <div className="cv-place-grid">
        {map ? (
          <ClusterScatter
            points={map.points}
            name={map.name}
            label={l(
              'Party-leader debates by subject',
              'Partiledardebatter efter ämne',
            )}
            height={620}
            marker={marker ?? undefined}
          />
        ) : (
          <p className="cv-status" role="status">
            {l('Loading…', 'Laddar…')}
          </p>
        )}
        <div className="cv-place-panel" aria-live="polite">
          {placed ? (
            <>
              <p className="cv-place-label">{l('Lands in', 'Hamnar i')}</p>
              <p className="cv-place-group">{group}</p>
              <h3>
                {l('The five nearest passages', 'De fem närmaste passagerna')}
              </h3>
              <ol className="cv-place-list">
                {placed.neighbours.slice(0, 5).map(({ item }) => (
                  <li key={item.id}>
                    <p className="cv-place-who">
                      {item.party} · {item.speaker} · {item.year}
                    </p>
                    <p>“{cut(item.text)}”</p>
                    <a href={item.url}>
                      {l('Read the speech', 'Läs anförandet')}
                    </a>
                  </li>
                ))}
              </ol>
              <h3>
                {l(
                  `Parties among the ${K} nearest passages`,
                  `Partier bland de ${K} närmaste passagerna`,
                )}
              </h3>
              <RankBars
                rows={parties}
                format={(n) => String(n)}
                max={K}
                label={l(
                  `Passages per party among the ${K} nearest`,
                  `Passager per parti bland de ${K} närmaste`,
                )}
              />
            </>
          ) : (
            <p className="cv-place-empty">
              {l(
                'Write a sentence or pick an example. Its nearest passages appear here.',
                'Skriv en mening eller välj ett exempel. De närmaste passagerna visas här.',
              )}
            </p>
          )}
        </div>
      </div>
      <p className="cv-specs">
        {l(
          'The sentence is embedded with bge-m3 and placed among its 15 nearest passages. The placement is an approximation, not a new UMAP run.',
          'Meningen bäddas in med bge-m3 och placeras bland sina 15 närmaste passager. Placeringen är en approximation, inte en ny UMAP-körning.',
        )}
      </p>
    </section>
  )
}
