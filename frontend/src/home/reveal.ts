/**
 * Reveal on scroll: elements with the class `reveal` inside the returned ref fade and rise into
 * place the first time they come into view. Without IntersectionObserver, or with reduced
 * motion, they are simply shown (the CSS also shows them under reduced motion).
 */
import { useEffect, useRef } from 'react'

export function useReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const root = useRef<T>(null)
  useEffect(() => {
    const items = [
      ...(root.current?.querySelectorAll<HTMLElement>('.reveal:not(.in)') ??
        []),
    ]
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return root
}

/** Counts up to a number once it is in view; the final value is always the real one. */
export function countUp(
  el: HTMLElement,
  value: number,
  locale: string,
  decimals = 0,
) {
  const format = (n: number) =>
    n.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = format(value)
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / 1200)
    el.textContent = format(value * (1 - Math.pow(1 - t, 3)))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
