/**
 * The chosen parties, shared by every page of the politics product. The party bar sets them,
 * every theme and the dashboard read them. The choice lives in the address
 * (`#politik-budget?partier=S,V`) so a view can be shared, and in the session so it follows
 * the reader from page to page. No parties chosen means every party.
 */
import { useCallback } from 'react'
import { RIKSDAG_PARTIES } from '../parties/identity'
import { setHashParams, type Route } from '../router'

const KEY = 'politik-partier'

/** The parties in the address, in the order they were chosen. `parti=` is the older form. */
export function partiesOf(params: URLSearchParams): string[] {
  const raw = params.get('partier') ?? params.get('parti') ?? ''
  return [...new Set(raw.split(','))].filter((p) => RIKSDAG_PARTIES.includes(p))
}

export function storedParties(): string[] {
  try {
    return partiesOf(
      new URLSearchParams({ partier: sessionStorage.getItem(KEY) ?? '' }),
    )
  } catch {
    return []
  }
}

function store(parties: string[]) {
  try {
    sessionStorage.setItem(KEY, parties.join(','))
  } catch {
    // Private mode: the choice still lives in the address.
  }
}

/** The address for a path with the current choice of parties, e.g. for links between pages. */
export function withParties(path: string, parties: string[]) {
  return parties.length ? `${path}?partier=${parties.join(',')}` : path
}

export function useParties(route: Route) {
  const selected = partiesOf(route.params)
  const set = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(route.params)
      params.delete('parti')
      if (next.length) params.set('partier', next.join(','))
      else params.delete('partier')
      store(next)
      setHashParams(route.path, params)
    },
    [route.path, route.params.toString()],
  )
  const toggle = useCallback(
    (party: string) =>
      set(
        selected.includes(party)
          ? selected.filter((p) => p !== party)
          : [...selected, party],
      ),
    [set, selected.join()],
  )
  const clear = useCallback(() => set([]), [set])
  return { selected, set, toggle, clear }
}

/**
 * Keeps the choice when the reader moves to another page: a politics address without parties
 * gets the parties chosen earlier in the session, and an address with parties is remembered.
 */
export function carryParties(route: Route) {
  const inAddress = partiesOf(route.params)
  if (inAddress.length) {
    store(inAddress)
    return
  }
  if (route.params.has('partier')) return
  const stored = storedParties()
  if (!stored.length) return
  const params = new URLSearchParams(route.params)
  params.set('partier', stored.join(','))
  setHashParams(route.path, params)
}

/** The chosen parties, or the given default when none are chosen, in the Riksdag's order. */
export function shownParties(selected: string[], fallback = RIKSDAG_PARTIES) {
  const list = selected.length ? selected : fallback
  return RIKSDAG_PARTIES.filter((p) => list.includes(p))
}
