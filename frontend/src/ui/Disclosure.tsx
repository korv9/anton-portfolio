/**
 * The one disclosure on the site: a native <details> with a quiet "+" summary, for anything that
 * waits until the reader asks (an experience's details, the full stack, method notes).
 */
import type { ReactNode } from 'react'

export function Disclosure({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <details className={`disclosure${className ? ` ${className}` : ''}`}>
      <summary>{label}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  )
}
