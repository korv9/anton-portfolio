/** The empty or loading state of a dashboard card. */
import type { ReactNode } from 'react'
import { l } from '../../i18n'
import './board.css'

export function Empty({ children }: { children?: ReactNode }) {
  return <p className="dash-empty">{children ?? l('Loading…', 'Laddar…')}</p>
}
