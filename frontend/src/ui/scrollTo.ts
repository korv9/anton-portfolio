/**
 * Scrolls an element into view: a glide within a page, a jump on landing from another page
 * (`glide: false`) or under reduced motion. The target's scroll-margin sets the offset.
 */
export function scrollToElement(
  el: Element | null | undefined,
  {
    block = 'start',
    glide = true,
  }: { block?: ScrollLogicalPosition; glide?: boolean } = {},
) {
  const still = !glide || matchMedia('(prefers-reduced-motion: reduce)').matches
  el?.scrollIntoView({ block, behavior: still ? 'instant' : 'smooth' })
}
