import { t } from '../i18n'
import { useState } from 'react'
import { count, useData } from './data'
import LegislativeEvidence from './LegislativeEvidence'
type Law = {
  id: string
  pool: string
  title: string
  version: string
  provisions: number
  path: string
}
type Provision = {
  provision_id: string
  label: string
  text: string
  source_url: string
  source_page_url?: string
  source_sha256: string
  document_version?: string
}

function LawText({ law }: { law: Law }) {
  const { data, error } = useData<Provision[]>(law.path)
  const [query, setQuery] = useState('')
  return (
    <div className="law-text">
      <h5>{law.title}</h5>
      <p>
        {law.version}{' '}
        {t('· snapshot, not verified as the law on a debate date.')}
      </p>
      <label>
        {t('Search provisions\n        ')}
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      {data
        ?.filter((p) => p.text.toLowerCase().includes(query.toLowerCase()))
        .map((p) => (
          <details key={p.provision_id}>
            <summary>{p.label || p.provision_id}</summary>
            <p lang="sv" className="source-text">
              {p.text}
            </p>
            <a
              href={p.source_url || p.source_page_url}
              target="_blank"
              rel="noreferrer"
            >
              {t('Statute source ↗\n            ')}
            </a>
            <small className="source-hash">
              {t('Source SHA-256: ')}
              {p.source_sha256}
            </small>
          </details>
        ))}
    </div>
  )
}

export default function LawLibrary() {
  const laws = useData<Law[]>('laws/index.json')
  const [query, setQuery] = useState('')
  const [pool, setPool] = useState('v1')
  const [lawId, setLawId] = useState('')
  const matching =
    laws.data?.filter(
      (l) =>
        l.pool === pool &&
        `${l.title} ${l.id}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? []
  const selected = matching.find((l) => l.id === lawId)
  return (
    <section className="meaning-lab">
      <h3>{t('Law texts & source evidence')}</h3>
      <p>
        {t(
          'Read the source snapshots and inspect the limits of proposed-law\n        comparisons.\n      ',
        )}
      </p>
      <section className="politics-card law-browser">
        <h4>{t('Read the source law')}</h4>
        <p>
          {t(
            'Browse both available statute provision pools, with source hashes,\n          snapshot versions and original text. Overlapping pools must not be\n          added together as unique laws.\n        ',
          )}
        </p>
        <div className="politics-controls">
          <label>
            {t('Corpus pool\n            ')}
            <select
              value={pool}
              onChange={(e) => {
                setPool(e.target.value)
                setLawId('')
              }}
            >
              <option value="v1">{t('v1 · frozen corpus')}</option>
              <option value="v2">{t('v2 · expanded pool')}</option>
            </select>
          </label>
          <label>
            {t('Search laws\n            ')}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('e.g. anställning, miljö')}
            />
          </label>
          <label>
            {t('Law snapshot\n            ')}
            <select
              value={selected?.id ?? ''}
              onChange={(e) => setLawId(e.target.value)}
            >
              <option value="">
                {t('Select from ')}
                {count(matching.length)} {t('snapshots\n              ')}
              </option>
              {matching.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {laws.error && <p role="alert">{laws.error}</p>}
        {selected && <LawText key={selected.path} law={selected} />}
      </section>
      <LegislativeEvidence />
    </section>
  )
}
