import { useCallback } from 'react'
import { setHashParams, type Route } from '../router'

/**
 * A theme's choices, kept in the address (`#politik-valjarna?partier=S,M&fran=2010`), so any
 * view can be shared or bookmarked. Values that equal the default are left out of the address.
 */
export function useViewParams<T extends Record<string, string>>(
  route: Route,
  defaults: T,
): [T, (changes: Partial<T>) => void, () => void] {
  const values = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = route.params.get(String(key))
    if (value != null) values[key] = value as T[keyof T]
  }
  const set = useCallback(
    (changes: Partial<T>) => {
      const next = new URLSearchParams(route.params)
      for (const [key, value] of Object.entries(changes)) {
        if (value == null || value === defaults[key]) next.delete(key)
        else next.set(key, String(value))
      }
      setHashParams(route.path, next)
    },
    // Defaults are literals per theme; only the route changes between calls.
    [route.path, route.params.toString()],
  )
  const reset = useCallback(
    () => setHashParams(route.path, new URLSearchParams()),
    [route.path],
  )
  return [values, set, reset]
}

/** A comma list in the address, as an array. */
export const listParam = (value: string) =>
  value ? value.split(',').filter(Boolean) : []
