/**
 * The degree project's figures (FACTS) and number formatting, for ThesisCase.tsx and its copy.
 * The thesis is the source: "NLP-baserad klustring av ITSM-data", AIDEV24s, spring 2026.
 * Every figure carries the page of the thesis PDF; nothing names an internal system.
 * Where the thesis text and its tables disagree, the table wins (XGBoost, silhouette gain).
 */
import { currentLocale, l } from '../i18n'

export const FACTS = {
  /** The case, p. 6. */
  members: 1.5, // million people whose pensions and insurance Fora AB manages, p. 6
  incidentsPerMonth: 350, // p. 6
  /** Data, p. 13, 18, 26, 29. */
  period: { from: '2020-04-01', to: '2026-04-14' }, // the data-quality measurement, p. 13, 18
  records: 21_633, // tickets in the data-quality measurement, p. 13, 18
  srDescription: 19.3, // service requests: description filled, % (incidents 90.4), p. 13
  description: 90.4, // incidents: description filled, %, p. 13, 19
  anonymised: 19_847, // unique incidents after filtering, all anonymised, p. 26
  anonymiseMinutes: 12, // p. 26
  pii: { person: 21_476, email: 3_180, phone: 285, idNumber: 126 }, // detections, p. 26-27
  selectedRun: 16_811, // tickets in the text_weighted run, p. 28-29, 35
  /** Method, p. 14, 15, 28. */
  dims: { from: 768, to: 10 }, // UMAP, p. 14
  umapNeighbours: 30, // p. 14
  hdbscan: { sweep: [10, 20, 30, 50], mcs: 30, minSamples: 15 }, // p. 14, 29
  weights: { subject: 3, analysis: 4, description: 1 }, // text_weighted recipe, p. 28
  glossaryTerms: 70, // p. 15, 28
  glossary: { without: 36.1, with: 52.4, gainPts: 16 }, // best cluster's problem-link share, p. 28
  bestClusterLinked: 75.8, // text_weighted, highest of five text versions, p. 28
  /** HDBSCAN on text_weighted, mcs 30 / min_samples 15, p. 29-32. */
  clusters: 121, // p. 29
  noisePct: 27.7, // p. 29 (table 4.2.4)
  clusteredPct: 72.3, // tickets in a cluster, p. 38
  silhouette: { hdbscan: 0.706, kmeans: 0.534, kmeansClusters: 73 }, // table 4.2.4, p. 29
  silhouetteGain: [27, 32], // % over K-means, three text versions; table 4.2.4, p. 29
  linkedClusters: 49, // clusters with at least one problem link, p. 30, 37
  linkedClustersPct: 40, // p. 30
  unlinked: 72, // clusters with no problem link, p. 32, 38
  unlinkedPct: 60, // p. 32
  unlinkedTickets: 5_605, // p. 32-33
  highlighted: { groups: 12, tickets: 650 }, // the most actionable subset, p. 36 (also table 4.2.8)
  examples: { desktop: 93, adminLogin: 210, queueClusters: 3 }, // p. 33, 38
  desktopYears: [2021, 2024], // p. 38
  ghostClusters: 3, // section 4.2.5, p. 32 (table 4.2.8 lists 4 clusters, 291 tickets)
  priority: { low: 0.522, high: 0.368 }, // silhouette, p. 31, 37
  fragments: { clusters: 10, tickets: 625 }, // one generic error message, p. 34, 37
  coarserMcs: [50, 70], // suggested min_cluster_size, p. 37
  /** XGBoost on the problem links, table 4.2.10, p. 35. */
  xgb: {
    rocAuc: 0.882,
    prAuc: 0.426,
    random: 0.048,
    precision: 0.26,
    recall: 0.58,
    f1: 0.36,
  },
  /** ISO/IEC 25012, p. 19-25. Percent of the 21,633 records. */
  iso: {
    analysis: 4.2, // completeness, p. 19-20
    solutionFilled: 82.2, // completeness, p. 19
    solutionManual: 3.8, // completeness, p. 19
    categories: 15, // accuracy, p. 22
    subCategories: 50, // accuracy, p. 22
    statusValid: 100, // consistency, system-enforced, p. 23
    unique: 92.8, // uniqueness, p. 24
    unique2021: 82.8, // uniqueness, p. 24
    linked: 5.1, // traceability, p. 24
    linked2026: 15.7, // traceability, p. 24
  },
  linkLowYears: [2022, 2023], // problem links near zero, p. 16, 24
  /** Fill rate per year, table 4.2, p. 20. 2026 is a partial year. */
  years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
  category: [4.6, 2.3, 17.2, 52.3, 79.8, 80.4, 99.9],
  analysisByYear: [0, 0, 0, 0, 2.0, 11.7, 13.3],
  businessArea: { y2024: 0.2, y2026: 69.2 }, // a structured field after an interface change, p. 20, 36
  rcaHighPriority: { y2023: 0, y2026: 66.7 }, // urgent/high incidents with a root-cause analysis, p. 24
} as const

const locale = () => (currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')
export const num = (n: number) => n.toLocaleString(locale())
export const dec = (n: number) =>
  n.toLocaleString(locale(), { maximumFractionDigits: 3 })
export const pct = (n: number) =>
  l(`${n.toLocaleString('en-GB')}%`, `${n.toLocaleString('sv-SE')} %`)
/** "27–32%" / "27–32 %". */
export const pctRange = ([a, b]: readonly number[]) =>
  l(`${a}–${b}%`, `${a}–${b} %`)
