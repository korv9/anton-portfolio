/** AI Act duties: which risk tier the obligations attach to. */
import { Frame, useData, type Post } from '../kit'
import { Bars, count, heading, usable } from './txt-kit'

type Obligation = { obligation_id: string; risk_class_id: string }
type RiskClass = { risk_class_id: string; label_en: string }
const OBL = 'ai-act/obligations.json'
const RISK = 'ai-act/risk-classes.json'
const d = 'ai-act'

/** Obligations per risk tier, most first. */
const ranked = (rows: Obligation[]) =>
  [...count(rows, (o) => o.risk_class_id)].sort((a, b) => b[1] - a[1])

function RiskBars() {
  const data = usable(useData<Obligation[]>(OBL), OBL, (r) => r.length)
  const tiers = useData<RiskClass[]>(RISK)
  return (
    <Frame data={data}>
      {(rows) => (
        <Frame data={tiers}>
          {(classes) => {
            const name = new Map(
              classes.map((c) => [c.risk_class_id, c.label_en]),
            )
            return (
              <Bars
                label="Obligations per risk tier, most first"
                format={String}
                long
                rows={ranked(rows).map(([k, n]) => ({
                  key: k,
                  label: name.get(k) ?? k.replace(/_/g, ' '),
                  value: n,
                }))}
              />
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-act-risk-donut',
    domain: d,
    sources: ['ai-act/obligations.json', 'ai-act/risk-classes.json'],
    // The title reads the obligations file only, so it names the tier by its id.
    title: heading((rows: Obligation[]) => {
      const [[k, n]] = ranked(rows)
      return `${n} of the ${rows.length} obligations attach to the ${k.replace(/_/g, '-')} tier`
    }),
    note: 'Obligations in the AI Act per risk tier, from the consolidated text',
    render: () => <RiskBars />,
  },
]
