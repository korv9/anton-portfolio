/** Loading the AI Act Observatory's files, once per session. */
import { useEffect, useState } from 'react'
import { fetchData } from '../dataSource'
import type { AiActData } from './types'

let pending: Promise<AiActData> | null = null
const texts: Partial<Record<'en' | 'sv', Promise<Record<string, string>>>> = {}

async function json<T>(path: string): Promise<T> {
  const response = await fetchData(`ai-act/${path}`)
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json() as Promise<T>
}

export function loadAiAct(): Promise<AiActData> {
  if (!pending)
    pending = Promise.all([
      json<AiActData['summary']>('summary.json'),
      json<AiActData['articles']>('articles.json'),
      json<AiActData['chapters']>('chapters.json'),
      json<AiActData['actors']>('actors.json'),
      json<AiActData['riskClasses']>('risk-classes.json'),
      json<AiActData['obligations']>('obligations.json'),
      json<AiActData['timeline']>('timeline.json'),
      json<AiActData['changes']>('changes.json'),
      json<AiActData['documents']>('documents.json'),
      json<AiActData['guidance']>('guidance.json'),
      json<AiActData['navigator']>('navigator.json'),
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
  if (!texts[lang]) texts[lang] = json(`article-text-${lang}.json`)
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
