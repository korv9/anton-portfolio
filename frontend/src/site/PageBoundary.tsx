/**
 * A page that fails while drawing shows a short message instead of taking the whole site
 * down: the header, breadcrumb and footer stay, and the reader can go elsewhere. Keyed by the
 * page in App, so moving to another page tries again (views inside a page keep their state).
 */
import { Component, type ReactNode } from 'react'
import { l } from '../i18n'

export class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="page-failed ds-container" role="alert">
        <h1>{l('This page could not be shown', 'Sidan kunde inte visas')}</h1>
        <p>
          {l(
            'Something went wrong while drawing it. The rest of the site works; try reloading, or pick another project.',
            'Något gick fel när den ritades. Resten av sajten fungerar; ladda om sidan eller välj ett annat projekt.',
          )}
        </p>
        <p>
          <button
            type="button"
            className="btn"
            onClick={() => window.location.reload()}
          >
            {l('Reload', 'Ladda om')}
          </button>{' '}
          <a className="btn-quiet" href="#alla-projekt">
            {l('All projects', 'Alla projekt')}
          </a>
        </p>
      </section>
    )
  }
}
