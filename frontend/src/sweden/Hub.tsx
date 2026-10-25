/**
 * The SWEDEN hub (#sweden): the platform's question and its seven research pages as a list over
 * the shared 3D map, every municipality coloured by C's similarity group. The map is the same
 * scene engine the products use; without WebGL the list stands on its own.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import type { Geometry } from './map'
import { SWEDEN_PRODUCTS } from './products'
import { GROUP_HEX } from './SimilarityStage'
import { StatusStamp, SwedenMasthead } from './template'

const MunicipalityField = lazy(() => import('./MunicipalityField'))
const b = (text: { en: string; sv: string }) => l(text.en, text.sv)

type Muni = {
  code: string
  name: string
  finer?: number
  population: number | null
}

export default function Hub() {
  const [geo, setGeo] = useState<Geometry | null>(null)
  const [munis, setMunis] = useState<Muni[] | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  useEffect(() => {
    fetchJson<Geometry>('sweden/similarity/geometry.json').then(
      setGeo,
      () => {},
    )
    fetchJson<{ municipalities: Muni[] }>(
      'sweden/similarity/municipalities.json',
    ).then(
      (d) => setMunis(d.municipalities),
      () => {},
    )
  }, [])
  const byCode = new Map((munis ?? []).map((m) => [m.code, m]))
  return (
    <article className="sweden sw-page sw-hub">
      <SwedenMasthead current="#sweden" />
      <section className="sw-scene sw-hub-scene" aria-labelledby="sw-title">
        <div className="sw-scene-visual" aria-hidden={!geo}>
          {geo && munis && (
            <Suspense fallback={null}>
              <MunicipalityField
                geo={geo}
                places={munis.map((m) => ({
                  code: m.code,
                  colour: m.finer != null ? GROUP_HEX[m.finer] : undefined,
                  height: m.finer != null ? 0.05 : null,
                }))}
                selected={picked}
                names={new Map(munis.map((m) => [m.code, m.name]))}
                onPick={(c) => setPicked(c === picked ? null : c)}
                label={l(
                  'Sweden’s municipalities coloured by similarity group',
                  'Sveriges kommuner färgade efter likhetsgrupp',
                )}
                fallback={null}
                shiftFor={(w) => (w > 760 ? -w * 0.2 : 0)}
              />
            </Suspense>
          )}
        </div>
        <div className="sw-hub-fade" aria-hidden="true" />
        <div className="sw-hub-intro">
          <h1 id="sw-title">
            {l(
              'What do we measure, what do we value, and what do we overlook?',
              'Vad mäter vi, vad värderar vi, och vad förbiser vi?',
            )}
          </h1>
          <p className="sw-hub-lead">
            {l(
              'Six research products on measurement, work, similarity, belonging, imagined futures and the welfare contract in Sweden, built on public data with their methods and limits in view.',
              'Sex forskningsprodukter om mätning, arbete, likhet, tillhörighet, föreställda framtider och välfärdskontraktet i Sverige, byggda på offentliga data med metod och begränsningar synliga.',
            )}
          </p>
          <ol className="sw-doors">
            {SWEDEN_PRODUCTS.map((p) => (
              <li key={p.id}>
                <a href={p.href}>
                  <span className="sw-door-id">
                    {p.id === 'X' ? '×' : p.id}
                  </span>
                  <span>
                    <span className="sw-door-name">{b(p.title)}</span>
                    <span className="sw-door-q">{b(p.question)}</span>
                  </span>
                  <StatusStamp status={p.status} />
                </a>
              </li>
            ))}
          </ol>
        </div>
        <p className="sw-hub-caption">
          {picked && byCode.get(picked)
            ? `${byCode.get(picked)!.name} · ${l('open it in', 'öppna i')} C`
            : l(
                'Municipalities by similarity group (C), 2024. Drag to turn.',
                'Kommunerna efter likhetsgrupp (C), 2024. Dra för att vrida.',
              )}
          {picked && (
            <>
              {' '}
              <a href={`#sweden-likhet?kommun=${picked}`}>→</a>
            </>
          )}
        </p>
      </section>
    </article>
  )
}
