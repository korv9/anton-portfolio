import { fetchJson } from '../welfare/data'
import type { ClusterPoint } from './ClusterScatter'

type DebateSegment = {
  x: number
  y: number
  topic_id: number
  topic_label: string
  speaker: string
  party: string
  session: string
  excerpt: string
}

let sessions: Promise<string[]> | null = null
const maps = new Map<
  string,
  Promise<{ points: ClusterPoint[]; names: Map<number, string> }>
>()
let completeMap: ReturnType<typeof loadDebateSession> | null = null

export function loadDebateSessions() {
  return (sessions ??= fetchJson<{ sessions: { session: string }[] }>(
    'parliament/sessions.json',
  )
    .then((data) => data.sessions.map((s) => s.session).sort())
    .catch((error) => {
      sessions = null
      throw error
    }))
}

/** Cache each published session map for repeated visits to Cluster Visuals. */
export function loadDebateSession(session: string) {
  let pending = maps.get(session)
  if (!pending) {
    pending = fetchJson<{ data: DebateSegment[] }>(
      `politics/parliament/sessions/${session.replace('/', '-')}/umap.json`,
    )
      .then(({ data }) => ({
        names: new Map(data.map((p) => [p.topic_id, p.topic_label])),
        points: data.map((p) => ({
          x: p.x,
          y: p.y,
          c: p.topic_id,
          label: `${p.speaker} (${p.party}), ${p.session}: “${p.excerpt.length > 90 ? `${p.excerpt.slice(0, 90).trimEnd()}…` : p.excerpt}”`,
        })),
      }))
      .catch((error) => {
        maps.delete(session)
        throw error
      })
    maps.set(session, pending)
  }
  return pending
}

/** The complete published map, shared by the interactive view and the home backdrop. */
export function loadDebateMap() {
  return (completeMap ??= loadDebateSessions()
    .then((sessions) =>
      Promise.all(
        sessions.map((session) =>
          loadDebateSession(session).catch(() => ({
            points: [] as ClusterPoint[],
            names: new Map<number, string>(),
          })),
        ),
      ),
    )
    .then((parts) => {
      const points = parts.flatMap((part) => part.points)
      if (!points.length)
        throw new Error('No published debate map is available')
      return {
        points,
        names: new Map(parts.flatMap((part) => [...part.names])),
      }
    })
    .catch((error) => {
      completeMap = null
      throw error
    }))
}
