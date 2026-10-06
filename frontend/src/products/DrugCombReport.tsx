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
import { Card, Cards, Empty, Kpi, Kpis } from '../politik/board/Board'
import Columns from '../politik/board/Columns'
import DashBars from '../politik/dash/DashBars'
import '../politik/dash/dash.css'
import './drugcomb.css'
import BodyMap, { type Lineage } from './BodyMap'
import DecisionTree, { leavesOf, type TreeNode } from './DecisionTree'
import DrugConstellation, {
  type DrugCluster,
  type DrugPoint,
} from './DrugConstellation'
import { Stage, StageBlock, StageFacts, StageTools } from '../ui/Stage'
import './mlviz.css'
import '../politik/modell/modell.css'

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

const nf = () => (currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')
const num = (n: number, digits = 0) =>
  n.toLocaleString(nf(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
const pct = (share: number, digits = 1) => `${num(share * 100, digits)} %`

export default function DrugCombReport() {
  const [report, setReport] = useState<Report | null>(null)
  const [tables, setTables] = useState<Partial<Tables>>({})
  const [split, setSplit] = useState('random')
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
  const best = metric('random', 'lgbm_all')
  const hardest = metric('cold_drug', 'lgbm_all')
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

  return (
    <article className="report drugcomb-board" id="drugcomb">
      <Stage
        id="dc-body"
        kicker={l('DrugComb · 01 · the data', 'DrugComb · 01 · datan')}
        title={l(
          'Where the cancer cells come from',
          'Var cancercellerna kommer ifrån',
        )}
        lead={l(
          'Every screened cell line has a tissue of origin. Point at one to read it.',
          'Varje testad cellinje har en ursprungsvävnad. Peka på en för att läsa den.',
        )}
        figure={
          <BodyMap lineages={report.lineages} highlight={tissue || null} />
        }
        left={
          <>
            <StageBlock title={l('Slicer', 'Filter')}>
              <label className="modell-select">
                <span>{l('Tissue', 'Vävnad')}</span>
                <select
                  value={tissue}
                  onChange={(e) => setTissue(e.target.value)}
                >
                  <option value="">{l('All tissues', 'Alla vävnader')}</option>
                  {[...report.lineages]
                    .sort((a, b) => b.combinations - a.combinations)
                    .map((t) => (
                      <option key={t.lineage} value={t.lineage}>
                        {t.lineage}
                      </option>
                    ))}
                </select>
              </label>
            </StageBlock>
            <StageBlock title={l('Data', 'Data')}>
              <StageFacts
                rows={[
                  [l('Measurements', 'Mätningar'), num(o.combinations)],
                  [l('Drug pairs', 'Läkemedelspar'), num(o.drug_pairs)],
                  [l('Drugs', 'Läkemedel'), num(o.drugs)],
                  [l('Cell lines', 'Cellinjer'), num(o.cell_lines)],
                  [l('Tissue types', 'Vävnadstyper'), num(o.lineages)],
                ]}
              />
            </StageBlock>
            <StageBlock title={l('Sources', 'Källor')}>
              <p>
                {l(
                  'DrugCombDB screens, joined with DepMap 24Q4 for each cell line’s tissue and gene expression. Every file is checked against its SHA-256 in the data manifest.',
                  'Försök från DrugCombDB, kopplade till DepMap 24Q4 för varje cellinjes vävnad och genuttryck. Varje fil kontrolleras mot sin SHA-256 i datamanifestet.',
                )}
              </p>
            </StageBlock>
            <StageBlock title={l('Pipeline', 'Pipeline')}>
              <ol className="stage-steps">
                {[
                  ['Raw screens and DepMap', 'Rådata och DepMap'],
                  [
                    'Match drug and cell names',
                    'Matcha namn på läkemedel och celler',
                  ],
                  ['Star schema in DuckDB', 'Stjärnschema i DuckDB'],
                  ['10 data-quality tests', '10 datakvalitetstester'],
                  ['LightGBM and baselines', 'LightGBM och baslinjer'],
                  ['Four test splits', 'Fyra testuppdelningar'],
                ].map(([en, sv]) => (
                  <li key={en}>{l(en, sv)}</li>
                ))}
              </ol>
            </StageBlock>
          </>
        }
        right={
          <>
            <StageBlock title={l('Synergy', 'Synergi')}>
              <StageFacts
                rows={[
                  [
                    l('Synergistic (ZIP > 10)', 'Synergistiska (ZIP > 10)'),
                    pct(o.share_synergistic),
                  ],
                  [
                    l('Antagonistic (ZIP < −10)', 'Motverkande (ZIP < −10)'),
                    pct(o.share_antagonistic),
                  ],
                  [l('Mean ZIP', 'Medel-ZIP'), num(o.mean_zip, 2)],
                ]}
              />
            </StageBlock>
            <StageBlock title={l('Model (LightGBM)', 'Modell (LightGBM)')}>
              <StageFacts
                rows={SPLITS.map(([id, en, sv]) => [
                  l(en, sv),
                  num(metric(id, 'lgbm_all')?.pearson ?? 0, 2),
                ])}
              />
              <p>
                {l(
                  'Pearson correlation between predicted and measured ZIP, per test split.',
                  'Pearson-korrelation mellan förutsagd och uppmätt ZIP, per testuppdelning.',
                )}
              </p>
            </StageBlock>
            <StageBlock title={l('Tools', 'Verktyg')}>
              <StageTools
                items={[
                  'Python',
                  'DuckDB',
                  'pandas',
                  'LightGBM',
                  'scikit-learn',
                  'RDKit',
                  'React',
                  'SVG',
                ]}
              />
            </StageBlock>
          </>
        }
      />

      {treeFile && (
        <Stage
          id="dc-tree"
          kicker={l(
            'DrugComb · 02 · a model you can read',
            'DrugComb · 02 · en modell man kan läsa',
          )}
          title={l(
            'How a decision tree decides',
            'Så bestämmer ett beslutsträd',
          )}
          lead={l(
            'A tree asks one yes-or-no question at a time and sends each measurement left or right until it lands in a leaf. LightGBM adds hundreds of trees like this one; this single tree shows the idea.',
            'Ett träd ställer en ja-eller-nej-fråga i taget och skickar varje mätning åt vänster eller höger tills den hamnar i ett löv. LightGBM lägger ihop hundratals sådana träd; det här enda trädet visar idén.',
          )}
          figure={
            <DecisionTree
              root={treeFile.tree}
              highlight={leaf === '' ? null : Number(leaf)}
            />
          }
          left={
            <>
              <StageBlock title={l('Slicer', 'Filter')}>
                <label className="modell-select">
                  <span>{l('Follow a leaf', 'Följ ett löv')}</span>
                  <select
                    value={leaf}
                    onChange={(e) => setLeaf(e.target.value)}
                  >
                    <option value="">{l('None', 'Inget')}</option>
                    {leavesOf(treeFile.tree)
                      .map((n, i) => ({ n, i }))
                      .sort((a, b) => b.n.share - a.n.share)
                      .map(({ n, i }) => (
                        <option key={n.id} value={n.id}>
                          {l('Leaf', 'Löv')} {i + 1} · {pct(n.share)} ·{' '}
                          {num(n.n)}
                        </option>
                      ))}
                  </select>
                </label>
              </StageBlock>
              <StageBlock title={l('Question', 'Fråga')}>
                <p>
                  {l(
                    'Is a drug pair on a cell line synergistic (ZIP > 10)?',
                    'Är ett läkemedelspar på en cellinje synergistiskt (ZIP > 10)?',
                  )}
                </p>
              </StageBlock>
              <StageBlock title={l('Split', 'Uppdelning')}>
                <StageFacts
                  rows={[
                    [
                      l('Training', 'Träning'),
                      num(treeFile.metrics.train_measurements),
                    ],
                    [
                      l('Test', 'Test'),
                      num(treeFile.metrics.test_measurements),
                    ],
                    [
                      l('Unseen test pairs', 'Osedda testpar'),
                      num(treeFile.metrics.test_pairs),
                    ],
                  ]}
                />
                <p>
                  {l(
                    'Split by drug pair, so every test pair is new to the tree. Features are computed from the training pairs only.',
                    'Uppdelat per läkemedelspar, så varje testpar är nytt för trädet. Egenskaperna räknas bara från träningsparen.',
                  )}
                </p>
              </StageBlock>
              <StageBlock title={l('Features', 'Egenskaper')}>
                <p>
                  {l(
                    'Each drug’s mean ZIP (the stronger and the weaker of the pair), the cell line’s mean ZIP and its tissue.',
                    'Varje läkemedels medel-ZIP (det starkare och det svagare i paret), cellinjens medel-ZIP och dess vävnad.',
                  )}
                </p>
                <p>
                  {l(
                    `${num(treeFile.method.dropped_invalid_zip)} measurements with an impossible |ZIP| > 100 left out.`,
                    `${num(treeFile.method.dropped_invalid_zip)} mätningar med omöjligt |ZIP| > 100 utelämnade.`,
                  )}
                </p>
              </StageBlock>
            </>
          }
          right={
            <>
              <StageBlock title={l('On unseen pairs', 'På osedda par')}>
                <StageFacts
                  rows={[
                    ['ROC AUC', num(treeFile.metrics.roc_auc, 3)],
                    [
                      l('Average precision', 'Genomsnittlig precision'),
                      num(treeFile.metrics.average_precision, 3),
                    ],
                    [
                      l('Base rate', 'Basnivå'),
                      pct(treeFile.metrics.base_rate),
                    ],
                    [
                      l('Leaves · depth', 'Löv · djup'),
                      `${treeFile.metrics.leaves} · ${treeFile.metrics.depth}`,
                    ],
                  ]}
                />
                <p>
                  {l(
                    'AUC 0.5 is guessing; average precision is compared with the base rate.',
                    'AUC 0,5 är gissning; genomsnittlig precision jämförs med basnivån.',
                  )}
                </p>
              </StageBlock>
              <StageBlock title={l('What it splits on', 'Vad den delar på')}>
                {treeFile.importance.map((f) => (
                  <div key={f.feature}>
                    {l(f.label.en, f.label.sv)}
                    <div className="stage-bar">
                      <span>
                        <i style={{ width: `${f.gain * 100}%` }} />
                      </span>
                      <b>{num(f.gain * 100, 0)} %</b>
                    </div>
                  </div>
                ))}
              </StageBlock>
              <StageBlock title={l('Tools', 'Verktyg')}>
                <StageTools
                  items={[
                    'scikit-learn',
                    'pandas',
                    'GroupShuffleSplit',
                    'SVG animateMotion',
                  ]}
                />
              </StageBlock>
            </>
          }
        />
      )}

      {sky && (
        <Stage
          id="dc-sky"
          kicker={l('DrugComb · 03 · clustering', 'DrugComb · 03 · klustring')}
          title={l('Drugs that behave alike', 'Läkemedel som beter sig lika')}
          lead={l(
            'Each star is a drug, placed by where it is synergistic. Drugs that cluster together are joined like a constellation. Choose a cluster to see it alone.',
            'Varje stjärna är ett läkemedel, placerat efter var det är synergistiskt. Läkemedel i samma kluster binds ihop som en stjärnbild. Välj ett kluster för att se det ensamt.',
          )}
          figure={
            <DrugConstellation drugs={sky.drugs} clusters={sky.clusters} />
          }
          left={
            <>
              <StageBlock title={l('Method', 'Metod')}>
                <StageFacts
                  rows={[
                    [l('Drugs', 'Läkemedel'), num(sky.drugs.length)],
                    [
                      l('Profile', 'Profil'),
                      `${sky.tissues.length} ${l('tissues', 'vävnader')}`,
                    ],
                    [l('Clusters (k)', 'Kluster (k)'), String(sky.k)],
                  ]}
                />
                <p>
                  {l(
                    'Drugs with at least 300 measurements, each described by its mean ZIP in every tissue, standardised. k-means for k = 3–8; the k with the best silhouette is kept. The map is the first two principal components, distances compressed (asinh) so far drugs fit.',
                    'Läkemedel med minst 300 mätningar, var och ett beskrivet av sitt medel-ZIP i varje vävnad, standardiserat. k-means för k = 3–8; det k med bäst silhuett behålls. Kartan är de två första principalkomponenterna, med avstånden komprimerade (asinh) så att avlägsna läkemedel får plats.',
                  )}
                </p>
              </StageBlock>
              <StageBlock title={l('Silhouette by k', 'Silhuett per k')}>
                {Object.entries(sky.silhouette).map(([k, v]) => (
                  <div key={k} className="stage-bar">
                    <span>
                      <i
                        style={{
                          width: `${Math.max(v, 0) * 100}%`,
                          opacity: Number(k) === sky.k ? 1 : 0.45,
                        }}
                      />
                    </span>
                    <b>
                      k={k} {num(v, 2)}
                    </b>
                  </div>
                ))}
              </StageBlock>
            </>
          }
          right={
            <StageBlock title={l('The clusters', 'Klustren')}>
              {sky.clusters.map((c) => (
                <p key={c.id}>
                  <b>
                    {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][c.id]} ·{' '}
                    {c.size} {l('drugs', 'läkemedel')}
                  </b>
                  <br />
                  {l('Highest ZIP in', 'Högst ZIP i')}{' '}
                  {c.highest
                    .map((h) => `${h.tissue} (${num(h.zip, 1)})`)
                    .join(', ')}
                  . {l('E.g.', 'T.ex.')} {c.examples.slice(0, 3).join(', ')}.
                </p>
              ))}
            </StageBlock>
          }
        />
      )}

      <CalibrationScatter
        points={
          (tables.calibration ?? []) as Parameters<
            typeof CalibrationScatter
          >[0]['points']
        }
        splits={SPLITS}
      />
      <section className="dc-explain" aria-labelledby="dc-question">
        <h2 id="dc-question">
          {l(
            'Can a model tell which drugs work better together?',
            'Kan en modell se vilka läkemedel som fungerar bättre tillsammans?',
          )}
        </h2>
        <div className="dc-explain-grid">
          <div>
            <h3>{l('Synergy', 'Synergi')}</h3>
            <p>
              {l(
                'Two drugs are synergistic when together they kill more cancer cells than their separate effects predict. The ZIP score measures that surplus: above 10 counts as synergy, below −10 as the drugs getting in each other’s way.',
                'Två läkemedel är synergistiska när de tillsammans dödar fler cancerceller än deras effekter var för sig förutsäger. ZIP-värdet mäter det överskottet: över 10 räknas som synergi, under −10 som att läkemedlen motverkar varandra.',
              )}
            </p>
          </div>
          <div>
            <h3>{l('The data', 'Datan')}</h3>
            <p>
              {l(
                'Laboratory screens from DrugCombDB, where drug pairs were tested on cancer cell lines, joined with each molecule’s structure and each cell line’s gene expression from DepMap.',
                'Laboratorieförsök från DrugCombDB, där läkemedelspar testats på cancercellinjer, kopplade till varje molekyls struktur och varje cellinjes genuttryck från DepMap.',
              )}
            </p>
          </div>
          <div>
            <h3>{l('The real question', 'Den egentliga frågan')}</h3>
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
            [
              'Match drug and cell names',
              'Matcha namn på läkemedel och celler',
            ],
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
      </section>

      <Kpis>
        <Kpi
          index={0}
          label={l('Measurements', 'Mätningar')}
          value={o.combinations}
          format={(v) => num(v)}
          sub={l('pair × cell line × study', 'par × cellinje × studie')}
        />
        <Kpi
          index={1}
          label={l('Drug pairs', 'Läkemedelspar')}
          value={o.drug_pairs}
          format={(v) => num(v)}
        />
        <Kpi
          index={2}
          label={l('Drugs', 'Läkemedel')}
          value={o.drugs}
          format={(v) => num(v)}
        />
        <Kpi
          index={3}
          label={l('Cell lines', 'Cellinjer')}
          value={o.cell_lines}
          format={(v) => num(v)}
          sub={`${o.lineages} ${l('tissue types', 'vävnadstyper')}`}
        />
        <Kpi
          index={4}
          label={l('Synergistic', 'Synergistiska')}
          value={o.share_synergistic * 100}
          format={(v) => `${num(v, 1)} %`}
          sub={`${pct(o.share_antagonistic)} ${l('antagonistic', 'motverkande')}`}
        />
        {best && (
          <Kpi
            index={5}
            label={l('Best correlation', 'Bästa korrelation')}
            value={best.pearson ?? 0}
            format={(v) => num(v, 2)}
            sub={`${l('new drug', 'nytt läkemedel')}: ${num(hardest?.pearson ?? 0, 2)}`}
          />
        )}
      </Kpis>

      <Cards>
        <Card
          index={0}
          wide
          title={l(
            'Does the prediction hold up on something new?',
            'Håller förutsägelsen på något nytt?',
          )}
          meta={l(
            'Correlation between predicted and measured ZIP (Pearson, 0 = no relation, 1 = perfect), mean of three folds',
            'Korrelation mellan förutsagd och uppmätt ZIP (Pearson, 0 = inget samband, 1 = perfekt), medel av tre omgångar',
          )}
        >
          <Columns
            categories={SPLITS.map((s) => l(s[1], s[2]))}
            series={MODELS.map(([id, en, sv]) => ({
              key: id,
              label: l(en, sv),
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
          <p className="dc-note">
            {l(
              'Read it left to right: the further right, the less the model has seen before. Every model loses accuracy on a new drug or cell line, but the LightGBM model with all features stays the most accurate in all four, ahead of simply reusing earlier results.',
              'Läs från vänster till höger: ju längre till höger, desto mindre har modellen sett förut. Alla modeller tappar på ett nytt läkemedel eller en ny cellinje, men LightGBM-modellen med alla egenskaper är träffsäkrast i alla fyra, före att bara återanvända tidigare resultat.',
            )}
          </p>
        </Card>

        <Card
          index={1}
          title={l(
            'From raw rows to a modelling table',
            'Från rådata till modelltabell',
          )}
          meta={l(
            'Rows kept after each cleaning step',
            'Rader kvar efter varje städsteg',
          )}
        >
          <DashBars
            bars={report.funnel.map((f) => ({
              key: f.step,
              label:
                currentLocale() === 'sv' ? (STEP_SV[f.step] ?? f.step) : f.step,
              value: f.rows,
              tone: 'neutral' as const,
            }))}
            format={(v) => num(v)}
            label={l('Cleaning funnel', 'Städtratten')}
          />
        </Card>

        <Card
          index={2}
          title={l('Data-quality tests', 'Datakvalitetstester')}
          meta={l(
            `${passed} of ${tables.quality?.length ?? 10} passed`,
            `${passed} av ${tables.quality?.length ?? 10} godkända`,
          )}
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
                    {q.detail && <small> · {q.detail}</small>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={3}
          title={l(
            'Matching names to identities',
            'Namn matchade till identiteter',
          )}
          meta={l(
            'Share of measurements resolved by each method',
            'Andel av mätningarna som löstes med varje metod',
          )}
        >
          {tables.entities ? (
            <DashBars
              bars={tables.entities.map((e) => ({
                key: `${e.entity}-${e.method}`,
                label: `${e.entity === 'drug' ? l('Drug', 'Läkemedel') : l('Cell line', 'Cellinje')} · ${e.method}`,
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
          <p className="dc-note">
            {l(
              `${pct(o.share_with_structures)} of the rows have a chemical structure for both drugs, ${pct(o.share_with_rna)} have gene expression for the cell line.`,
              `${pct(o.share_with_structures)} av raderna har kemisk struktur för båda läkemedlen, ${pct(o.share_with_rna)} har genuttryck för cellinjen.`,
            )}
          </p>
        </Card>

        <Card
          index={4}
          title={l('What the model relies on', 'Vad modellen lutar sig mot')}
          meta={l(
            `Share of the model’s total gain per feature family · ${splitName(split)}`,
            `Andel av modellens totala vinst per egenskapsgrupp · ${splitName(split)}`,
          )}
        >
          <div
            className="dc-split"
            role="group"
            aria-label={l('Test split', 'Testuppdelning')}
          >
            {SPLITS.map(([id, en, sv]) => (
              <button
                key={id}
                type="button"
                aria-pressed={split === id}
                onClick={() => setSplit(id)}
              >
                {l(en, sv)}
              </button>
            ))}
          </div>
          {families.length ? (
            <DashBars
              bars={families.map((f) => ({
                key: f.family,
                label:
                  currentLocale() === 'sv'
                    ? (FAMILY_SV[f.family] ?? f.family)
                    : f.family,
                value: (f.gain / familyTotal) * 100,
                tone: 'neutral' as const,
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
        </Card>

        <Card
          index={5}
          title={l(
            'Does it find the strongest pairs?',
            'Hittar den de starkaste paren?',
          )}
          meta={l(
            `Share of real synergy among the pairs the model ranks highest · ${splitName(split)}`,
            `Andel verklig synergi bland paren modellen rankar högst · ${splitName(split)}`,
          )}
        >
          {enrichment.length ? (
            <>
              <Columns
                categories={enrichment.map(
                  (e) => `${l('top', 'topp')} ${num(e.top_fraction * 100)} %`,
                )}
                series={[
                  {
                    key: 'hit',
                    label: l('Among the model’s picks', 'Bland modellens val'),
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
              <p className="dc-note">
                {l(
                  `In the top 1 %, ${pct(enrichment[0].hit_rate, 0)} are truly synergistic, against ${pct(enrichment[0].base_rate, 0)} overall: ${num(enrichment[0].hit_rate / enrichment[0].base_rate, 0)} times more. That is what a lab choosing what to test next would use.`,
                  `Bland topp 1 % är ${pct(enrichment[0].hit_rate, 0)} verkligt synergistiska, mot ${pct(enrichment[0].base_rate, 0)} totalt: ${num(enrichment[0].hit_rate / enrichment[0].base_rate, 0)} gånger fler. Det är det ett labb som väljer vad som ska testas härnäst skulle använda.`,
                )}
              </p>
            </>
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={6}
          title={l(
            'Are the predictions calibrated?',
            'Stämmer förutsägelserna i nivå?',
          )}
          meta={l(
            `Mean predicted and measured ZIP per tenth of the predictions · ${splitName(split)}`,
            `Medel av förutsagd och uppmätt ZIP per tiondel av förutsägelserna · ${splitName(split)}`,
          )}
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
        </Card>

        <Card
          index={7}
          title={l(
            'More data helps, then levels off',
            'Mer data hjälper, sedan planar det ut',
          )}
          meta={l(
            'Correlation on training and test data as the training set grows',
            'Korrelation på tränings- och testdata när träningsmängden växer',
          )}
        >
          {tables.learning ? (
            <>
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
              <p className="dc-note">
                {l(
                  'The gap between training and test narrows as data grows: the model memorises less and generalises more.',
                  'Glappet mellan träning och test krymper när datan växer: modellen lär sig mindre utantill och generaliserar mer.',
                )}
              </p>
            </>
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={8}
          title={l('A check against luck', 'En kontroll mot slumpen')}
          meta={l(
            'The same model trained on shuffled answers',
            'Samma modell tränad på omblandade svar',
          )}
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
                    metric(tables.scramble[0].scheme, 'lgbm_all')?.pearson ?? 0,
                    3,
                  )}
                </strong>
                <span>
                  {l(
                    'correlation with the real answers',
                    'korrelation med de riktiga svaren',
                  )}
                </span>
              </p>
              <p className="dc-note">
                {l(
                  `When the answers are shuffled the model finds nothing (${splitName(tables.scramble[0].scheme).toLowerCase()} split). So the result comes from real patterns, not from information leaking between training and test. It is a useful check, not proof that every leak is ruled out.`,
                  `När svaren blandas om hittar modellen ingenting (uppdelning ${splitName(tables.scramble[0].scheme).toLowerCase()}). Resultatet kommer alltså från verkliga mönster, inte från information som läcker mellan träning och test. Det är en användbar kontroll, inte ett bevis för att varje läcka är utesluten.`,
                )}
              </p>
            </div>
          ) : (
            <Empty />
          )}
        </Card>

        <Card
          index={10}
          wide
          title={l(
            'The most synergistic pairs in the data',
            'De mest synergistiska paren i datan',
          )}
          meta={l(
            'Measured, not predicted: mean ZIP across cell lines, pairs tested on many cell lines',
            'Uppmätt, inte förutsagt: medel-ZIP över cellinjer, par testade på många cellinjer',
          )}
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
        </Card>
      </Cards>

      <details className="method">
        <summary>
          {l(
            'Assumptions, limits and downloads',
            'Antaganden, begränsningar och nedladdningar',
          )}
        </summary>
        <div>
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
            <a href="#drugcomb-data">
              {l('Browse all result tables', 'Bläddra i alla resultattabeller')}
            </a>
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
              {l(
                'Source code at this revision',
                'Källkoden i den här versionen',
              )}
            </a>
          </div>
        </div>
      </details>
      <details className="method">
        <summary>
          {l(
            'The original analysis figures',
            'De ursprungliga analysfigurerna',
          )}
        </summary>
        <div className="figure-gallery">
          {[
            [
              'an_01_zip_distribution',
              'Distribution of measured ZIP scores',
              'Fördelning av uppmätta ZIP-värden',
            ],
            [
              'an_02_replicate_agreement',
              'Agreement between repeated measurements',
              'Överensstämmelse mellan upprepade mätningar',
            ],
            [
              'ml_03_pred_vs_obs',
              'Predicted against measured',
              'Förutsagt mot uppmätt',
            ],
            [
              'ml_04_ablation',
              'What each feature group adds',
              'Vad varje egenskapsgrupp tillför',
            ],
            [
              'ml_05_overfitting',
              'Overfitting check',
              'Kontroll av överanpassning',
            ],
            ['an_06_top_pairs', 'The strongest pairs', 'De starkaste paren'],
          ].map(([file, en, sv]) => (
            <figure key={file}>
              <a
                href={`data/products/drugcomb/figures/${file}.svg`}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={`data/products/drugcomb/figures/${file}.png`}
                  alt={l(en, sv)}
                  loading="lazy"
                />
              </a>
              <figcaption>{l(en, sv)}</figcaption>
            </figure>
          ))}
        </div>
      </details>
    </article>
  )
}
