/** Loading the AI Act Observatory's files, once per session. */
import { useEffect, useState } from 'react'
import { fetchData } from '../dataSource'
import type { AiActData } from './types'
import type { PoliticsData, SimilarityRow } from './politicsTypes'

let pending: Promise<AiActData> | null = null
const texts: Partial<Record<'en' | 'sv', Promise<Record<string, string>>>> = {}

async function json<T>(path: string): Promise<T> {
  const response = await fetchData(path)
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json() as Promise<T>
}

export function loadAiAct(): Promise<AiActData> {
  if (!pending)
    pending = Promise.all([
      json<AiActData['summary']>('ai-act/summary.json'),
      json<AiActData['articles']>('ai-act/articles.json'),
      json<AiActData['chapters']>('ai-act/chapters.json'),
      json<AiActData['actors']>('ai-act/actors.json'),
      json<AiActData['riskClasses']>('ai-act/risk-classes.json'),
      json<AiActData['obligations']>('ai-act/obligations.json'),
      json<AiActData['timeline']>('ai-act/timeline.json'),
      json<AiActData['changes']>('ai-act/changes.json'),
      json<AiActData['documents']>('ai-act/documents.json'),
      json<AiActData['guidance']>('ai-act/guidance.json'),
      json<AiActData['navigator']>('ai-act/navigator.json'),
    ]).then(
      ([
        summary,
        articles,
        chapters,
        actors,
        riskClasses,
        obligations,
        timeline,
        changes,
        documents,
        guidance,
        navigator,
      ]) => ({
        summary,
        articles,
        chapters,
        actors,
        riskClasses,
        obligations,
        timeline,
        changes,
        documents,
        guidance,
        navigator,
      }),
    )
  pending.catch(() => {
    pending = null
  })
  return pending
}

/** The verbatim text of every article and annex in one language, by id (art_6, anx_III). */
export function loadTexts(lang: 'en' | 'sv') {
  if (!texts[lang]) texts[lang] = json(`ai-act/article-text-${lang}.json`)
  return texts[lang]!
}

export function useAiAct() {
  const [data, setData] = useState<AiActData | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    loadAiAct()
      .then((d) => live && setData(d))
      .catch(() => live && setError(true))
    return () => {
      live = false
    }
  }, [])
  return { data, error }
}

let politics: Promise<PoliticsData> | null = null
let similarity: Promise<SimilarityRow[]> | null = null

export function loadPolitics(): Promise<PoliticsData> {
  if (!politics)
    politics = Promise.all([
      json<PoliticsData['summary']>('ai-act/politics/summary.json'),
      json<PoliticsData['monthly']>('ai-act/politics/monthly.json'),
      json<PoliticsData['partyYear']>('ai-act/politics/party-year.json'),
      json<PoliticsData['concepts']>('ai-act/politics/concepts.json'),
      json<PoliticsData['framing']>('ai-act/politics/framing.json'),
      json<PoliticsData['examples']>('ai-act/politics/examples.json'),
    ]).then(([summary, monthly, partyYear, concepts, framing, examples]) => ({
      summary,
      monthly,
      partyYear,
      concepts,
      framing,
      examples,
    }))
  politics.catch(() => {
    politics = null
  })
  return politics
}

/** The AI Act ↔ Riksdag similarity pairs, loaded only when that part is opened. */
export function loadSimilarity(): Promise<SimilarityRow[]> {
  if (!similarity)
    similarity = json<SimilarityRow[]>('ai-act/politics/similarity.json')
  return similarity
}
