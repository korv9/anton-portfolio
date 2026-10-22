/**
 * DrugComb as report cards. It opens with what the project asks in plain words (can a model
 * tell which drug pairs work better together than alone?), then walks through the data, the
 * checks and the results, one card per question. Every number comes from the published upstream
 * report (products/drugcomb/report.json and tables/), not from a new training run.
 */
import { useEffect, useState } from 'react'
import { currentLocale, l } from '../i18n'
import { fetchData } from '../dataSource'
import CalibrationScatter from './CalibrationScatter'
import { Empty } from '../report/board/Board'
import Columns from '../report/board/Columns'
import RankBars from '../charts/RankBars'
import '../report/dash.css'
import './drugcomb.css'
import BodyMap, { type Lineage } from './BodyMap'
import DecisionTree, { leavesOf, type TreeNode } from './DecisionTree'
import DrugConstellation, {
  type DrugCluster,
  type DrugPoint,
} from './DrugConstellation'
import { DRUGCOMB_TABS, type Route } from '../router'
import { useViewParams } from '../report/useViewParams'
import ReportShell, {
  DeepPage,
  withQuery,
  type DeeperLink,
  type ReportTab,
} from '../report/ReportShell'
import { Feature } from '../charts/feature/Feature'
import { Select } from '../report/controls'
import ProjectTech from '../projects/ProjectTech'
import './mlviz.css'

type TreeFile = {
  tree: TreeNode
  metrics: {
    train_measurements: number
    test_measurements: number
    test_pairs: number
    base_rate: number
    roc_auc: number
    average_precision: number
    leaves: number
    depth: number
  }
  importance: {
    feature: string
    label: { en: string; sv: string }
    gain: number
  }[]
  method: {
    measurements: number
    dropped_invalid_zip: number
    tissue_matched_share: number
  }
}
type ClusterFile = {
  k: number
  silhouette: Record<string, number>
  tissues: string[]
  drugs: DrugPoint[]
  clusters: DrugCluster[]
}

type Metric = {
  scheme: string
  model: string
  model_label: string
  pearson: number | null
  pearson_sd: number | null
  rmse: number
  r2: number
  auprc_synergy: number
  prevalence_synergy: number
}
type Report = {
  source: { revision: string; repository: string }
  metrics: Metric[]
  funnel: { step: string; rows: number }[]
  overview: {
    combinations: number
    drug_pairs: number
    drugs: number
    cell_lines: number
    lineages: number
    mean_zip: number
    share_synergistic: number
    share_antagonistic: number
    share_with_structures: number
    share_with_rna: number
  }
  lineages: Lineage[]
}
type Tables = {
  quality: { check: string; passed: string; detail: string | null }[]
  entities: {
    entity: string
    method: string
    names: number
    measurement_share: number
  }[]
  families: { scheme: string; model: string; family: string; gain: number }[]
  enrichment: {
    scheme: string
    model: string
    top_fraction: number
    hit_rate: number
    base_rate: number
  }[]
  scramble: { scheme: string; test_r: number }[]
  learning: {
    train_fraction: number
    n_train: number
    train_r: number
    test_r: number
  }[]
  calibration: { decile: number; pred: number; obs: number; scheme: string }[]
  pairs: {
    pair_name: string
    cell_lines: number
    mean_zip: number
    share_synergistic: number
  }[]
}

const TABLES: Record<keyof Tables, string> = {
  quality: 'data_quality',
  entities: 'entity_resolution',
  families: 'feature_importance_family',
  enrichment: 'eval_enrichment',
  scramble: 'eval_y_scramble',
  learning: 'eval_learning_curve',
  calibration: 'eval_calibration',
  pairs: 'sql_top_synergistic_pairs',
}

const SPLITS: [string, string, string][] = [
  ['random', 'Random rows', 'Slumpade rader'],
  ['cold_pair', 'New drug pair', 'Nytt läkemedelspar'],
  ['cold_drug', 'New drug', 'Nytt läkemedel'],
  ['cold_cell', 'New cell line', 'Ny cellinje'],
]
const MODELS: [string, string, string][] = [
  ['history_ridge', 'Baseline: earlier results', 'Baslinje: tidigare resultat'],
  [
    'lgbm_chem_bio',
    'LightGBM: chemistry + biology',
    'LightGBM: kemi + biologi',
  ],
  ['lgbm_all', 'LightGBM: all features', 'LightGBM: alla egenskaper'],
]
const FAMILY_SV: Record<string, string> = {
  'Biology: RNA expression PCs': 'Biologi: genuttryck (RNA)',
  'Biology: tissue lineage': 'Biologi: vävnadstyp',
  'Chemistry: descriptors & similarity': 'Kemi: deskriptorer och likhet',
  'Chemistry: fingerprint bits': 'Kemi: molekylfingeravtryck',
  'Context: source study': 'Sammanhang: vilken studie',
  'Mechanism: target embedding': 'Mekanism: målproteiner',
  'Monotherapy response': 'Effekt av varje läkemedel ensamt',
  'Screen history: in-fold counts': 'Tidigare försök: antal',
  'Screen history: in-fold mean ZIP': 'Tidigare försök: medel-ZIP',
  'Targets in the cell line': 'Målproteiner i cellinjen',
}
const STEP_SV: Record<string, string> = {
  'raw rows': 'Rådata',
  'has drug & cell names': 'Har namn på läkemedel och cell',
  'numeric ZIP score': 'Numeriskt ZIP-värde',
  'ZIP within [-100, 100]': 'ZIP inom [−100, 100]',
  'two different molecules': 'Två olika molekyler',
  'human cell lines only': 'Bara mänskliga cellinjer',
  'unique (pair, cell line, study) after replicate mean':
    'Unika par × cellinje × studie',
}

// How a name was matched (entity_resolution.method), in words.
const METHOD: Record<string, [string, string]> = {
  drugcombdb: ['DrugCombDB identifier', 'DrugCombDB-id'],
  pubchem: ['PubChem lookup', 'PubChem-sökning'],
  exact: ['exact name', 'exakt namn'],
  alias: ['known alias', 'känt alias'],
  excluded_non_human: ['left out, not human', 'utelämnad, ej human'],
  unmatched: ['not matched', 'ej matchad'],
  unresolved: ['not resolved', 'ej löst'],
}
const methodName = (m: string) => (METHOD[m] ? l(...METHOD[m]) : m)

const NAME = 'Drug Synergy Lab'
const tabs = (): ReportTab[] => [
  {
    path: '#drugcomb',
    label: l('Unseen data', 'Osedd data'),
    question: l(
      'Does the model still work on drugs it has never seen?',
      'Fungerar modellen på läkemedel den aldrig sett?',
    ),
  },
  {
    path: '#drugcomb-model',
    label: l('What it learns', 'Vad den lär sig'),
    question: l(
      'What does the model rely on, and is it real?',
      'Vad lutar sig modellen mot, och är det på riktigt?',
    ),
  },
  {
    path: '#drugcomb-cells',
    label: l('Cells and drugs', 'Celler och läkemedel'),
    question: l(
      'Which cancers and drugs were tested?',
      'Vilka cancerformer och läkemedel testades?',
    ),
  },
]
const DEEPER = (): DeeperLink[] => [
  {
    href: '#drugcomb-quality',
    label: l('Data and its checks', 'Datan och dess kontroller'),
    about: l(
      'Cleaning, quality tests, name matching, the learning curve and calibration',
      'Städning, kvalitetstester, namnmatchning, inlärningskurvan och kalibrering',
    ),
  },
  {
    href: '#drugcomb-method',
    label: l('Method and limits', 'Metod och begränsningar'),
    about: l(
      'Synergy, the splits, the assumptions and the original figures',
      'Synergi, uppdelningarna, antagandena och originalfigurerna',
    ),
  },
  {
    href: '#drugcomb-data',
    label: l('Result tables', 'Resultattabeller'),
    about: l(
      'Every evaluation table, to browse and download',
      'Varje utvärderingstabell, att bläddra i och ladda ned',
    ),
  },
]

const nf = () => l('en-GB', 'sv-SE')
const num = (n: number, digits = 0) =>
  n.toLocaleString(nf(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
const pct = (share: number, digits = 1) => `${num(share * 100, digits)} %`

export default function DrugCombReport({ route }: { route: Route }) {
  const [report, setReport] = useState<Report | null>(null)
  const [tables, setTables] = useState<Partial<Tables>>({})
  const [{ uppdelning: split }, set] = useViewParams(route, {
    uppdelning: 'random',
  })
  const [error, setError] = useState(false)
  const [treeFile, setTreeFile] = useState<TreeFile | null>(null)
  const [sky, setSky] = useState<ClusterFile | null>(null)
  // Slicers: a tissue on the body, a leaf in the tree.
  const [tissue, setTissue] = useState('')
  const [leaf, setLeaf] = useState('')
  useEffect(() => {
    fetchData('products/drugcomb/report.json')
      .then((r) => {
        if (!r.ok) throw Error()
        return r.json()
      })
      .then(setReport)
      .catch(() => setError(true))
    fetchData('products/drugcomb/tree.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(setTreeFile)
      .catch(() => {})
    fetchData('products/drugcomb/drug-clusters.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(setSky)
      .catch(() => {})
    for (const [key, file] of Object.entries(TABLES))
      fetchData(`products/drugcomb/tables/${file}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((rows) => rows && setTables((t) => ({ ...t, [key]: rows })))
        .catch(() => {})
  }, [])

  if (error)
    return (
      <p role="alert">
        {l(
          'The DrugComb report could not be loaded.',
          'DrugComb-rapporten kunde inte läsas in.',
        )}
      </p>
    )
  if (!report) return <Empty />

  const o = report.overview
  const metric = (scheme: string, model: string) =>
    report.metrics.find((m) => m.scheme === scheme && m.model === model)
  const families = (tables.families ?? [])
    .filter((f) => f.scheme === split && f.model === 'lgbm_all')
    .sort((a, b) => b.gain - a.gain)
  const familyTotal = families.reduce((s, f) => s + f.gain, 0) || 1
  const enrichment = (tables.enrichment ?? []).filter(
    (e) => e.scheme === split && e.model === 'lgbm_all',
  )
  const calibration = (tables.calibration ?? [])
    .filter((c) => c.scheme === split)
    .sort((a, b) => a.decile - b.decile)
  const passed = (tables.quality ?? []).filter(
    (q) => q.passed === 'True',
  ).length
  const splitName = (id: string) => {
    const s = SPLITS.find((x) => x[0] === id)
    return s ? l(s[1], s[2]) : id
  }
  const best = metric(split, 'lgbm_all')
  const source = l(
    'DrugCombDB screens with DepMap 24Q4; the published results of the pinned pipeline revision',
    'Försök från DrugCombDB med DepMap 24Q4; publicerade resultat från den fastlåsta versionen av pipelinen',
  )

  if (!DRUGCOMB_TABS.includes(route.path))
    return (
      <DeepPage id={route.path.slice(1)} back="#drugcomb" name={NAME}>
        {route.path === '#drugcomb-quality' ? (
          <>
            <h1>{l('Data and its checks', 'Datan och dess kontroller')}</h1>
            <div className="report-pair">
              <Feature
                id="dc-funnel"
                title={l(
                  'From raw rows to a modelling table',
                  'Från rådata till modelltabell',
                )}
                lead={l(
                  'Rows kept after each cleaning step',
                  'Rader kvar efter varje städsteg',
                )}
                source={source}
              >
                <RankBars
                  rows={report.funnel.map((f) => ({
                    key: f.step,
                    label:
                      currentLocale() === 'sv'
                        ? (STEP_SV[f.step] ?? f.step)
                        : f.step,
                    value: f.rows,
                  }))}
                  format={(v) => num(v)}
                  label={l('Cleaning funnel', 'Städtratten')}
                />
              </Feature>
              <Feature
                id="dc-checks"
                title={l(
                  `${passed} of ${tables.quality?.length ?? 10} data-quality tests passed`,
                  `${passed} av ${tables.quality?.length ?? 10} datakvalitetstester godkända`,
                )}
                source={source}
              >
                {tables.quality ? (
                  <ul className="dc-checks">
                    {tables.quality.map((q) => (
                      <li
                        key={q.check}
                        className={q.passed === 'True' ? 'ok' : 'fail'}
                      >
                        <span aria-hidden="true">
                          {q.passed === 'True' ? '✓' : '✕'}
                        </span>
                        <span>
                          {q.check}
                          {q.detail && <small>, {q.detail}</small>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty />
                )}
              </Feature>
            </div>
            <div className="report-pair">
              <Feature
                id="dc-entities"
                title={l(
                  'Matching names to identities',
                  'Namn matchade till identiteter',
                )}
                lead={l(
                  `Share of measurements resolved by each method. ${pct(o.share_with_structures)} of the rows have a chemical structure for both drugs, ${pct(o.share_with_rna)} have gene expression for the cell line.`,
                  `Andel av mätningarna som löstes med varje metod. ${pct(o.share_with_structures)} av raderna har kemisk struktur för båda läkemedlen, ${pct(o.share_with_rna)} har genuttryck för cellinjen.`,
                )}
                source={source}
              >
                {tables.entities ? (
                  <RankBars
                    rows={tables.entities.map((e) => ({
                      key: `${e.entity}-${e.method}`,
                      label: `${e.entity === 'drug' ? l('Drug', 'Läkemedel') : l('Cell line', 'Cellinje')}: ${methodName(e.method)}`,
                      value: e.measurement_share * 100,
                      tone:
                        e.method === 'unresolved'
                          ? ('muted' as const)
                          : ('neutral' as const),
                      note: ` ${num(e.names)} ${l('names', 'namn')}`,
                    }))}
                    format={(v) => `${num(v, 1)} %`}
                    max={100}
                    label={l('Entity resolution', 'Entitetsmatchning')}
                  />
                ) : (
                  <Empty />
                )}
              </Feature>
              <Feature
                id="dc-learning"
                title={l(
                  'More data helps, then levels off',
                  'Mer data hjälper, sedan planar det ut',
                )}
                lead={l(
                  'Correlation on training and test data as the training set grows. The gap narrows as data grows: the model memorises less and generalises more.',
                  'Korrelation på tränings- och testdata när träningsmängden växer. Glappet krymper när datan växer: modellen lär sig mindre utantill och generaliserar mer.',
                )}
                source={source}
              >
                {tables.learning ? (
                  <Columns
                    categories={tables.learning.map(
                      (r) => `${num(r.n_train / 1000)}k`,
                    )}
                    series={[
                      {
                        key: 'train',
                        label: l('Training data', 'Träningsdata'),
                        values: tables.learning.map((r) => r.train_r),
                      },
                      {
                        key: 'test',
                        label: l('Test data', 'Testdata'),
                        values: tables.learning.map((r) => r.test_r),
                      },
                    ]}
                    format={(v) => num(v, 2)}
                    domain={[0, 1]}
                    label={l('Learning curve', 'Inlärningskurva')}
                  />
                ) : (
                  <Empty />
                )}
              </Feature>
            </div>
            <CalibrationScatter
              points={
                (tables.calibration ?? []) as Parameters<
                  typeof CalibrationScatter
                >[0]['points']
              }
              splits={SPLITS}
            />
          </>
        ) : (
          <>
            <h1>{l('Method and limits', 'Metod och begränsningar')}</h1>
            <Method report={report} />
            <ProjectTech project="drugcomb" />
          </>
        )}
      </DeepPage>
    )

  const tab = DRUGCOMB_TABS.indexOf(route.path)
  const splitChips = (
    <div
      className="report-chips"
      role="group"
      aria-label={l('Test split', 'Testuppdelning')}
    >
      {SPLITS.map(([id, en, sv]) => (
        <button
          key={id}
          type="button"
          aria-pressed={split === id}
          onClick={() => set({ uppdelning: id })}
        >
          {l(en, sv)}
        </button>
      ))}
    </div>
  )
  return (
    <ReportShell
      name={NAME}
      intro={l(
        `${num(o.combinations)} measurements of ${num(o.drug_pairs)} drug pairs on ${num(o.cell_lines)} cancer cell lines from DrugCombDB, joined with DepMap. A LightGBM model predicts synergy and is tested on drugs, pairs and cell lines it has not seen. Experimental results, not clinical evidence.`,
        `${num(o.combinations)} mätningar av ${num(o.drug_pairs)} läkemedelspar på ${num(o.cell_lines)} cancercellinjer från DrugCombDB, kopplade till DepMap. En LightGBM-modell förutsäger synergi och prövas på läkemedel, par och cellinjer den inte sett. Experimentella resultat, inte kliniska belägg.`,
      )}
      tabs={tabs()}
      path={route.path}
      hrefOf={(p) => withQuery(p, route.params)}
      slicerLabel={tab < 2 ? l('Test split', 'Testuppdelning') : undefined}
      slicer={tab < 2 ? splitChips : undefined}
      deeper={DEEPER()}
    >
      {tab === 0 && (
        <>
          <div className="report-main">
            <Feature
              id="dc-splits"
              title={l(
                `On ${splitName(split).toLowerCase()}, the model reaches a correlation of ${num(best?.pearson ?? 0, 2)}`,
                `På ${splitName(split).toLowerCase()} når modellen en korrelation på ${num(best?.pearson ?? 0, 2)}`,
              )}
              lead={l(
                'Correlation between predicted and measured ZIP (Pearson, 0 = no relation, 1 = perfect), mean of three folds. The splits hold out rows, drug pairs, individual drugs or cell lines.',
                'Korrelation mellan förutsagd och uppmätt ZIP (Pearson, 0 = inget samband, 1 = perfekt), medel av tre omgångar. Uppdelningarna håller undan rader, läkemedelspar, enskilda läkemedel eller cellinjer.',
              )}
              source={source}
            >
              <Columns
                categories={SPLITS.map((s) => l(s[1], s[2]))}
                series={MODELS.map(([id, en, sv]) => ({
                  key: id,
                  label: l(en, sv),
                  focus: id === 'lgbm_all',
                  values: SPLITS.map(
                    ([scheme]) => metric(scheme, id)?.pearson ?? null,
                  ),
                }))}
                format={(v) => num(v, 2)}
                domain={[0, 1]}
                label={l(
                  'Correlation per test split and model',
                  'Korrelation per testuppdelning och modell',
                )}
              />
            </Feature>
          </div>
          <div className="report-pair">
            <Feature
              id="dc-enrichment"
              title={l(
                'Does it find the strongest pairs?',
                'Hittar den de starkaste paren?',
              )}
              lead={
                enrichment[0]
                  ? l(
                      `In the top 1 %, ${pct(enrichment[0].hit_rate, 0)} are truly synergistic, against ${pct(enrichment[0].base_rate, 0)} overall: what a lab choosing what to test next would use.`,
                      `Bland topp 1 % är ${pct(enrichment[0].hit_rate, 0)} verkligt synergistiska, mot ${pct(enrichment[0].base_rate, 0)} totalt: det ett labb som väljer vad som ska testas härnäst skulle använda.`,
                    )
                  : undefined
              }
              source={source}
            >
              {enrichment.length ? (
                <Columns
                  categories={enrichment.map(
                    (e) => `${l('top', 'topp')} ${num(e.top_fraction * 100)} %`,
                  )}
                  series={[
                    {
                      key: 'hit',
                      label: l(
                        'Among the model’s picks',
                        'Bland modellens val',
                      ),
                      values: enrichment.map((e) => e.hit_rate * 100),
                    },
                    {
                      key: 'base',
                      label: l('Among all pairs', 'Bland alla par'),
                      values: enrichment.map((e) => e.base_rate * 100),
                    },
                  ]}
                  format={(v) => `${num(v)} %`}
                  label={l(
                    'Hit rate among top-ranked pairs',
                    'Träffsäkerhet bland högst rankade par',
                  )}
                />
              ) : (
                <Empty />
              )}
            </Feature>
            <Feature
              id="dc-calibration"
              title={l(
                'Are the predictions calibrated?',
                'Stämmer förutsägelserna i nivå?',
              )}
              lead={l(
                'Mean predicted and measured ZIP per tenth of the predictions.',
                'Medel av förutsagd och uppmätt ZIP per tiondel av förutsägelserna.',
              )}
              source={source}
            >
              {calibration.length ? (
                <Columns
                  categories={calibration.map((c) => String(c.decile + 1))}
                  series={[
                    {
                      key: 'pred',
                      label: l('Predicted', 'Förutsagt'),
                      values: calibration.map((c) => c.pred),
                    },
                    {
                      key: 'obs',
                      label: l('Measured', 'Uppmätt'),
                      values: calibration.map((c) => c.obs),
                    },
                  ]}
                  format={(v) => num(v)}
                  label={l('Calibration by decile', 'Kalibrering per tiondel')}
                />
              ) : (
                <Empty />
              )}
            </Feature>
          </div>
        </>
      )}
      {tab === 1 && (
        <>
          {treeFile && (
            <div className="report-main">
              <Feature
                id="dc-tree"
                title={l(
                  'How a decision tree decides',
                  'Så bestämmer ett beslutsträd',
                )}
                lead={l(
                  `A tree asks one yes-or-no question at a time until a measurement lands in a leaf; LightGBM adds hundreds like it. This one, split by drug pair, reaches ROC AUC ${num(treeFile.metrics.roc_auc, 3)} and average precision ${num(treeFile.metrics.average_precision, 3)} on unseen pairs, against a base rate of ${pct(treeFile.metrics.base_rate)}.`,
                  `Ett träd ställer en ja-eller-nej-fråga i taget tills en mätning hamnar i ett löv; LightGBM lägger ihop hundratals sådana. Det här, uppdelat per läkemedelspar, når ROC AUC ${num(treeFile.metrics.roc_auc, 3)} och genomsnittlig precision ${num(treeFile.metrics.average_precision, 3)} på osedda par, mot en basnivå på ${pct(treeFile.metrics.base_rate)}.`,
                )}
                controls={
                  <Select
                    label={l('Follow a leaf', 'Följ ett löv')}
                    value={leaf}
                    options={[
                      { value: '', label: l('None', 'Inget') },
                      ...leavesOf(treeFile.tree)
                        .map((n, i) => ({ n, i }))
                        .sort((a, b) => b.n.share - a.n.share)
                        .map(({ n, i }) => ({
                          value: String(n.id),
                          label: `${l('Leaf', 'Löv')} ${i + 1}, ${pct(n.share)}, ${num(n.n)}`,
                        })),
                    ]}
                    onChange={setLeaf}
                  />
                }
                source={l(
                  `scikit-learn; ${num(treeFile.metrics.train_measurements)} training and ${num(treeFile.metrics.test_measurements)} test measurements`,
                  `scikit-learn; ${num(treeFile.metrics.train_measurements)} tränings- och ${num(treeFile.metrics.test_measurements)} testmätningar`,
                )}
              >
                <DecisionTree
                  root={treeFile.tree}
                  highlight={leaf === '' ? null : Number(leaf)}
                />
              </Feature>
            </div>
          )}
          <div className="report-pair">
            <Feature
              id="dc-families"
              title={l(
                'What the model relies on',
                'Vad modellen lutar sig mot',
              )}
              lead={l(
                `Share of the model’s total gain per feature family, ${splitName(split).toLowerCase()}.`,
                `Andel av modellens totala vinst per egenskapsgrupp, ${splitName(split).toLowerCase()}.`,
              )}
              source={source}
            >
              {families.length ? (
                <RankBars
                  rows={families.map((f) => ({
                    key: f.family,
                    label:
                      currentLocale() === 'sv'
                        ? (FAMILY_SV[f.family] ?? f.family)
                        : f.family,
                    value: (f.gain / familyTotal) * 100,
                  }))}
                  format={(v) => `${num(v, 1)} %`}
                  label={l(
                    'Feature importance by family',
                    'Egenskapernas betydelse per grupp',
                  )}
                />
              ) : (
                <Empty />
              )}
            </Feature>
            <Feature
              id="dc-scramble"
              title={l('A check against luck', 'En kontroll mot slumpen')}
              lead={l(
                'The same model trained on shuffled answers finds nothing, so the result comes from real patterns, not from information leaking between training and test. A useful check, not proof that every leak is ruled out.',
                'Samma modell tränad på omblandade svar hittar ingenting, så resultatet kommer från verkliga mönster, inte från information som läcker mellan träning och test. En användbar kontroll, inte ett bevis för att varje läcka är utesluten.',
              )}
              source={source}
            >
              {tables.scramble?.[0] ? (
                <div className="dc-scramble">
                  <p>
                    <strong>{num(tables.scramble[0].test_r, 3)}</strong>
                    <span>
                      {l(
                        'correlation with shuffled answers',
                        'korrelation med omblandade svar',
                      )}
                    </span>
                  </p>
                  <p>
                    <strong>
                      {num(
                        metric(tables.scramble[0].scheme, 'lgbm_all')
                          ?.pearson ?? 0,
                        3,
                      )}
                    </strong>
                    <span>
                      {l(
                        `correlation with the real answers (${splitName(tables.scramble[0].scheme).toLowerCase()})`,
                        `korrelation med de riktiga svaren (${splitName(tables.scramble[0].scheme).toLowerCase()})`,
                      )}
                    </span>
                  </p>
                </div>
              ) : (
                <Empty />
              )}
            </Feature>
          </div>
        </>
      )}
      {tab === 2 && (
        <>
          <div className="report-main">
            <Feature
              id="dc-body"
              title={l(
                `${num(o.cell_lines)} cell lines from ${num(o.lineages)} kinds of tissue`,
                `${num(o.cell_lines)} cellinjer från ${num(o.lineages)} sorters vävnad`,
              )}
              lead={l(
                `Every screened cell line has a tissue of origin. Point at one to read it. ${pct(o.share_synergistic)} of the measurements are synergistic (ZIP > 10), ${pct(o.share_antagonistic)} antagonistic (ZIP < −10).`,
                `Varje testad cellinje har en ursprungsvävnad. Peka på en för att läsa den. ${pct(o.share_synergistic)} av mätningarna är synergistiska (ZIP > 10), ${pct(o.share_antagonistic)} motverkande (ZIP < −10).`,
              )}
              controls={
                <Select
                  label={l('Tissue', 'Vävnad')}
                  value={tissue}
                  options={[
                    { value: '', label: l('All tissues', 'Alla vävnader') },
                    ...[...report.lineages]
                      .sort((a, b) => b.combinations - a.combinations)
                      .map((t) => ({ value: t.lineage, label: t.lineage })),
                  ]}
                  onChange={setTissue}
                />
              }
              source={l(
                'DrugCombDB screens; tissue of origin from DepMap 24Q4',
                'Försök från DrugCombDB; ursprungsvävnad från DepMap 24Q4',
              )}
            >
              <BodyMap lineages={report.lineages} highlight={tissue || null} />
            </Feature>
          </div>
          <div className="report-pair">
            {sky && (
              <Feature
                id="dc-sky"
                title={l(
                  `${num(sky.drugs.length)} drugs in ${sky.k} groups that behave alike`,
                  `${num(sky.drugs.length)} läkemedel i ${sky.k} grupper som beter sig lika`,
                )}
                lead={l(
                  'Each star is a drug, placed by where it is synergistic; drugs in one k-means cluster are joined like a constellation. Choose a cluster to see it alone.',
                  'Varje stjärna är ett läkemedel, placerat efter var det är synergistiskt; läkemedel i samma k-means-kluster binds ihop som en stjärnbild. Välj ett kluster för att se det ensamt.',
                )}
                table={
                  <table className="board-table">
                    <thead>
                      <tr>
                        <th scope="col">{l('Cluster', 'Kluster')}</th>
                        <th scope="col">
                          {l('Highest ZIP in', 'Högst ZIP i')}
                        </th>
                        <th scope="col">{l('For example', 'Till exempel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sky.clusters.map((c) => (
                        <tr key={c.id}>
                          <th scope="row">
                            {
                              [
                                'I',
                                'II',
                                'III',
                                'IV',
                                'V',
                                'VI',
                                'VII',
                                'VIII',
                              ][c.id]
                            }
                            , {c.size}
                          </th>
                          <td>
                            {c.highest
                              .map((h) => `${h.tissue} (${num(h.zip, 1)})`)
                              .join(', ')}
                          </td>
                          <td>{c.examples.slice(0, 3).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
                source={l(
                  `Drugs with at least 300 measurements, mean ZIP per tissue; k-means, k chosen by silhouette (${num(sky.silhouette[String(sky.k)] ?? 0, 2)})`,
                  `Läkemedel med minst 300 mätningar, medel-ZIP per vävnad; k-means, k valt efter silhuett (${num(sky.silhouette[String(sky.k)] ?? 0, 2)})`,
                )}
              >
                <DrugConstellation drugs={sky.drugs} clusters={sky.clusters} />
              </Feature>
            )}
            <Feature
              id="dc-pairs"
              title={l(
                'The most synergistic pairs in the data',
                'De mest synergistiska paren i datan',
              )}
              lead={l(
                'Measured, not predicted: mean ZIP across cell lines, for pairs tested on many cell lines.',
                'Uppmätt, inte förutsagt: medel-ZIP över cellinjer, för par testade på många cellinjer.',
              )}
              source={source}
            >
              {tables.pairs ? (
                <div
                  className="board-table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label={l(
                    'Table of the most synergistic pairs',
                    'Tabell över de mest synergistiska paren',
                  )}
                >
                  <table className="board-table">
                    <thead>
                      <tr>
                        <th scope="col">{l('Drug pair', 'Läkemedelspar')}</th>
                        <th scope="col" className="num">
                          {l('Cell lines', 'Cellinjer')}
                        </th>
                        <th scope="col" className="num">
                          {l('Mean ZIP', 'Medel-ZIP')}
                        </th>
                        <th scope="col" className="num">
                          {l('Synergistic in', 'Synergistiskt i')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tables.pairs.slice(0, 10).map((p) => (
                        <tr key={p.pair_name}>
                          <td>{p.pair_name}</td>
                          <td className="num">{num(p.cell_lines)}</td>
                          <td className="num">{num(p.mean_zip, 1)}</td>
                          <td className="num">{pct(p.share_synergistic, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty />
              )}
            </Feature>
          </div>
        </>
      )}
    </ReportShell>
  )
}

function Method({ report }: { report: Report }) {
  return (
    <>
      <div className="dc-explain-grid">
        <div>
          <h2>{l('Synergy', 'Synergi')}</h2>
          <p>
            {l(
              'Two drugs are synergistic when together they kill more cancer cells than their separate effects predict. The ZIP score measures that surplus: above 10 counts as synergy, below −10 as the drugs getting in each other’s way.',
              'Två läkemedel är synergistiska när de tillsammans dödar fler cancerceller än deras effekter var för sig förutsäger. ZIP-värdet mäter det överskottet: över 10 räknas som synergi, under −10 som att läkemedlen motverkar varandra.',
            )}
          </p>
        </div>
        <div>
          <h2>{l('The data', 'Datan')}</h2>
          <p>
            {l(
              'Laboratory screens from DrugCombDB, where drug pairs were tested on cancer cell lines, joined with each molecule’s structure and each cell line’s gene expression from DepMap. Every file is checked against its SHA-256 in the data manifest.',
              'Laboratorieförsök från DrugCombDB, där läkemedelspar testats på cancercellinjer, kopplade till varje molekyls struktur och varje cellinjes genuttryck från DepMap. Varje fil kontrolleras mot sin SHA-256 i datamanifestet.',
            )}
          </p>
        </div>
        <div>
          <h2>{l('The real question', 'Den egentliga frågan')}</h2>
          <p>
            {l(
              'Predicting a pair the model has almost seen is easy. The test that matters is a drug or a cell line it has never seen, so every model is scored four ways.',
              'Att förutsäga ett par som modellen nästan redan sett är lätt. Testet som betyder något är ett läkemedel eller en cellinje den aldrig sett, så varje modell prövas på fyra sätt.',
            )}
          </p>
        </div>
      </div>
      <ol
        className="dc-pipeline"
        aria-label={l('How it is built', 'Hur det är byggt')}
      >
        {[
          ['Raw screens and DepMap', 'Rådata och DepMap'],
          ['Match drug and cell names', 'Matcha namn på läkemedel och celler'],
          ['Star schema in DuckDB', 'Stjärnschema i DuckDB'],
          ['10 data-quality tests', '10 datakvalitetstester'],
          ['LightGBM and baselines', 'LightGBM och baslinjer'],
          ['Four test splits', 'Fyra testuppdelningar'],
        ].map(([en, sv], i) => (
          <li key={en}>
            <span>{i + 1}</span>
            {l(en, sv)}
          </li>
        ))}
      </ol>
      <h2>{l('Assumptions and limits', 'Antaganden och begränsningar')}</h2>
      <p>
        {l(
          'The effect of each drug alone comes from the same screens, so the model assumes those single-drug results are already known. Gene expression comes from the wider DepMap collection. A low score on shuffled answers is a diagnostic, not proof that every leakage risk is gone. None of this is clinical evidence.',
          'Effekten av varje läkemedel ensamt kommer från samma försök, så modellen förutsätter att de resultaten redan finns. Genuttrycket kommer från DepMaps bredare samling. Ett lågt värde på omblandade svar är en kontroll, inte ett bevis för att varje läckrisk är borta. Inget av detta är kliniska belägg.',
        )}
      </p>
      <p>
        {l(
          'The numbers are the published results of the pinned pipeline revision; the model was not retrained for this page. Raw files are not bundled; their sources, releases and hashes are in the input manifest.',
          'Siffrorna är de publicerade resultaten från den fastlåsta versionen av pipelinen; modellen tränades inte om för den här sidan. Rådatafilerna ingår inte; deras källor, versioner och kontrollsummor finns i indatamanifestet.',
        )}
      </p>
      <div className="product-actions">
        <a href="data/products/drugcomb/REPORT.md" download>
          {l('Full upstream report', 'Hela rapporten')}
        </a>
        <a href="data/products/drugcomb/data_manifest.json" download>
          {l('Input manifest', 'Indatamanifest')}
        </a>
        <a
          href={`${report.source.repository}/tree/${report.source.revision}`}
          target="_blank"
          rel="noreferrer"
        >
          {l('Source code at this revision', 'Källkoden i den här versionen')}
        </a>
      </div>
      <h2>
        {l('The original analysis figures', 'De ursprungliga analysfigurerna')}
      </h2>
      <div className="figure-gallery">
        {(
          [
            [
              'an_01_zip_distribution',
              1579,
              738,
              'Distribution of measured ZIP scores',
              'Fördelning av uppmätta ZIP-värden',
            ],
            [
              'an_02_replicate_agreement',
              1007,
              978,
              'Agreement between repeated measurements',
              'Överensstämmelse mellan upprepade mätningar',
            ],
            [
              'ml_03_pred_vs_obs',
              1007,
              978,
              'Predicted against measured',
              'Förutsagt mot uppmätt',
            ],
            [
              'ml_04_ablation',
              1681,
              868,
              'What each feature group adds',
              'Vad varje egenskapsgrupp tillför',
            ],
            [
              'ml_05_overfitting',
              1981,
              792,
              'Overfitting check',
              'Kontroll av överanpassning',
            ],
            [
              'an_06_top_pairs',
              1582,
              1378,
              'The strongest pairs',
              'De starkaste paren',
            ],
          ] as [string, number, number, string, string][]
        ).map(([file, w, h, en, sv]) => (
          <figure key={file}>
            <a
              href={`data/products/drugcomb/figures/${file}.svg`}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={`data/products/drugcomb/figures/${file}.png`}
                alt={l(en, sv)}
                width={w}
                height={h}
                loading="lazy"
              />
            </a>
            <figcaption>{l(en, sv)}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
