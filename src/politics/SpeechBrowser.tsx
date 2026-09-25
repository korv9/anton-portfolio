import { currentLocale, t } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { PARTIES, useData } from './data'

type Card = { speech_id: string; speaker: string; party: string; speech_date: string; speech_number: number; is_reply: boolean; kind: string; session: string; title: string; path: string; first: number | null; last: number | null; excerpt: string }
type Speech = { speech_id: string; speaker: string; party: string; speech_number: number; speech_text: string; source_url: string }

function Reader({ card }: { card: Card }) {
  const reader = useRef<HTMLElement>(null)
  useEffect(() => {
    reader.current?.focus({ preventScroll: true })
    if (window.innerWidth <= 800) reader.current?.scrollIntoView({ block: 'start' })
  }, [])
  const { data, error } = useData<{ data: Speech[] }>('parliament/' + card.path)
  const [selected, setSelected] = useState(card.speech_id)
  const speeches = (data?.data ?? []).filter(s => s.speech_number >= (card.first ?? -1) && s.speech_number <= (card.last ?? Infinity))
  const index = speeches.findIndex(s => s.speech_id === selected)
  const speech = speeches[index]
  return <article className="speech-reader" aria-label={t("Selected speech")} ref={reader} tabIndex={-1}>
    <p className="eyebrow">{t("Read in context · ")}{card.speech_date}</p><h3 lang="sv">{card.title}</h3>
    {error && <p role="alert">{error}</p>}{!data && !error && <p role="status">{t("Loading the full debate…")}</p>}
    {speech && <><h4>{speech.speaker} · {speech.party}</h4><p>{t("Speech ")}{index + 1} {t("of ")}{speeches.length} {t("in this discussion. Neighbouring speeches follow the parliamentary order; this does not establish who replied to whom.")}</p>
      <div className="table-pagination"><button disabled={index <= 0} onClick={() => setSelected(speeches[index - 1].speech_id)}>{t("Previous speech")}</button><button disabled={index >= speeches.length - 1} onClick={() => setSelected(speeches[index + 1].speech_id)}>{t("Next speech")}</button></div>
      <p className="source-text" lang="sv">{speech.speech_text}</p><a href={speech.source_url} target="_blank" rel="noreferrer">{t("Read this speech at the Swedish Parliament ↗")}</a>
      <details><summary>{t("Other speakers in this discussion (")}{speeches.length})</summary><div className="speaker-order">{speeches.map(s => <button key={s.speech_id} aria-pressed={selected === s.speech_id} onClick={() => setSelected(s.speech_id)}>{s.speech_number}. {s.speaker} · {s.party}</button>)}</div></details>
    </>}
  </article>
}

export default function SpeechBrowser() {
  const manifest = useData<{ session: string; count: number; path: string }[]>('index.json', '/data/discovery/')
  const [party, setParty] = useState('All')
  const [session, setSession] = useState('2025/26')
  const { data, error } = useData<Card[]>(manifest.data?.find(s => s.session === session)?.path ?? null, '/data/discovery/')
  const [kind, setKind] = useState('All')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(12)
  const [selected, setSelected] = useState<Card | null>(null)
  const reset = () => { setLimit(12); setSelected(null) }
  const matches = (data ?? []).filter(s => (party === 'All' || s.party === party) && (session === 'All' || s.session === session) && (kind === 'All' || s.kind === kind) && `${s.speaker} ${s.title} ${s.excerpt}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="report speech-browser" id="data-explorer">
    <p className="eyebrow">{t("Explore Swedish politics")}</p><h2>{t("What did they actually say?")}</h2>
    <p className="report-intro">{t("Pick a politician, party or debate. Read their own words, then move through the surrounding discussion. You do not need to know how the underlying data is organised.")}</p>
    <div className="politics-journey"><a href="#speech-search"><strong>{t("Read the speeches")}</strong><span>{t("People, parties and debates")}</span></a><a href="#budget-comparison"><strong>{t("Compare budget priorities")}</strong><span>{t("Proposals and spending areas")}</span></a><a href="#politics-votes"><strong>{t("See how they voted")}</strong><span>{t("Proposals, party votes and reservations")}</span></a><a href="#politics-laws"><strong>{t("Read the legal sources")}</strong><span>{t("Imported law snapshots")}</span></a></div>
    <p className="evidence-note">{t("These are imported parliamentary records, not complete political coverage. Original quotations remain in Swedish. Some source exports contain damaged characters; open the parliamentary source to verify the wording. Browsing speeches and budgets side by side does not establish a formal link between them.")}</p>
    <div className="politics-controls" id="speech-search">
      <label>{t("Find a politician or debate")}<input type="search" value={query} onChange={e => { setQuery(e.target.value); reset() }} placeholder={t("Name, debate title or opening words")} /></label>
      <label>{t("Party")}<select value={party} onChange={e => { setParty(e.target.value); reset() }}><option value="All">{t("All")}</option>{[...new Set([...PARTIES, ...(data ?? []).map(s => s.party)])].sort().map(p => <option key={p}>{p}</option>)}</select></label>
      <label>{t("Parliamentary year")}<select value={session} onChange={e => { setSession(e.target.value); reset() }}>{(manifest.data ?? []).map(s => <option key={s.session}>{s.session}</option>)}</select></label>
      <label>{t("Discussion type")}<select value={kind} onChange={e => { setKind(e.target.value); reset() }}><option value="All">{t("All discussions")}</option><option value="leaders">{t("Party-leader debates")}</option><option value="issues">{t("Issue debates")}</option></select></label>
    </div><p>{t("Search covers names, debate titles and opening excerpts within the selected parliamentary year. Open a speech to read the full text.")}</p>
    {(error || manifest.error) && <p role="alert">{error || manifest.error}</p>}{!data && !error && !manifest.error && <p role="status">{t("Loading speeches…")}</p>}
    {data && <><p aria-live="polite">{matches.length.toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')} {t("speeches found · newest first")}</p><div className="speech-browse-layout"><div><div className="speech-cards">{matches.slice(0, limit).map(s => <button className="speech-card" key={s.kind + s.speech_id} aria-pressed={selected === s} onClick={() => setSelected(s)}><small>{s.speech_date} · {s.party} · {t(s.is_reply ? 'Reply' : 'Speech')}</small><strong>{s.speaker}</strong><span lang="sv">{s.title}</span><p lang="sv">{s.excerpt}…</p><b>{t("Read full speech →")}</b></button>)}</div>{!matches.length && <p>{t("No speeches match. Try another year, party or search term.")}</p>}{matches.length > limit && <button className="archive-more" onClick={() => setLimit(limit + 12)}>{t("Show more speeches")}</button>}</div>{selected ? <Reader key={selected.kind + selected.speech_id} card={selected} /> : <aside className="speech-reader"><h3>{t("Start with a person or a question.")}</h3><p>{t("Select a speech to read it here. You can then follow the next speaker and explore the debate in order.")}</p></aside>}</div></>}
  </section>
}
