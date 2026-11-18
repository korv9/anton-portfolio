/** A link from the source data, only when it is an absolute https URL; anything else gets no link. */
export function https(url: string | null | undefined) {
  try {
    return url && new URL(url).protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}
