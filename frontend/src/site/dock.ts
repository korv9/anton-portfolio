/**
 * The site sidebar's dock: on a wide screen a product (politics, the job market) places its own
 * navigation inside the site sidebar, so the whole site has one sidebar. On a narrow screen there
 * is no dock and the product shows its navigation itself, as a horizontal menu.
 */
import { createContext, useContext } from 'react'

export const DockContext = createContext<HTMLElement | null>(null)

/** Where to render a product's navigation, or null to render it in place. */
export const useDock = () => useContext(DockContext)
