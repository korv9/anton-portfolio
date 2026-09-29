/**
 * One question, start to finish: retrieve → claims (model or extractor) → Allegoria → answer
 * with sources, labels, certainty and a trace of every step.
 */
import { certainty, checkAll, stats, statsLine } from './allegoria.ts'
import { extractClaims, type ClaimModel } from './claims.ts'
import { entities } from './entities.ts'
import type { Retriever } from './retrieve.ts'
import type { Annotation, Answer } from './types.ts'

export type AskDeps = {
  retriever: Retriever
  /** Without a model the extractor makes the claims. */
  model?: ClaimModel | null
  annotations?: Annotation[]
  dataVersion: string
}

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

export async function ask(question: string, deps: AskDeps): Promise<Answer> {
  const timings: Record<string, number> = {}
  let t = now()
  const found = entities(question)
  const passages = await deps.retriever.retrieve(question)
  timings.retrieve = Math.round(now() - t)

  t = now()
  let modelName = 'ingen (extraktiv, utan språkmodell)'
  let set = extractClaims(question, passages, found)
  if (deps.model && passages.length) {
    try {
      set = await deps.model.claims(question, passages)
      modelName = set.model ?? deps.model.name
    } catch (error) {
      modelName = `ingen: ${deps.model.name} svarade inte (${(error as Error).message}), extraktivt svar i stället`
    }
  }
  timings.claims = Math.round(now() - t)

  t = now()
  const checked = checkAll(set.claims, passages, deps.annotations ?? [])
  timings.check = Math.round(now() - t)

  const s = stats(passages.length, checked.claims)
  let level = certainty(s)
  let lead = !passages.length
    ? 'Otillräckligt underlag: inga källor i indexet matchar frågan. Pröva att nämna ett parti, ett år eller ett ämne som riksdagen har debatterat.'
    : set.lead
  // Say which named parties the facts leave out, rather than letting silence suggest zero.
  const measured = found.intents.some((i) =>
    ['budget', 'poll', 'election', 'agreement', 'record'].includes(i),
  )
  const covered = new Set(
    passages.filter((p) => p.kind === 'datapoint').flatMap((p) => p.parties),
  )
  const missing = found.parties.filter((p) => !covered.has(p))
  if (measured && passages.length && missing.length)
    lead += ` Källorna har inga uppgifter om ${missing.join(' och ')} för det som efterfrågas.`
  if (found.unknownParties.length)
    lead += ` Indexet täcker bara riksdagens åtta partier; om ${found.unknownParties.join(' och ')} finns inga källor.`
  // A question about change over time is only answered by reviewed annotations.
  const ids = new Set(passages.map((p) => p.id))
  const reviewed = (deps.annotations ?? []).some((a) =>
    a.about.some((id) => ids.has(id)),
  )
  if (found.intents.includes('change') && !reviewed && passages.length) {
    lead +=
      ' Om något har skärpts eller lättats över tid visas bara med granskade annoteringar, och sådana finns inte för de här källorna; svaret visar vad som sagts och beslutats, inte förändringen.'
    if (level === 'Hög') level = 'Medel'
  }
  return {
    question,
    lead,
    claims: checked.claims,
    certainty: level,
    stats: s,
    statsLine: statsLine(s),
    trace: {
      question,
      entities: found,
      retriever: deps.retriever.name,
      passages,
      claims: checked.claims,
      conflicts: checked.conflicts,
      model: modelName,
      dataVersion: deps.dataVersion,
      timingsMs: timings,
    },
  }
}
