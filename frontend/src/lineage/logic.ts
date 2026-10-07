/**
 * Idea Lineage on the page: the public events (idea-lineage/events.json) and what can be derived
 * from them without inventing anything. Mirrors platform/idea_lineage/views.py: a later event's
 * relation changes an earlier event's effective status; the journal lines are never edited.
 */
export type EventType =
  | 'idea'
  | 'decision'
  | 'hypothesis'
  | 'experiment'
  | 'finding'
  | 'question'
  | 'rejection'
  | 'implementation'
  | 'observation'

export type LineageEvent = {
  id: string
  created_at: string
  occurred_on?: string
  type: EventType
  title: string
  summary?: string
  reason?: string
  projects?: string[]
  tags?: string[]
  importance?: 'minor' | 'normal' | 'major'
  certainty?: 'proposed' | 'tentative' | 'confirmed'
  relations?: Record<string, string[]>
  implementation?: { commit?: string; pr?: string; files?: string[] }
  hypothesis?: string
  result?: string
}

export type Lineage = { generated_at: string; events: LineageEvent[] }

const INVERSE: Record<string, string> = {
  evolved_into: 'evolved_from',
  tested_by: 'tests',
  supported_by: 'supports',
  rejected_by: 'rejects',
  implemented_as: 'implements',
  resulted_in: 'results_from',
}
const ENDS: Record<string, string> = {
  supersedes: 'superseded',
  replaces: 'superseded',
  evolved_from: 'evolved',
  rejects: 'abandoned',
  answers: 'answered',
}

export const when = (e: LineageEvent) =>
  e.occurred_on ?? e.created_at.slice(0, 10)

/** (source, relation, target), passive forms turned to their active reading. */
export function links(events: LineageEvent[]): [string, string, string][] {
  const out: [string, string, string][] = []
  for (const e of events)
    for (const [rel, targets] of Object.entries(e.relations ?? {}))
      for (const t of targets)
        out.push(INVERSE[rel] ? [t, INVERSE[rel], e.id] : [e.id, rel, t])
  return out
}

/** Each event's current status and the event that changed it. */
export function effective(
  events: LineageEvent[],
): Map<string, { status: string; by?: string }> {
  const out = new Map(
    events.map((e) => [
      e.id,
      { status: e.type === 'question' ? 'open' : 'active' } as {
        status: string
        by?: string
      },
    ]),
  )
  for (const [src, rel, target] of links(events))
    if (ENDS[rel] && out.has(target))
      out.set(target, { status: ENDS[rel], by: src })
  return out
}

/** Every event `id` came from, following stored links backwards; `id` itself included. */
export function ancestors(id: string, events: LineageEvent[]): Set<string> {
  const back = new Map<string, string[]>()
  for (const [src, , target] of links(events))
    back.set(src, [...(back.get(src) ?? []), target])
  const seen = new Set<string>()
  const todo = [id]
  while (todo.length) {
    const next = todo.pop()!
    if (seen.has(next)) continue
    seen.add(next)
    todo.push(...(back.get(next) ?? []))
  }
  return seen
}

export const chronological = (events: LineageEvent[]) =>
  events
    .map((e, i) => [e, i] as const)
    .sort(([a, i], [b, j]) => when(a).localeCompare(when(b)) || i - j)
    .map(([e]) => e)

/** A project's current state: the same sections as .idea-lineage/state/<project>.md. */
export function projectState(project: string, events: LineageEvent[]) {
  const status = effective(events)
  const mine = chronological(events).filter((e) =>
    (e.projects ?? []).includes(project),
  )
  const live = mine.filter((e) =>
    ['active', 'open'].includes(status.get(e.id)!.status),
  )
  const decisions = live.filter((e) => e.type === 'decision')
  const own = decisions.filter((e) => e.projects?.[0] === project)
  const pool = own.length ? own : decisions
  const direction =
    [...pool].reverse().find((e) => e.importance === 'major') ?? pool.at(-1)
  return {
    direction,
    decisions,
    findings: live.filter((e) => e.type === 'finding').slice(-4),
    questions: mine.filter(
      (e) => e.type === 'question' && status.get(e.id)!.status === 'open',
    ),
    count: mine.length,
  }
}

/** Ideas and decisions that later events superseded or set aside, with the event that did. */
export function setAside(events: LineageEvent[]) {
  const status = effective(events)
  const byId = new Map(events.map((e) => [e.id, e]))
  return chronological(events)
    .filter((e) =>
      ['superseded', 'abandoned', 'evolved'].includes(status.get(e.id)!.status),
    )
    .map((e) => ({
      event: e,
      status: status.get(e.id)!.status,
      by: byId.get(status.get(e.id)!.by ?? ''),
    }))
}
