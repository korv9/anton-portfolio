/**
 * Hash routing for the whole site.
 *
 * A route is `#path` with optional query parameters, `#politik-valjarna?partier=S,M&fran=2010`,
 * so a chosen view can be shared as a link. Old addresses keep working: the few that the new
 * politics product replaces redirect, and the rest open as deep dives inside it.
 */
import { useEffect, useState } from 'react'

export type Page =
  | 'home'
  | 'projects'
  | 'politik'
  | 'jobs'
  | 'welfare'
  | 'drugcomb'
  | 'thesis'
  | 'homie'
  | 'lakehouse'
  | 'symbolic'
  | 'aiact'
  | 'sfs'
  | 'philosophy'
  | 'concepts'
  | 'clusters'
