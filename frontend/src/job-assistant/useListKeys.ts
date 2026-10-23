/**
 * The board's keyboard: the arrow keys (or j/k) move between the result cards and Enter opens
 * one, as links do; / goes to the search, Escape clears it or closes an open ad, and 1-9 set a
 * status through the shown decision block's own setter.
 */
import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { STATUSES, type Status } from './data'

type Keys = {
  search: RefObject<HTMLInputElement | null>
  list: RefObject<HTMLOListElement | null>
  /** Clears the search text; false when there was none. */
  clearSearch: () => boolean
  /** Closes the open ad; absent when none is open. */
  close?: () => void
  /** Set while the owner's decision block is shown. */
  statusKey: MutableRefObject<((status: Status) => void) | null>
}

export function useListKeys(k: Keys) {
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.isComposing ||
        e.defaultPrevented
      )
        return
      if (e.key === 'Escape') {
        if (target === k.search.current && k.clearSearch()) return
        k.close?.()
        return
      }
      if (target.closest('input, textarea, select, summary')) return
      const cards = [
        ...(k.list.current?.querySelectorAll<HTMLElement>('.ja-card') ?? []),
      ]
      const at = cards.indexOf(target)
      const down = e.key === 'ArrowDown' || e.key === 'j'
      const up = e.key === 'ArrowUp' || e.key === 'k'
      // Arrow keys move between cards only from the list; elsewhere they scroll the page.
      if (
        (down || up) &&
        (at >= 0 || (!e.key.startsWith('Arrow') && cards.length))
      ) {
        e.preventDefault()
        const next =
          at < 0
            ? 0
            : Math.min(Math.max(at + (down ? 1 : -1), 0), cards.length - 1)
        cards[next].focus()
      } else if (e.key === '/') {
        e.preventDefault()
        k.search.current?.focus()
      } else if (/^[1-9]$/.test(e.key)) {
        k.statusKey.current?.(STATUSES[Number(e.key) - 1])
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
}
