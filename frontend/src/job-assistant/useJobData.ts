/**
 * The board's data: the released files, the owner store's statuses, the reader's marks (this
 * device, with the owner store on top when it answers), and a retry.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  loadDelivered,
  loadRecords,
  remainingText,
  TO_STORE,
  write,
  type Delivered,
  type Mine,
  type Records,
} from './data'
import { merge, readLocal, writeLocal } from './mine'

/** `owner` reloads the owner store's statuses, which only the token reads. */
export function useJobData(owner: boolean) {
  const [data, setData] = useState<Delivered | null>(null)
  const [records, setRecords] = useState<Records>({
    reviews: {},
    available: false,
  })
  const [mine, setMine] = useState<Record<string, Mine>>(readLocal)
  // Set when the owner store refused a change that this device kept.
  const [unsynced, setUnsynced] = useState(false)
  const [failed, setFailed] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setFailed('')
    loadDelivered().then(setData, (e) => setFailed(String(e?.message ?? e)))
  }, [attempt])
  useEffect(() => {
    loadRecords().then((r) => {
      setRecords(r)
      if (!r.available) return
      // The owner store wins; the device keeps a copy so the marks show offline too.
      const merged = merge(readLocal(), r.reviews)
      for (const id of new Set([
        ...Object.keys(readLocal()),
        ...Object.keys(merged),
      ]))
        writeLocal(id, merged[id])
      setMine(merged)
    })
  }, [attempt, owner])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  /** Sets or clears a mark on this device, and in the owner store when it answers. */
  function mark(id: string, value: Mine | undefined) {
    writeLocal(id, value)
    setMine((m) => {
      const next = { ...m }
      if (value) next[id] = value
      else delete next[id]
      return next
    })
    if (!records.available) return
    // The stored note is kept as it is; the board no longer edits notes.
    const body = {
      status: value ? TO_STORE[value] : 'new',
      note: records.reviews[id]?.note ?? '',
    }
    write(`reviews/${id}`, 'PUT', JSON.stringify(body)).then(
      () => {
        setUnsynced(false)
        setRecords((r) => ({ ...r, reviews: { ...r.reviews, [id]: body } }))
      },
      () => setUnsynced(true),
    )
  }

  return { data, records, setRecords, mine, mark, unsynced, failed, retry }
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
