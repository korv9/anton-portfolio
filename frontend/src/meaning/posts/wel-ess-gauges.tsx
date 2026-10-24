/** Trust in institutions and people, from the latest European Social Survey round. */
import { Frame, useData, type Post } from '../kit'
import { Ranked, fmt } from './wel-kit'

type Headline = {
  indicator_key: string
  period_label: string
  value: number
  previous_value: number | null
}

/** Row label and the same name inside a sentence. */
const NAMES: Record<string, [string, string]> = {
  ess_trstplc: ['The police', 'the police'],
  ess_trstlgl: ['The legal system', 'the legal system'],
  ess_trstun: ['The United Nations', 'the United Nations'],
  ess_trstprl: ['The Riksdag', 'the Riksdag'],
  ess_ppltrst: ['Most people', 'most people'],
  ess_trstep: ['The European Parliament', 'the European Parliament'],
  ess_trstprt: ['Political parties', 'political parties'],
  ess_trstplt: ['Politicians', 'politicians'],
}

/** 'ESS11 (2023-2024)' -> '2023–2024'. */
const years = (label: string) =>
  /\((\d{4})-(\d{4})\)/.exec(label)?.slice(1).join('–') ?? label

const trust = (rows: Headline[]) =>
  rows.filter((r) => r.indicator_key in NAMES).sort((a, b) => b.value - a.value)

function TrustBars() {
  return (
    <Frame data={useData<Headline[]>('welfare/headlines.json')}>
      {(rows) => (
        <Ranked
          label="Mean trust on a 0 to 10 scale, highest first"
          max={10}
          format={(v) => fmt(v, 1)}
          rows={trust(rows).map((r) => ({
            key: r.indicator_key,
            label: NAMES[r.indicator_key][0],
            value: r.value,
          }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-trust-gauges',
    domain: 'welfare',
    sources: ['welfare/headlines.json'],
    title: (rows: Headline[]) => {
      const t = trust(rows)
      if (!t.length) return 'Trust in institutions and people'
      return `In ${years(t[0].period_label)}, trust in Sweden was highest for ${NAMES[t[0].indicator_key][1]} (${fmt(t[0].value, 1)}) and lowest for ${NAMES[t.at(-1)!.indicator_key][1]} (${fmt(t.at(-1)!.value, 1)})`
    },
    note: 'Mean answer on a 0–10 scale, latest round. Source: European Social Survey',
    render: () => <TrustBars />,
  },
]
