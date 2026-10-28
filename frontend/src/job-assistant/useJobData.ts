/** The board's data: the released files, the owner's records, a retry, and a saved record kept in place. */
import { useCallback, useEffect, useState } from 'react'
import {
  loadDelivered,
  loadRecords,
  remainingText,
  type Delivered,
  type LabelRow,
  type Records,
  type Review,
} from './data'

/** `owner` reloads the records: statuses and notes are owner-only reads. */
export function useJobData(owner: boolean) {
  const [data, setData] = useState<Delivered | null>(null)
  const [records, setRecords] = useState<Records>({
    reviews: {},
    labels: {},
    available: false,
  })
  const [failed, setFailed] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setFailed('')
    loadDelivered().then(setData, (e) => setFailed(String(e?.message ?? e)))
  }, [attempt])
  useEffect(() => {
    loadRecords().then(setRecords)
  }, [attempt, owner])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  function saved(
    id: string,
    kind: 'review' | 'label',
    value: Record<string, unknown>,
  ) {
    const at = new Date().toISOString()
    setRecords((r) =>
      kind === 'review'
        ? {
            ...r,
            reviews: {
              ...r.reviews,
              [id]: { ...(value as Review), updated_at: at },
            },
          }
        : {
            ...r,
            labels: {
              ...r.labels,
              [id]: { ...(value as LabelRow), updated_at: at },
            },
          },
    )
  }

  return { data, records, setRecords, failed, retry, saved }
}

/**
 * An ad's full text: texts.json when it has it, else the remaining texts, fetched only once
 * `load` is true (the ad was opened, not just shown first on a wide screen).
 */
export function useAdText(
  id: string,
  published: string | undefined,
  load: boolean,
) {
  const [state, setState] = useState<{
    id: string
    text?: string
    failed?: boolean
  }>({ id })
  useEffect(() => {
    if (published || !load) return
    let live = true
    remainingText(id).then(
      (text) => live && setState({ id, text, failed: !text }),
      () => live && setState({ id, failed: true }),
    )
    return () => {
      live = false
    }
  }, [id, published, load])
  if (published) return { text: published, loading: false, failed: false }
  const mine = state.id === id ? state : { id }
  return {
    text: mine.text,
    loading: load && !mine.text && !mine.failed,
    failed: Boolean(mine.failed),
  }
}
