/**
 * The five-step path of a quoted node (lineage.ts) as one rule with five stops: the node itself in
 * the accent, the other steps secondary, and a step the path does not pass through dashed.
 */
import { l } from '../i18n'
import type { Step } from './lineage'

const STEP_NAMES: Record<Step['key'], () => string> = {
  origin: () => l('Origin', 'Källa'),
  raw: () => l('Raw', 'Rådata'),
  silver: () => l('Silver', 'Silver'),
  gold: () => l('Gold', 'Guld'),
  published: () => l('Published file', 'Publicerad fil'),
}

/** A model or file name that may wrap after each `_` and `/`. */
const breakable = (label: string) =>
  label
    .split(/(?<=[_/])/)
    .flatMap((part, i) => (i ? [<wbr key={i} />, part] : [part]))

export function LineageStrip({
  steps,
  label,
}: {
  steps: Step[]
  label: string
}) {
  return (
    <figure className="ap-lineage">
      <figcaption>
        {l(
          `Path through the platform: ${label}`,
          `Vägen genom plattformen: ${label}`,
        )}
      </figcaption>
      <ol>
        {steps.map((s) => (
          <li
            key={s.key}
            className={s.self ? 'is-self' : s.node ? undefined : 'is-missing'}
          >
            <span className="ap-step">{STEP_NAMES[s.key]()}</span>
            <span className="ap-node" translate="no">
              {s.node
                ? breakable(s.node.label)
                : l('not on this path', 'inte på vägen')}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  )
}
