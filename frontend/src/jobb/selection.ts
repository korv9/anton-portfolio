/**
 * The chosen occupation fields, shared by every page of the job-market product, like the
 * party bar in politics: in the address (`#jobb-yrken?omraden=id,id`) so a view can be
 * shared, and in the session so the choice follows the reader. None chosen means every field.
 */
import { useCallback } from 'react'
import { setHashParams, type Route } from '../router'

const KEY = 'jobb-omraden'

export function fieldsOf(params: URLSearchParams): string[] {
  return [...new Set((params.get('omraden') ?? '').split(','))].filter(Boolean)
}

function store(fields: string[]) {
  try {
    sessionStorage.setItem(KEY, fields.join(','))
  } catch {
    // Private mode: the choice still lives in the address.
  }
}

export function withFields(path: string, fields: string[]) {
  return fields.length ? `${path}?omraden=${fields.join(',')}` : path
}

export function useFields(route: Route, valid?: string[]) {
  const all = fieldsOf(route.params)
  const selected = valid ? all.filter((f) => valid.includes(f)) : all
  const set = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(route.params)
      if (next.length) params.set('omraden', next.join(','))
      else params.delete('omraden')
      store(next)
      setHashParams(route.path, params)
    },
    [route.path, route.params.toString()],
  )
  const toggle = useCallback(
    (field: string) =>
      set(
        selected.includes(field)
          ? selected.filter((f) => f !== field)
          : [...selected, field],
      ),
    [set, selected.join()],
  )
  return { selected, set, toggle, clear: () => set([]) }
}

/** A page opened without fields gets the ones chosen earlier in the session. */
export function carryFields(route: Route) {
  const inAddress = fieldsOf(route.params)
  if (inAddress.length) return store(inAddress)
  let stored: string[] = []
  try {
    stored = (sessionStorage.getItem(KEY) ?? '').split(',').filter(Boolean)
  } catch {
    return
  }
  if (!stored.length) return
  const params = new URLSearchParams(route.params)
  params.set('omraden', stored.join(','))
  setHashParams(route.path, params)
}
