/**
 * The reader's marks (saved, applied, closed), one localStorage key per ad, so they survive
 * sessions on this device for anyone. With the owner token and a working owner store, the store's
 * statuses are read on load and win, and each change is written there too (docs/job-assistant.md).
 */
import { FROM_STORE, MINE, type Mine, type Review } from './model.ts'

const PREFIX = 'job-assistant-status:'

/** Every mark kept on this device; empty where storage is blocked. */
export function readLocal(): Record<string, Mine> {
  const out: Record<string, Mine> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const v = localStorage.getItem(key) as Mine
      if (MINE.includes(v)) out[key.slice(PREFIX.length)] = v
    }
  } catch {
    /* storage blocked: marks last for this page only */
  }
  return out
}

/** Keeps one mark on this device, or removes it. */
export function writeLocal(id: string, mark: Mine | undefined) {
  try {
    if (mark) localStorage.setItem(PREFIX + id, mark)
    else localStorage.removeItem(PREFIX + id)
  } catch {
    /* storage blocked */
  }
}

/** The device's marks with the owner store's on top: an ad the store has wins, even as unmarked. */
export function merge(
  local: Record<string, Mine>,
  stored: Record<string, Review>,
): Record<string, Mine> {
  const out = { ...local }
  for (const [id, r] of Object.entries(stored)) {
    const mark = FROM_STORE[r.status]
    if (mark) out[id] = mark
    else delete out[id]
  }
  return out
}
