/** Trust in institutions and people, from the latest European Social Survey round. */
import { Frame, useData, type Post } from '../kit'
import { Ranked, fmt } from './wel-kit'
import { l } from '../../i18n'

type Headline = {
  indicator_key: string
  period_label: string
  value: number
  previous_value: number | null
}

/** Row label and the same name inside a sentence, in English then Swedish. */
const NAMES: Record<string, [string, string, string, string]> = {
  ess_trstplc: ['The police', 'the police', 'Polisen', 'polisen'],
  ess_trstlgl: [
    'The legal system',
    'the legal system',
    'Rättsväsendet',
    'rättsväsendet',
  ],
  ess_trstun: ['The United Nations', 'the United Nations', 'FN', 'FN'],
  ess_trstprl: ['The Riksdag', 'the Riksdag', 'Riksdagen', 'riksdagen'],
  ess_ppltrst: [
    'Most people',
    'most people',
    'De flesta människor',
    'de flesta människor',
  ],
  ess_trstep: [
    'The European Parliament',
    'the European Parliament',
    'Europaparlamentet',
    'Europaparlamentet',
  ],
  ess_trstprt: [
    'Political parties',
    'political parties',
    'De politiska partierna',
    'de politiska partierna',
  ],
  ess_trstplt: ['Politicians', 'politicians', 'Politikerna', 'politikerna'],
}
const row = (k: string) => l(NAMES[k][0], NAMES[k][2])
const inText = (k: string) => l(NAMES[k][1], NAMES[k][3])

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
          label={l(
            'Mean trust on a 0 to 10 scale, highest first',
            'Medelförtroende på en skala 0–10, högst först',
          )}
          max={10}
          format={(v) => fmt(v, 1)}
          rows={trust(rows).map((r) => ({
            key: r.indicator_key,
            label: row(r.indicator_key),
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
      if (!t.length)
        return l(
          'Trust in institutions and people',
          'Förtroende för institutioner och människor',
        )
      const [hi, lo] = [t[0], t.at(-1)!]
      return l(
        `In ${years(hi.period_label)}, trust in Sweden was highest for ${inText(hi.indicator_key)} (${fmt(hi.value, 1)}) and lowest for ${inText(lo.indicator_key)} (${fmt(lo.value, 1)})`,
        `${years(hi.period_label)} var förtroendet i Sverige högst för ${inText(hi.indicator_key)} (${fmt(hi.value, 1)}) och lägst för ${inText(lo.indicator_key)} (${fmt(lo.value, 1)})`,
      )
    },
    note: [
      'Mean answer on a 0–10 scale, latest round. Source: European Social Survey',
      'Medelsvar på en skala 0–10, senaste omgången. Källa: European Social Survey',
    ],
    render: () => <TrustBars />,
  },
]
