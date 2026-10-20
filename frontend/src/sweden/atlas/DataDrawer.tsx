/** The DATA drawer: every file the page reads, filled or empty, with the shape an empty one needs. */
import { SLOTS, type SlotState } from './slots'

export function DataDrawer({ slots }: { slots: Record<string, SlotState> }) {
  const list = Object.values(slots)
  const filled = list.filter((s) => s.status === 'filled').length
  return (
    <details className="sw-atlas-data">
      <summary>
        DATA · {filled} of {list.length} slots filled
      </summary>
      <ul>
        {list.map((s) => {
          const def = SLOTS[s.key]
          return (
            <li key={s.key} className={`is-${s.status}`}>
              <b>
                {s.status === 'filled' ? '●' : '○'} {def.path}
              </b>
              <span>{def.role}</span>
              {s.status !== 'filled' && (
                <>
                  <code>{def.shape}</code>
                  {'source' in def && <span>Planned: {def.source}</span>}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
