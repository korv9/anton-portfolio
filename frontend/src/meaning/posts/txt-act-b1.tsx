/** AI Act duties: who carries the obligations and which risk tier they attach to. */
import { Frame, useData, type Post } from '../kit'
import { Bars, count } from './txt-kit'

type Obligation = {
  actor_id: string
  requirement_type: string
  risk_class_id: string
  applies_from: string
}
type Field = 'actor_id' | 'risk_class_id'
const OBL = 'ai-act/obligations.json'
const d = 'ai-act'

/** Plain names for the Act's actor and risk-class ids. */
const ACTOR: Record<string, string> = {
  provider: 'Provider',
  deployer: 'Deployer',
  gpai_provider: 'General-purpose AI provider',
  importer: 'Importer',
  distributor: 'Distributor',
}
const RISK: Record<string, string> = {
  high_risk: 'High-risk systems',
  transparency: 'Transparency duties',
  gpai: 'General-purpose AI models',
  gpai_systemic: 'GPAI with systemic risk',
  prohibited: 'Prohibited practices',
  all_ai_systems: 'All AI systems',
}
const NAMES: Record<Field, Record<string, string>> = {
  actor_id: ACTOR,
  risk_class_id: RISK,
}
const name = (field: Field, id: string) =>
  NAMES[field][id] ?? id.replace(/_/g, ' ')
/** Obligations per actor or tier, most first. */
const ranked = (rows: Obligation[], field: Field) =>
  [...count(rows, (o) => o[field])].sort((a, b) => b[1] - a[1])

function ByKey({ field, label }: { field: Field; label: string }) {
  const data = useData<Obligation[]>(OBL)
  return (
    <Frame data={data}>
      {(rows) => (
        <Bars
          label={label}
          format={String}
          long
          rows={ranked(rows, field).map(([k, n]) => ({
            key: k,
            label: name(field, k),
            value: n,
          }))}
        />
      )}
    </Frame>
  )
}
/** The largest group as a sentence, e.g. "25 of the 51 obligations fall on the provider". */
const lead = (field: Field, verb: string) => (rows: Obligation[]) => {
  const [[k, n]] = ranked(rows, field)
  return `${n} of the ${rows.length} obligations ${verb} ${name(field, k).toLowerCase()}`
}

export const posts: Post[] = [
  {
    id: 'txt-act-obligation-heatmap',
    domain: d,
    sources: ['ai-act/obligations.json'],
    title: lead('actor_id', 'fall on the'),
    note: 'Obligations in the AI Act per actor, from the consolidated text',
    render: () => (
      <ByKey field="actor_id" label="Obligations per actor, most first" />
    ),
  },
  {
    id: 'txt-act-risk-donut',
    domain: d,
    sources: ['ai-act/obligations.json'],
    title: lead('risk_class_id', 'concern'),
    note: 'Obligations in the AI Act per risk tier, from the consolidated text',
    render: () => (
      <ByKey
        field="risk_class_id"
        label="Obligations per risk tier, most first"
      />
    ),
  },
]
