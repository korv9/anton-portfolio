/**
 * The degree project's figures (FACTS) and the method copy that cites them, for ThesisCase.tsx.
 * Every figure here is in FACTS with its source; nothing names an internal system.
 */
import { currentLocale, l } from '../i18n'

/** ER = docs/thesis-evidence-review.md; p. = page of the thesis PDF. */
export const FACTS = {
  records: 21_633, // ER "Population och urval"; p. 13, 18
  selectedRun: 16_811, // ER "Population och urval": the text_weighted run; p. 26-29
  clusters: 121, // ER "Klustring": HDBSCAN 30/15; p. 29
  unlinked: 72, // ER "Problemkopplingar"; p. 30, 32
  unlinkedTickets: 5_605, // ER "Problemkopplingar"
  highlighted: { groups: 12, tickets: 650 }, // ER "Problemkopplingar"; p. 33, 36
  /** Tickets of the selected run by outcome; sums to 16,811. p. 44 (figure legend). */
  split: { linked: 613, clustered: 11_539, noise: 4_659 },
  noisePct: 27.7, // ER "Jämförelse och utvärdering"; p. 29, 38, 42
  silhouette: { hdbscan: 0.706, kmeans: 0.534, kmeansClusters: 73 }, // ER "Jämförelse och utvärdering"
  /** ISO/IEC 25012, ER "Utökning av ISO-resultat" (p. 19-25). Percent of the 21,633 records. */
  iso: {
    analysis: 4.2, // completeness, p. 19-20
    solutionFilled: 82.2, // completeness, p. 19
    solutionManual: 3.8, // completeness, p. 19
    categories: 15, // accuracy, p. 21-22
    subCategories: 50, // accuracy, p. 21-22
    statusValid: 100, // consistency, system-enforced, p. 23
    unique: 92.8, // uniqueness, p. 23-24
    unique2021: 82.8, // uniqueness, p. 24
    linked: 5.1, // traceability, p. 24-25
    linked2026: 15.7, // traceability, p. 24-25
  },
  /** Fill rate per year, p. 20; ER "Utökning av ISO-resultat" confirms 99.9 % (2026) and the
      analysis field's 11.7 % (2025) and 13.3 % (2026). 2026 is a partial year. */
  years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
  category: [4.6, 2.3, 17.2, 52.3, 79.8, 80.4, 99.9],
  analysisByYear: [0, 0, 0, 0, 2.0, 11.7, 13.3],
  /** Method findings and validation: thesis pages 14–16, 26–35. */
  linkedClusters: 49, // clusters with at least one problem link, of 121
  rocAuc: 0.882, // gradient-boosted classifier trained on the problem links
  f1: 0.36, // the same classifier, per ticket
  glossaryTerms: 70, // internal system names mapped to a short English description
  glossaryGainPts: 16, // percentage points of agreement with the problem records
  anonymised: 19_847, // tickets masked in two layers
  anonymiseMinutes: 12, // time to mask them
  examples: { desktop: 93, adminLogin: 210 }, // tickets in two clusters without a problem record
} as const

export const locale = () => (currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')
export const num = (n: number) => n.toLocaleString(locale())
const dec = (n: number) =>
  n.toLocaleString(locale(), { maximumFractionDigits: 2 })
export const pct = (n: number) =>
  l(`${n.toLocaleString('en-GB')}%`, `${n.toLocaleString('sv-SE')} %`)

/** "Two things I found on the way": a bold lead, then the paragraph. */
export function findings() {
  const { glossaryTerms: terms, glossaryGainPts: pts } = FACTS
  return [
    {
      lead: l(
        'Anonymisation can invent clusters.',
        'Anonymisering kan hitta på kluster.',
      ),
      text: l(
        'Personal names were replaced with a placeholder before embedding. Tickets that shared a subject template with a name in it then looked identical to the model, and three tight clusters formed around the placeholder rather than around any shared fault; none of their tickets had a problem link. The fix is one line, strip the placeholder after anonymising and before embedding, and the three clusters were excluded from the candidate list.',
        'Personnamn ersattes med en platshållare före inbäddningen. Ärenden som delade en ämnesmall med ett namn i blev då identiska för modellen, och tre täta kluster bildades kring platshållaren i stället för kring något gemensamt fel; inget av deras ärenden hade en problemkoppling. Lösningen är en rad, ta bort platshållaren efter anonymiseringen och före inbäddningen, och de tre klustren togs bort ur kandidatlistan.',
      ),
    },
    {
      lead: l(
        'A glossary beat a bigger model.',
        'En ordlista slog en större modell.',
      ),
      text: l(
        `The tickets are full of internal system codes that a general sentence model has never seen. I mapped ${terms} of them to a short English description each, added before embedding, and compared runs with and without the glossary on otherwise identical text. The share of the best cluster that agreed with the IT team's own problem records rose by ${pts} percentage points, with the model unchanged.`,
        `Ärendena är fulla av interna systemkoder som en allmän meningsmodell aldrig sett. Jag mappade ${terms} av dem till en kort engelsk beskrivning var, tillagd före inbäddningen, och jämförde körningar med och utan ordlistan på i övrigt identisk text. Andelen av det bästa klustret som stämde med IT-teamets egna problemärenden steg med ${pts} procentenheter, med modellen oförändrad.`,
      ),
    },
  ]
}

/** The method paragraphs that follow the silhouette paragraph, in order. */
export function methodNotes() {
  const { linkedClusters, clusters, unlinked, examples } = FACTS
  return [
    l(
      `Three measures validated the clusters: silhouette for geometry; the share of each cluster already linked to a problem record, for agreement with the IT team (${linkedClusters} of ${clusters} clusters had at least one such link, and the model never saw the links); and a gradient-boosted classifier trained on the links, as a check that the embeddings carry the signal at all. They did (ROC-AUC ${dec(FACTS.rocAuc)}), but too weakly per ticket to use (F1 ${dec(FACTS.f1)}), which is why the method works at group level and not ticket by ticket.`,
      `Tre mått validerade klustren: silhuett för geometrin; andelen av varje kluster som redan var kopplad till ett problemärende, för överensstämmelse med IT-teamet (${linkedClusters} av ${clusters} kluster hade minst en sådan koppling, och modellen såg aldrig kopplingarna); och en gradient-boostad klassificerare tränad på kopplingarna, som kontroll av att inbäddningarna alls bär signalen. Det gjorde de (ROC-AUC ${dec(FACTS.rocAuc)}), men för svagt per ärende för att användas (F1 ${dec(FACTS.f1)}), och därför fungerar metoden på gruppnivå och inte ärende för ärende.`,
    ),
    l(
      'Low-priority tickets clustered best and high-priority ones worst: routine faults are described in routine words, urgent ones are unique. The method helps most where it performs worst.',
      'Lågprioriterade ärenden klustrade bäst och högprioriterade sämst: rutinfel beskrivs med rutinord, akuta fel är unika. Metoden hjälper mest där den presterar sämst.',
    ),
    // "twelve" / "tolv" is FACTS.anonymiseMinutes, written out as in the approved copy.
    l(
      `Personal data was masked in two layers before any text reached the model: pattern rules for identifiers (personal and organisation numbers, e-mail addresses, phone numbers, IP addresses, customer numbers), then named-entity recognition with Microsoft Presidio and Swedish and English spaCy models, with a fix so the Swedish model's person label was mapped correctly. ${num(FACTS.anonymised)} tickets took twelve minutes. Everything ran inside the company's Databricks environment and no data left it, which GDPR and the company's own policy required.`,
      `Personuppgifter maskerades i två lager innan någon text nådde modellen: mönsterregler för identifierare (person- och organisationsnummer, e-postadresser, telefonnummer, IP-adresser, kundnummer), sedan namnigenkänning med Microsoft Presidio och svenska och engelska spaCy-modeller, med en rättelse så att den svenska modellens personetikett mappades rätt. ${num(FACTS.anonymised)} ärenden tog tolv minuter. Allt kördes i företagets Databricks-miljö och ingen data lämnade den, vilket GDPR och företagets egen policy krävde.`,
    ),
    l(
      'UMAP is not deterministic, so its coordinates were saved to the gold layer after one run; every run logged its parameters, metrics and model in MLflow.',
      'UMAP är inte deterministiskt, så koordinaterna sparades i gold-lagret efter en körning; varje körning loggade sina parametrar, mått och modell i MLflow.',
    ),
    l(
      `Among the ${unlinked} clusters without a problem record: a virtual desktop that reset on every restart, ${examples.desktop} tickets over three years; an admin login that failed, ${examples.adminLogin} tickets; a message queue that stuck, spread over three clusters.`,
      `Bland de ${unlinked} klustren utan problemärende: ett virtuellt skrivbord som nollställdes vid varje omstart, ${examples.desktop} ärenden över tre år; en admin-inloggning som fallerade, ${examples.adminLogin} ärenden; en meddelandekö som fastnade, spridd över tre kluster.`,
    ),
  ]
}
