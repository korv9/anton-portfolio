/**
 * The review list's keyboard: j/k or the arrow keys move, 1-6 set a status through the shown
 * decision block's own setter, / searches and Escape clears the search.
 */
import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { STATUSES, type Row, type Status, type View } from './data'

type Keys = {
  shown: Row[]
  selected?: Row
  view: View
  setView: (view: View) => void
  search: RefObject<HTMLInputElement | null>
  select: (id: string) => void
  /** Set while the owner's decision block is shown. */
  statusKey: MutableRefObject<((status: Status) => void) | null>
  focusRow: MutableRefObject<boolean>
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
      if (target.closest('input, textarea, select') && e.key !== 'Escape')
        return
      // Arrow keys move the selection only from the list; elsewhere they scroll the page.
      const arrow = e.key === 'ArrowDown' || e.key === 'ArrowUp'
      if (arrow && !target.closest('.ja-list')) return
      const index = k.shown.findIndex((r) => r.ad.id === k.selected?.ad.id)
      if (e.key === '/') {
        e.preventDefault()
        k.search.current?.focus()
      } else if (e.key === 'Escape' && k.view.q) {
        k.setView({ ...k.view, q: '' })
      } else if (
        (e.key === 'j' || e.key === 'ArrowDown') &&
        index < k.shown.length - 1
      ) {
        e.preventDefault()
        k.select(k.shown[index + 1].ad.id)
        k.focusRow.current = true
      } else if ((e.key === 'k' || e.key === 'ArrowUp') && index > 0) {
        e.preventDefault()
        k.select(k.shown[index - 1].ad.id)
        k.focusRow.current = true
      } else if (/^[1-6]$/.test(e.key) && k.selected) {
        k.statusKey.current?.(STATUSES[Number(e.key) - 1])
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
}
