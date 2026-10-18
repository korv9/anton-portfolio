import type { MouseEvent } from 'react'
import { companyHref } from '../router'

export function CompanyLink({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const navigate = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    history.pushState(null, '', companyHref(id))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return (
    <a href={companyHref(id)} onClick={navigate}>
      {children}
    </a>
  )
}
export function Source({ url, hash }: { url: string; hash?: string }) {
  return (
    <>
      <a href={url} target="_blank" rel="noreferrer">
        Source ↗
      </a>
      {hash && (
        <small>
          SHA-256 <code>{hash}</code>
        </small>
      )}
    </>
  )
}
