import { useEffect } from 'react'

/** Ease mouse-wheel travel; touch, keyboard and nested scroll areas stay native. */
export function useSlowScroll() {
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let target = scrollY
    let position = scrollY
    let previous = 0
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previous = 0
    }
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(now - previous, 50) : 16
      previous = now
      const distance = target - position
      position += distance * (1 - Math.exp(-elapsed / 120))
      window.scrollTo({
        top: position,
        behavior: 'instant',
      })
      if (Math.abs(distance) > 0.5) frame = requestAnimationFrame(tick)
      else {
        window.scrollTo({ top: target, behavior: 'instant' })
        stop()
      }
    }
    const wheel = (event: WheelEvent) => {
      if (
        preference.matches ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return
      let element = event.target instanceof Element ? event.target : null
      while (element && element !== document.documentElement) {
        if (
          element.scrollHeight > element.clientHeight &&
          /auto|scroll/.test(getComputedStyle(element).overflowY)
        )
          return
        element = element.parentElement
      }
      event.preventDefault()
      if (!frame) target = position = scrollY
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1)
      target = Math.max(
        0,
        Math.min(
          document.documentElement.scrollHeight - innerHeight,
          target + delta * 0.82,
        ),
      )
      if (!frame) frame = requestAnimationFrame(tick)
    }
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', stop)
    window.addEventListener('pointerdown', stop)
    window.addEventListener('hashchange', stop)
    preference.addEventListener('change', stop)
    return () => {
      stop()
      window.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', stop)
      window.removeEventListener('pointerdown', stop)
      window.removeEventListener('hashchange', stop)
      preference.removeEventListener('change', stop)
    }
  }, [])
}
