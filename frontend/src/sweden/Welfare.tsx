/**
 * F — The welfare contract (#sweden-valfard). What Swedes pay into the welfare state and how far
 * they trust each other and their institutions, against the Nordic neighbours and the OECD:
 * OECD Taxing Wages (taxes/wedge.json) and the European Social Survey's weighted means per
 * country and round (welfare/ess-countries.json), both built by the platform's welfare and
 * taxes pipelines.
 *
 * Every number on the page is computed from those two files. The two sources are shown side by
 * side, never joined: four Nordic countries are too few to relate taxes to trust.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import { productById } from './products'
import {
  EmptyState,
  ProductEmpty,
  Scene,
  SwedenResearchPage,
  type Finding,
  type Method,
  type Reading,
} from './template'

type Ess = {
  unit_type: 'country' | 'group'
  unit_code: string
  period_key: string
  survey_mode: string | null
  reference_year: number
  respondents: number
} & Record<`${Metric}_mean`, number | null>

type Wedge = {
  year: number
  source: string
  countries: {
    country_code: string
    name_en: string
    name_sv: string
    is_nordic: boolean
  }[]
  latest: {
    country_code: string
    household_type: string
    wage_level: string
    tax_wedge_pct: number
  }[]
  /** country, year, household type, tax wedge % */
  series: [string, number, string, number][]
}

const METRICS: Record<'ppltrst' | 'trstprl' | 'stflife', [string, string]> = {
  ppltrst: ['Trust in other people', 'Tillit till andra människor'],
  trstprl: ['Trust in parliament', 'Förtroende för riksdagen'],
  stflife: ['Life satisfaction', 'Livstillfredsställelse'],
}
type Metric = keyof typeof METRICS

const UNITS: Record<'SE' | 'FI' | 'NO' | 'DK' | 'EU27', [string, string]> = {
  SE: ['Sweden', 'Sverige'],
  FI: ['Finland', 'Finland'],
  NO: ['Norway', 'Norge'],
  DK: ['Denmark', 'Danmark'],
  EU27: ['EU27', 'EU27'],
}
type Unit = keyof typeof UNITS
const NEIGHBOURS: Unit[] = ['FI', 'NO', 'DK']

/** The household the page compares: a single earner without children at the average wage. */
const HOUSEHOLD = 'S_C0'
const WAGE = 'AW100'

const dec = (n: number, d = 1) =>
  n.toLocaleString(l('en-GB', 'sv-SE'), {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
const pc = (n: number) => `${dec(n)} %`
const unitName = (u: Unit) => l(...UNITS[u])

export default function Welfare() {
  const product = productById('F')
  const [ess, setEss] = useState<Ess[] | 'error' | null>(null)
  const [wedge, setWedge] = useState<Wedge | 'error' | null>(null)
  const [metric, setMetric] = useState<Metric>('ppltrst')
  useEffect(() => {
    fetchJson<Ess[]>('welfare/ess-countries.json').then(setEss, () =>
      setEss('error'),
    )
    fetchJson<Wedge>('taxes/wedge.json').then(setWedge, () => setWedge('error'))
  }, [])

  if (ess === null || wedge === null)
    return (
      <p className="sweden sw-note" role="status">
        {l('Loading…', 'Laddar…')}
      </p>
    )
  if (ess === 'error' || wedge === 'error')
    return (
      <ProductEmpty product={product}>
        <EmptyState
          state="cloud"
          shows={l(
            'What Swedes pay in tax on labour and how far they trust each other, against the Nordic neighbours and the OECD.',
            'Vad svenskar betalar i skatt på arbete och hur mycket de litar på varandra, jämfört med grannländerna och OECD.',
          )}
          needs={l(
            'taxes/wedge.json and welfare/ess-countries.json.',
            'taxes/wedge.json och welfare/ess-countries.json.',
          )}
        />
      </ProductEmpty>
    )

  // Taxes. Members have three-letter codes; the averages (OECD_REP, EU22OECD) do not.
  const country = new Map(wedge.countries.map((c) => [c.country_code, c]))
  const cname = (code: string) => {
    const c = country.get(code)
    return c ? l(c.name_en, c.name_sv) : code
  }
  const latest = new Map(
    wedge.latest
      .filter((r) => r.household_type === HOUSEHOLD && r.wage_level === WAGE)
      .map((r) => [r.country_code, r.tax_wedge_pct]),
  )
  const members = [...latest]
    .filter(([code]) => /^[A-Z]{3}$/.test(code))
    .sort((a, b) => b[1] - a[1])
  const rankOf = (code: string) => members.findIndex(([c]) => c === code) + 1
  const seriesOf = (code: string) =>
    wedge.series
      .filter((r) => r[0] === code && r[2] === HOUSEHOLD)
      .sort((a, b) => a[1] - b[1])
  const change = new Map(
    members.map(([code]) => {
      const s = seriesOf(code)
      return [code, s.length > 1 ? s.at(-1)![3] - s[0][3] : null] as const
    }),
  )
  const firstYear = Math.min(...wedge.series.map((r) => r[1]))
  const withChange = members.filter(
    ([code]) => change.get(code) != null && seriesOf(code)[0][1] === firstYear,
  )
  const byFall = [...withChange].sort(
    (a, b) => change.get(a[0])! - change.get(b[0])!,
  )
  const se = latest.get('SWE') ?? null
  const seSeries = seriesOf('SWE')
  const seFall = change.get('SWE') ?? null
  const fallRank = byFall.findIndex(([c]) => c === 'SWE') + 1
  const oecd = latest.get('OECD_REP') ?? null
  const eu22 = latest.get('EU22OECD') ?? null
  const nordic = members.filter(
    ([c]) => country.get(c)?.is_nordic && c !== 'SWE',
  )
  const above = nordic.filter(([, v]) => se != null && v > se)
  const below = nordic.filter(([, v]) => se != null && v < se)
  const listOf = (rows: [string, number][], and = 'and') => {
    const names = rows.map(([c]) => cname(c))
    return names.length > 1
      ? `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`
      : names.join('')
  }

  // Trust. A country's rounds compare only with the survey mode in view.
  const row = (u: Unit, round: string) =>
    ess.find((r) => r.unit_code === u && r.period_key === round)
  const val = (r: Ess | undefined, m: Metric) => r?.[`${m}_mean`] ?? null
  const rounds = [...new Set(ess.map((r) => r.period_key))].sort(
    (a, b) => Number(a.slice(3)) - Number(b.slice(3)),
  )
  const seRows = rounds.map((k) => row('SE', k)).filter((r): r is Ess => !!r)
  const interview = seRows.filter((r) => r.survey_mode === 'interview')
  const modeBreak = seRows.find(
    (r) => r.survey_mode && r.survey_mode !== 'interview',
  )
  const seLast = interview.at(-1)
  const lowest = interview.filter((r) => {
    const others = NEIGHBOURS.map((u) => val(row(u, r.period_key), 'ppltrst'))
    const v = val(r, 'ppltrst')
    return (
      v != null &&
      others.some((o) => o != null) &&
      others.every((o) => o == null || o > v)
    )
  })
  const band = interview
    .map((r) => val(r, 'ppltrst'))
    .filter((v): v is number => v != null)
  const breakIdx = modeBreak ? rounds.indexOf(modeBreak.period_key) : -1
  const before = breakIdx > 0 ? rounds[breakIdx - 1] : null
  const after = breakIdx >= 0 ? rounds[breakIdx + 1] : null

  const findings: Finding[] = []
  if (se != null && seFall != null && seSeries.length > 1)
    findings.push({
      key: 'wedge',
      statement: l(
        `Sweden’s tax wedge on an average wage fell by ${dec(-seFall)} points between ${seSeries[0][1]} and ${seSeries.at(-1)![1]}, the ${fallRank === 1 ? 'largest' : ordinal(fallRank) + '-largest'} fall among ${withChange.length} OECD members. At ${pc(se)} it now ranks ${ordinal(rankOf('SWE'))} of ${members.length}${above.length ? `, below ${listOf(above)}` : ''}${below.length ? ` and above ${listOf(below)}` : ''}.`,
        `Skattekilen på en genomsnittslön i Sverige sjönk med ${dec(-seFall)} procentenheter mellan ${seSeries[0][1]} och ${seSeries.at(-1)![1]}, den ${fallRank === 1 ? 'största' : fallRank === 2 ? 'näst största' : `${fallRank}:e största`} minskningen bland ${withChange.length} OECD-länder. Med ${pc(se)} ligger Sverige nu på plats ${rankOf('SWE')} av ${members.length}${above.length ? `, under ${listOf(above, 'och')}` : ''}${below.length ? ` och över ${listOf(below, 'och')}` : ''}.`,
      ),
      values: (
        <ul>
          <li>
            {l('Sweden', 'Sverige')} {seSeries[0][1]}: {pc(seSeries[0][3])};{' '}
            {seSeries.at(-1)![1]}: {pc(se)}
          </li>
          {nordic.map(([c, v]) => (
            <li key={c}>
              {cname(c)}: {pc(v)}
            </li>
          ))}
          {oecd != null && (
            <li>
              {l('OECD average', 'OECD-snitt')}: {pc(oecd)}
            </li>
          )}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        `OECD Taxing Wages ${wedge.year}: income tax and employee and employer contributions minus cash benefits, as a share of labour cost; single earner without children at the average wage.`,
        `OECD Taxing Wages ${wedge.year}: inkomstskatt och arbetstagar- och arbetsgivaravgifter minus kontanta bidrag, som andel av lönekostnaden; ensamstående utan barn med genomsnittslön.`,
      ),
    })
  if (seLast) {
    const v = val(seLast, 'ppltrst')!
    const eu = val(row('EU27', seLast.period_key), 'ppltrst')
    const nb = NEIGHBOURS.map(
      (u) => [u, val(row(u, seLast.period_key), 'ppltrst')] as const,
    ).filter((x): x is readonly [Unit, number] => x[1] != null)
    findings.push({
      key: 'trust',
      statement: l(
        `Swedes trust other people more than Europeans do, and less than their Nordic neighbours: ${dec(v, 2)} of 10 in ${seLast.period_key}, against ${nb.map(([u, x]) => `${unitName(u)} ${dec(x, 2)}`).join(' and ')}. Sweden was the lowest of the Nordic countries surveyed in ${lowest.length} of ${interview.length} interview rounds.`,
        `Svenskar litar mer på andra människor än européer gör, och mindre än sina nordiska grannar: ${dec(v, 2)} av 10 i ${seLast.period_key}, mot ${nb.map(([u, x]) => `${unitName(u)} ${dec(x, 2)}`).join(' och ')}. Sverige låg lägst av de undersökta nordiska länderna i ${lowest.length} av ${interview.length} intervjuomgångar.`,
      ),
      values: (
        <ul>
          <li>
            {l('Sweden', 'Sverige')} {seLast.period_key} (
            {seLast.reference_year}): {dec(v, 2)}
          </li>
          {nb.map(([u, x]) => (
            <li key={u}>
              {unitName(u)}: {dec(x, 2)}
            </li>
          ))}
          {eu != null && <li>EU27: {dec(eu, 2)}</li>}
          <li>
            {l('Sweden, interview rounds', 'Sverige, intervjuomgångar')}:{' '}
            {dec(Math.min(...band), 2)}–{dec(Math.max(...band), 2)}
          </li>
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'European Social Survey, weighted means of “Most people can be trusted” (0–10).',
        'European Social Survey, viktade medelvärden för ”De flesta människor går att lita på” (0–10).',
      ),
    })
  }
  if (modeBreak && before && after) {
    const dip = val(modeBreak, 'ppltrst')!
    const b0 = val(row('SE', before), 'ppltrst')
    const a0 = val(row('SE', after), 'ppltrst')
    const steady = (['FI', 'NO'] as Unit[])
      .map((u) => {
        const x = val(row(u, before), 'ppltrst')
        const y = val(row(u, modeBreak.period_key), 'ppltrst')
        return x != null && y != null ? ([u, y - x] as const) : null
      })
      .filter((x) => x != null)
    findings.push({
      key: 'mode',
      contrary: true,
      statement: l(
        `Trust did not collapse in ${modeBreak.reference_year}. Sweden’s drop to ${dec(dip, 2)} in ${modeBreak.period_key} came with a switch from interviews to self-completed questionnaires; Finland and Norway, still interviewed, barely moved, and Sweden was back at ${a0 != null ? dec(a0, 2) : '–'} once interviews resumed.`,
        `Tilliten rasade inte ${modeBreak.reference_year}. Sveriges fall till ${dec(dip, 2)} i ${modeBreak.period_key} kom med ett byte från intervjuer till självifyllda enkäter; Finland och Norge, som fortfarande intervjuades, rörde sig knappt, och Sverige var tillbaka på ${a0 != null ? dec(a0, 2) : '–'} när intervjuerna återupptogs.`,
      ),
      values: (
        <ul>
          <li>
            {l('Sweden', 'Sverige')} {before}: {b0 != null ? dec(b0, 2) : '–'};{' '}
            {modeBreak.period_key} ({l('self-completion', 'självifyllt')}):{' '}
            {dec(dip, 2)}; {after}: {a0 != null ? dec(a0, 2) : '–'}
          </li>
          {steady.map(([u, d]) => (
            <li key={u}>
              {unitName(u)} {before} → {modeBreak.period_key}:{' '}
              {d >= 0 ? '+' : '−'}
              {dec(Math.abs(d), 2)}
            </li>
          ))}
        </ul>
      ),
      evidence: 'descriptive',
      source: l(
        'European Social Survey, survey mode per country and round.',
        'European Social Survey, insamlingssätt per land och omgång.',
      ),
    })
  }

  const scene = (
    <Scene
      product={product}
      line={l(
        'Mean answer per European Social Survey round, 0–10. Sweden’s line joins its interview rounds; the open ring is the one round it was self-completed. The axis covers only the range of the means.',
        'Medelsvar per omgång av European Social Survey, 0–10. Sveriges linje binder ihop intervjuomgångarna; den öppna ringen är den enda omgång som fylldes i av de svarande själva. Axeln täcker bara medelvärdenas spann.',
      )}
      legend={
        <>
          <b>{l(...METRICS[metric])}</b>
          <ul className="sw-note" style={{ margin: 0, paddingLeft: '1rem' }}>
            <li style={{ color: 'var(--sw-accent)' }}>
              {l('Sweden, interviews', 'Sverige, intervjuer')}
            </li>
            <li>○ {l('Sweden, self-completion', 'Sverige, självifyllt')}</li>
            <li>
              {l(
                'Finland, Norway, Denmark: grey; EU27: dashed',
                'Finland, Norge, Danmark: grått; EU27: streckad',
              )}
            </li>
          </ul>
        </>
      }
      control={
        <div className="sw-controls">
          <label>
            {l('Survey measure', 'Enkätmått')}
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
            >
              {(Object.keys(METRICS) as Metric[]).map((m) => (
                <option key={m} value={m}>
                  {l(...METRICS[m])}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      info={
        se != null && (
          <>
            <b>{l('Tax wedge', 'Skattekil')}</b>
            <p className="sw-mono">
              {l('Sweden', 'Sverige')} {wedge.year}: {pc(se)} · {rankOf('SWE')}/
              {members.length}
            </p>
            {oecd != null && eu22 != null && (
              <p className="sw-note">
                {l('OECD average', 'OECD-snitt')} {pc(oecd)} ·{' '}
                {l('EU members of the OECD', 'EU-länder i OECD')} {pc(eu22)}
              </p>
            )}
          </>
        )
      }
    >
      <div>
        <TrustLines ess={ess} rounds={rounds} metric={metric} />
      </div>
    </Scene>
  )

  const explore = (
    <>
      <h3>
        {l(
          `Tax wedge, single earner at the average wage, ${wedge.year}`,
          `Skattekil, ensamstående med genomsnittslön, ${wedge.year}`,
        )}
      </h3>
      <div className="sw-table-wrap">
        <table className="sw-table">
          <thead>
            <tr>
              <th scope="col" className="sw-n">
                #
              </th>
              <th scope="col">{l('Country', 'Land')}</th>
              <th scope="col" className="sw-n">
                {l('Tax wedge', 'Skattekil')}
              </th>
              <th scope="col" className="sw-n">
                {l(
                  `Change since ${firstYear}`,
                  `Förändring sedan ${firstYear}`,
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map(([code, v], i) => {
              const c = change.get(code)
              const label = cname(code)
              return (
                <tr key={code} aria-current={code === 'SWE' || undefined}>
                  <td className="sw-n">{i + 1}</td>
                  <th scope="row">
                    {country.get(code)?.is_nordic ? <b>{label}</b> : label}
                  </th>
                  <td className="sw-n">{pc(v)}</td>
                  <td className="sw-n">
                    {c == null
                      ? '–'
                      : `${c >= 0 ? '+' : '−'}${dec(Math.abs(c))}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            {(['OECD_REP', 'EU22OECD'] as const).map((code) =>
              latest.has(code) ? (
                <tr key={code}>
                  <td />
                  <th scope="row">{cname(code)}</th>
                  <td className="sw-n">{pc(latest.get(code)!)}</td>
                  <td className="sw-n">–</td>
                </tr>
              ) : null,
            )}
          </tfoot>
        </table>
      </div>
      <h3>
        {l(...METRICS[metric])} {l('per survey round', 'per enkätomgång')}
      </h3>
      <div className="sw-table-wrap">
        <table className="sw-table">
          <thead>
            <tr>
              <th scope="col">{l('Round', 'Omgång')}</th>
              {(Object.keys(UNITS) as Unit[]).map((u) => (
                <th key={u} scope="col" className="sw-n">
                  {unitName(u)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((k) => {
              const s = row('SE', k)
              return (
                <tr key={k}>
                  <th scope="row">
                    {k} ({(s ?? row('EU27', k))?.reference_year})
                  </th>
                  {(Object.keys(UNITS) as Unit[]).map((u) => {
                    const v = val(row(u, k), metric)
                    const self =
                      u === 'SE' &&
                      s?.survey_mode &&
                      s.survey_mode !== 'interview'
                    return (
                      <td key={u} className="sw-n">
                        {v == null ? '–' : dec(v, 2)}
                        {self
                          ? ` (${l('self-completion', 'självifyllt')})`
                          : ''}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )

  const method: Method = {
    question: l(
      'Swedes pay high taxes into a universal welfare state, which is said to rest on trust. How high are the taxes on work now, how high is trust, and has either moved?',
      'Svenskar betalar höga skatter till en generell välfärdsstat, som sägs vila på tillit. Hur höga är skatterna på arbete i dag, hur hög är tilliten, och har någon av dem rört sig?',
    ),
    theory: l(
      'The welfare contract: citizens accept high taxes in exchange for universal services, and the arrangement is held together by trust in other people and in institutions (Rothstein; Levi on contingent consent).',
      'Välfärdskontraktet: medborgarna godtar höga skatter i utbyte mot generella tjänster, och arrangemanget hålls ihop av tillit till andra människor och till institutionerna (Rothstein; Levi om villkorat samtycke).',
    ),
    data: l(
      `OECD Taxing Wages (${wedge.source}), ${firstYear}–${wedge.year}, ${members.length} member countries and two averages. European Social Survey rounds 1–11 (2002–2023) for Sweden, Finland, Norway and Denmark, and a pooled EU27 group, as weighted means per country and round with each round’s survey mode.`,
      `OECD Taxing Wages (${wedge.source}), ${firstYear}–${wedge.year}, ${members.length} medlemsländer och två snitt. European Social Survey omgång 1–11 (2002–2023) för Sverige, Finland, Norge och Danmark samt en sammanvägd EU27-grupp, som viktade medelvärden per land och omgång med insamlingssätt per omgång.`,
    ),
    method: l(
      'The tax wedge is read for one household type, a single earner without children at 100 % of the average wage, ranked among member countries; the averages are shown but not ranked. Survey means are compared across countries within a round, and within Sweden only across rounds with the same survey mode.',
      'Skattekilen läses för en hushållstyp, ensamstående utan barn med 100 % av genomsnittslönen, rangordnad bland medlemsländerna; snitten visas men rangordnas inte. Enkätmedelvärden jämförs mellan länder inom en omgång, och inom Sverige bara mellan omgångar med samma insamlingssätt.',
    ),
    results: l(
      'See the findings above; every value is read from the two files when the page opens.',
      'Se resultaten ovan; varje värde läses ur de två filerna när sidan öppnas.',
    ),
    alternatives: l(
      'A falling tax wedge can come from cuts in income tax (the earned income tax credit from 2007) as well as from shifts to other taxes; the wedge does not cover consumption or capital taxes. Nordic differences in trust can reflect translation, sampling and fieldwork as well as attitudes.',
      'En sjunkande skattekil kan komma av sänkt inkomstskatt (jobbskatteavdraget från 2007) men också av förskjutningar till andra skatter; kilen omfattar inte konsumtions- eller kapitalskatter. Nordiska skillnader i tillit kan spegla översättning, urval och fältarbete lika väl som attityder.',
    ),
    limitations: l(
      `The tax wedge describes one model household, not what people actually pay. The survey means carry no design-based intervals here; differences of a few tenths are shown, not tested. ESS10 in Sweden was self-completed, which moves answers, so it is not compared with the interview rounds. Denmark’s last round in the file is ESS9. The two sources are not joined: with ${NEIGHBOURS.length + 1} Nordic countries in the survey, no relationship between taxes and trust can be estimated.`,
      `Skattekilen beskriver ett modellhushåll, inte vad människor faktiskt betalar. Enkätmedelvärdena har inga designbaserade intervall här; skillnader på några tiondelar visas men prövas inte. ESS10 i Sverige fylldes i av de svarande själva, vilket flyttar svaren, så den jämförs inte med intervjuomgångarna. Danmarks sista omgång i filen är ESS9. De två källorna kopplas inte ihop: med ${NEIGHBOURS.length + 1} nordiska länder i enkäten går inget samband mellan skatt och tillit att skatta.`,
    ),
    references: l(
      'OECD (2025) Taxing Wages; European Social Survey ERIC, ESS rounds 1–11; Rothstein, B. (1998) Just Institutions Matter; Levi, M. (1997) Consent, Dissent, and Patriotism.',
      'OECD (2025) Taxing Wages; European Social Survey ERIC, ESS omgång 1–11; Rothstein, B. (1998) Just Institutions Matter; Levi, M. (1997) Consent, Dissent, and Patriotism.',
    ),
    reproducibility: (
      <dl className="sw-info-list">
        <dt>{l('Files', 'Filer')}</dt>
        <dd className="sw-mono">
          taxes/wedge.json, welfare/ess-countries.json
        </dd>
        <dt>{l('Reproduce', 'Reproducera')}</dt>
        <dd className="sw-mono">python platform/pipeline.py run sweden</dd>
      </dl>
    ),
  }

  const readings: Reading[] = [
    {
      theory: 'Rothstein: universal institutions build trust',
      expects: l(
        'The countries with the most universal, tax-financed welfare should show the most trust in other people.',
        'De länder som har mest generell, skattefinansierad välfärd borde visa mest tillit till andra människor.',
      ),
      verdict: 'undetermined',
      why: l(
        `All four Nordic countries trust far more than the EU27, which fits. Within the Nordics it does not line up: Sweden taxes an average wage more than Norway and Denmark and trusts less. Four countries cannot decide it.`,
        `Alla fyra nordiska länder har betydligt högre tillit än EU27, vilket stämmer. Inom Norden går det inte ihop: Sverige beskattar en genomsnittslön mer än Norge och Danmark och har lägre tillit. Fyra länder kan inte avgöra det.`,
      ),
      limits: l(
        'Testing it needs many countries and institutional measures beyond a tax rate.',
        'Att pröva det kräver många länder och institutionella mått utöver en skattesats.',
      ),
    },
    {
      theory: 'An eroding contract',
      expects: l(
        'As taxes are cut and services narrowed, trust should fall with them.',
        'När skatterna sänks och tjänsterna smalnar av borde tilliten falla med dem.',
      ),
      verdict: 'challenges',
      why: l(
        `The tax wedge fell by ${seFall != null ? dec(-seFall) : '–'} points, yet trust in the interview rounds stayed between ${dec(Math.min(...band), 2)} and ${dec(Math.max(...band), 2)}. The one sharp fall is the self-completed round.`,
        `Skattekilen sjönk med ${seFall != null ? dec(-seFall) : '–'} procentenheter, men tilliten i intervjuomgångarna låg kvar mellan ${dec(Math.min(...band), 2)} och ${dec(Math.max(...band), 2)}. Det enda skarpa fallet är den självifyllda omgången.`,
      ),
      limits: l(
        'A lower wedge on labour is not the same as a smaller welfare state; services and other taxes are not measured here.',
        'En lägre kil på arbete är inte detsamma som en mindre välfärdsstat; tjänster och andra skatter mäts inte här.',
      ),
    },
    {
      theory: 'Measurement makes the trend',
      expects: l(
        'Breaks in how a survey is collected can look like social change.',
        'Brott i hur en enkät samlas in kan se ut som social förändring.',
      ),
      verdict: 'supports',
      why: l(
        'The ESS10 dip in Sweden appears in the one round collected by self-completion and in no interviewed neighbour, and is gone in the next interview round.',
        'Dippen i ESS10 i Sverige syns i den enda omgång som samlades in genom självifyllnad och hos ingen intervjuad granne, och är borta i nästa intervjuomgång.',
      ),
      limits: l(
        'Mode and the pandemic years coincide in ESS10, so the file cannot separate them fully.',
        'Insamlingssätt och pandemiåren sammanfaller i ESS10, så filen kan inte helt skilja dem åt.',
      ),
    },
  ]

  return (
    <SwedenResearchPage
      product={product}
      scene={scene}
      findings={findings}
      explore={explore}
      exploreSummary={l(
        'The tax wedge in every OECD member, and each survey measure per round.',
        'Skattekilen i varje OECD-land och varje enkätmått per omgång.',
      )}
      method={method}
      readings={readings}
    />
  )
}

/** 1st, 2nd, 3rd, 13th. */
function ordinal(n: number) {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${s}`
}

/** The scene: one line per country over the survey rounds, Sweden's mode break left open. */
function TrustLines({
  ess,
  rounds,
  metric,
}: {
  ess: Ess[]
  rounds: string[]
  metric: Metric
}) {
  const W = 640
  const H = 340
  const L = 36
  const R = 92
  const T = 14
  const B = 30
  const pts = (u: Unit) =>
    rounds
      .map((k) => ess.find((r) => r.unit_code === u && r.period_key === k))
      .filter((r): r is Ess => r?.[`${metric}_mean`] != null)
  const all = (Object.keys(UNITS) as Unit[]).flatMap((u) =>
    pts(u).map((r) => r[`${metric}_mean`]!),
  )
  const lo = Math.floor(Math.min(...all) * 2) / 2
  const hi = Math.ceil(Math.max(...all) * 2) / 2
  const years = ess.map((r) => r.reference_year)
  const y0 = Math.min(...years)
  const y1 = Math.max(...years)
  const x = (yr: number) => L + ((yr - y0) / (y1 - y0 || 1)) * (W - L - R)
  const y = (v: number) => T + ((hi - v) / (hi - lo || 1)) * (H - T - B)
  const line = (rs: Ess[]) =>
    rs
      .map(
        (r, i) =>
          `${i ? 'L' : 'M'}${x(r.reference_year).toFixed(1)},${y(r[`${metric}_mean`]!).toFixed(1)}`,
      )
      .join('')
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += 0.5) ticks.push(v)
  const units: Unit[] = ['EU27', 'DK', 'NO', 'FI', 'SE']
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={l(
        `${METRICS[metric][0]} per survey round in Sweden, Finland, Norway, Denmark and the EU27`,
        `${METRICS[metric][1]} per enkätomgång i Sverige, Finland, Norge, Danmark och EU27`,
      )}
      style={{ maxWidth: '52rem', display: 'block', margin: '0 auto' }}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--sw-line)" />
          <text
            x={L - 6}
            y={y(v) + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--sw-muted)"
          >
            {dec(v)}
          </text>
        </g>
      ))}
      {[y0, 2010, 2018, y1].map((yr) => (
        <text
          key={yr}
          x={x(yr)}
          y={H - 10}
          textAnchor="middle"
          fontSize="11"
          fill="var(--sw-muted)"
        >
          {yr}
        </text>
      ))}
      {units.map((u) => {
        const rs = pts(u)
        const se = u === 'SE'
        const drawn = se ? rs.filter((r) => r.survey_mode === 'interview') : rs
        const last = drawn.at(-1)
        if (!last) return null
        return (
          <g key={u}>
            <path
              d={line(drawn)}
              fill="none"
              stroke={se ? 'var(--sw-accent)' : 'var(--sw-muted)'}
              strokeWidth={se ? 2.5 : 1.2}
              strokeDasharray={u === 'EU27' ? '4 3' : undefined}
            />
            {se &&
              drawn.map((r) => (
                <circle
                  key={r.period_key}
                  cx={x(r.reference_year)}
                  cy={y(r[`${metric}_mean`]!)}
                  r={3}
                  fill="var(--sw-accent)"
                />
              ))}
            {se &&
              rs
                .filter((r) => r.survey_mode !== 'interview')
                .map((r) => (
                  <g key={r.period_key}>
                    <circle
                      cx={x(r.reference_year)}
                      cy={y(r[`${metric}_mean`]!)}
                      r={5}
                      fill="var(--sw-bg)"
                      stroke="var(--sw-accent)"
                      strokeWidth={1.5}
                    />
                    <text
                      x={x(r.reference_year)}
                      y={y(r[`${metric}_mean`]!) + 18}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--sw-ink)"
                    >
                      {r.period_key} · {l('self-completion', 'självifyllt')}
                    </text>
                  </g>
                ))}
            <text
              // A series that ends early (Denmark) is labelled above its last point.
              x={x(last.reference_year) + (last.reference_year < y1 ? 0 : 8)}
              y={
                y(last[`${metric}_mean`]!) +
                (last.reference_year < y1 ? -10 : 4)
              }
              textAnchor={last.reference_year < y1 ? 'middle' : undefined}
              fontSize="12"
              fill={se ? 'var(--sw-accent)' : 'var(--sw-muted)'}
              fontWeight={se ? 600 : 400}
            >
              {unitName(u)} {dec(last[`${metric}_mean`]!, 2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
