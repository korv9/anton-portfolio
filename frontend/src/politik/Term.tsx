import { useId } from 'react'

/** A technical term with a short explanation on hover or keyboard focus. */
export function Term({ word, explain }: { word: string; explain: string }) {
  const id = useId()
  return (
    <span className="term" tabIndex={0} aria-describedby={id}>
      <dfn>{word}</dfn>
      <span role="tooltip" id={id} className="term-tip">
        {explain}
      </span>
    </span>
  )
}
