/**
 * The corpus as compact rows: every book on the map with its author, translator, tradition,
 * region, genre, source type and period, how many of its passages are on the map, and a link
 * to the Gutenberg file it was read from. Filters by tradition and source type; the choice is
 * kept in the address (?korpus=, ?kalla=) so a view can be shared.
 */
import { useMemo } from 'react'
import { l } from '../i18n'
import { TRADITION } from './atlasData'
import type { AtlasDocument } from './atlasTypes'

const SOURCE_TYPE: Record<string, [string, string]> = {
  translation: ['Translation', 'Översättning'],
  retelling: ['Retelling', 'Återberättelse'],
  'folklore-collection': ['Folklore collection', 'Folkloresamling'],
  literary: ['Literary work', 'Litterärt verk'],
  'primary-english': ['Written in English', 'Skriven på engelska'],
}
const PERIOD: Record<string, [string, string]> = {
  ancient: ['Ancient', 'Antiken'],
  medieval: ['Medieval', 'Medeltid'],
  'early-modern': ['Early modern', 'Tidigmodern'],
  '19th-century': ['19th century', '1800-tal'],
  modern: ['Modern', 'Modern'],
}
const named = (map: Record<string, [string, string]>, key?: string | null) =>
  key ? (map[key] ? l(...map[key]) : key) : '–'

export default function CorpusExplorer({
  documents,
  tradition,
  sourceType,
  onFilter,
}: {
  documents: AtlasDocument[]
  tradition: string
  sourceType: string
  onFilter: (next: { korpus?: string; kalla?: string }) => void
}) {
  const traditions = useMemo(
    () => [...new Set(documents.map((d) => d.tradition))].sort(),
    [documents],
  )
  const sourceTypes = useMemo(
    () =>
      [
        ...new Set(documents.map((d) => d.source_type).filter(Boolean)),
      ].sort() as string[],
    [documents],
  )
  const rows = documents
    .filter(
      (d) =>
        (!tradition || d.tradition === tradition) &&
        (!sourceType || d.source_type === sourceType),
    )
    .sort(
      (a, b) =>
        a.tradition.localeCompare(b.tradition) ||
        a.title.localeCompare(b.title),
    )
  return (
    <div className="corpus-explorer">
      <div className="corpus-filters">
        <label>
          {l('Tradition', 'Tradition')}
          <select
            value={tradition}
            onChange={(e) => onFilter({ korpus: e.target.value })}
          >
            <option value="">{l('All', 'Alla')}</option>
            {traditions.map((t) => (
              <option key={t} value={t}>
                {named(TRADITION, t)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Source type', 'Källtyp')}
          <select
            value={sourceType}
            onChange={(e) => onFilter({ kalla: e.target.value })}
          >
            <option value="">{l('All', 'Alla')}</option>
            {sourceTypes.map((t) => (
              <option key={t} value={t}>
                {named(SOURCE_TYPE, t)}
              </option>
            ))}
          </select>
        </label>
        <p className="corpus-count" aria-live="polite">
          {l(
            `${rows.length} of ${documents.length} books`,
            `${rows.length} av ${documents.length} böcker`,
          )}
        </p>
      </div>
      <div className="atlas-table-wrap" tabIndex={0}>
        <table className="atlas-table corpus-table">
          <thead>
            <tr>
              <th scope="col">{l('Title', 'Titel')}</th>
              <th scope="col">{l('Author', 'Författare')}</th>
              <th scope="col">{l('Translator', 'Översättare')}</th>
              <th scope="col">{l('Tradition', 'Tradition')}</th>
              <th scope="col">{l('Region', 'Region')}</th>
              <th scope="col">{l('Genre', 'Genre')}</th>
              <th scope="col">{l('Source type', 'Källtyp')}</th>
              <th scope="col">{l('Period', 'Period')}</th>
              <th scope="col" className="num">
                {l('On map', 'På kartan')}
              </th>
              <th scope="col">{l('Source', 'Källa')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <th scope="row">
                  {d.title}
                  {d.pilot && (
                    <span className="corpus-pilot">
                      {l(', pilot', ', pilot')}
                    </span>
                  )}
                </th>
                <td>{d.author}</td>
                <td>{d.translator ?? '–'}</td>
                <td>{named(TRADITION, d.tradition)}</td>
                <td>{d.region ?? '–'}</td>
                <td>{d.genre ?? '–'}</td>
                <td>{named(SOURCE_TYPE, d.source_type)}</td>
                <td>{named(PERIOD, d.period)}</td>
                <td className="num">
                  {d.points.toLocaleString(l('en-GB', 'sv-SE'))}
                </td>
                <td>
                  <a href={d.source_url} target="_blank" rel="noreferrer">
                    {l(
                      `Gutenberg ${d.gutenberg_id}`,
                      `Gutenberg ${d.gutenberg_id}`,
                    )}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
