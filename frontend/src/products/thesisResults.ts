/**
 * The degree project's findings, conclusions, limitations, future work and technical notes for
 * #thesis (ThesisCase.tsx), from chapters 4–5 of the thesis. Numbers come from FACTS.
 */
import { l } from '../i18n'
import type { Lead } from './thesisContent'
import { dec, FACTS as F, num, pct } from './thesisFacts'

export const findings = (): Lead[] => [
  {
    lead: l(
      'The root-cause field was nearly always empty.',
      'Rotorsaksfältet var nästan alltid tomt.',
    ),
    text: l(
      `Support staff filled in the field for their root-cause analysis in only ${pct(F.iso.analysis)} of the tickets. Where it was filled in, the model understood the fault much better, so the final text weights it ${F.weights.analysis} times. That version had ${pct(F.bestClusterLinked)} of the tickets in its best cluster linked to a problem record, the highest of the five text versions tested.`,
      `Supportpersonalen fyllde i fältet för rotorsaksanalys i bara ${pct(F.iso.analysis)} av ärendena. Där det var ifyllt förstod modellen felet mycket bättre, så den slutliga texten viktar det ${F.weights.analysis} gånger. Den versionen hade ${pct(F.bestClusterLinked)} av ärendena i sitt bästa kluster kopplade till ett problemärende, högst av de fem textversioner som prövades.`,
    ),
  },
  {
    lead: l(
      'Anonymisation created false patterns.',
      'Anonymiseringen skapade falska mönster.',
    ),
    text: l(
      `Names were replaced with a placeholder before the text reached the model. Tickets that shared a subject template with a name in it then looked the same to the model, and ${F.ghostClusters} tight clusters formed around the placeholder instead of around a shared fault. None of their tickets was linked to a problem record. The NLP literature reviewed in the thesis does not describe this effect. The fix is a one-line change: remove the placeholder after anonymising and before the model reads the text. The ${F.ghostClusters} clusters were left out of the candidate list.`,
      `Namn ersattes med en platshållare innan texten nådde modellen. Ärenden som delade en ämnesmall med ett namn i blev då likadana för modellen, och ${F.ghostClusters} täta kluster bildades kring platshållaren i stället för kring ett gemensamt fel. Inget av deras ärenden var kopplat till ett problemärende. Den NLP-litteratur som arbetet granskade beskriver inte effekten. Lösningen är en ändring på en rad: ta bort platshållaren efter anonymiseringen och innan modellen läser texten. De ${F.ghostClusters} klustren togs bort ur kandidatlistan.`,
    ),
  },
  {
    lead: l(
      'A glossary of system names raised the agreement.',
      'En ordlista över systemnamn höjde överensstämmelsen.',
    ),
    text: l(
      `I compared two runs on the same description text, one with the ${F.glossaryTerms}-term glossary and one without. In the best cluster, the share of tickets linked to a problem record rose from ${pct(F.glossary.without)} to ${pct(F.glossary.with)}, ${F.glossary.gainPts} percentage points, without any change to the embedding model.`,
      `Jag jämförde två körningar på samma beskrivningstext, en med ordlistan på ${F.glossaryTerms} termer och en utan. I det bästa klustret steg andelen ärenden kopplade till ett problemärende från ${pct(F.glossary.without)} till ${pct(F.glossary.with)}, ${F.glossary.gainPts} procentenheter, utan att embeddingmodellen ändrades.`,
    ),
  },
]

export const patterns = () => [
  l(
    `Low-priority tickets clustered best (silhouette ${dec(F.priority.low)}) and high-priority tickets worst (${dec(F.priority.high)}). Routine faults are described in routine words; urgent incidents are unique and described in varied ways. The value of finding patterns would be greatest in exactly the category where the method performs worst.`,
    `Lågprioriterade ärenden klustrade bäst (silhuett ${dec(F.priority.low)}) och högprioriterade sämst (${dec(F.priority.high)}). Rutinfel beskrivs med rutinord; akuta incidenter är unika och beskrivs på varierande sätt. Värdet av att hitta mönster vore störst i just den kategori där metoden presterar sämst.`,
  ),
  l(
    `Some faults were split over several clusters. One generic error message about failed processing appeared in ${F.fragments.clusters} clusters with ${num(F.fragments.tickets)} tickets: the clusters were finer than the way the IT team groups its problems. Staff can merge such clusters by hand, or a larger minimum cluster size (${F.coarserMcs[0]}–${F.coarserMcs[1]}) gives coarser groups.`,
    `Vissa fel delades upp på flera kluster. Ett allmänt felmeddelande om misslyckad bearbetning fanns i ${F.fragments.clusters} kluster med ${num(F.fragments.tickets)} ärenden: klustren var finare än det sätt IT-teamet grupperar sina problem på. Personalen kan slå ihop sådana kluster för hand, eller så ger en större minsta klusterstorlek (${F.coarserMcs[0]}–${F.coarserMcs[1]}) grövre grupper.`,
  ),
]

export const conclusions = () => [
  l(
    'NLP clustering can find candidates for problem records in ITSM data, but how far it reaches depends on how mature the processes behind the data are. The limits that mattered were organisational, not algorithmic.',
    'NLP-baserad klustring kan hitta kandidater till problemärenden i ITSM-data, men hur långt den når beror på hur mogna processerna bakom datan är. De begränsningar som spelade roll var organisatoriska, inte algoritmiska.',
  ),
  l(
    'Fields the system controls improved quickly once the organisation changed the interface. Fields that depend on a person’s own initiative, like the root-cause analysis, stayed low. Problems of the first kind can be solved in the system, without more work for support staff.',
    'Fält som systemet styr blev snabbt bättre när organisationen ändrade gränssnittet. Fält som beror på en persons eget initiativ, som rotorsaksanalysen, låg kvar på en låg nivå. Problem av det första slaget kan lösas i systemet, utan mer arbete för supportpersonalen.',
  ),
  l(
    `For the company the study delivered a validated pipeline and a list of ${F.unlinked} candidate clusters for its problem management. Beyond the case it made two contributions: a measured link between ISO/IEC 25012 dimensions and how well NLP performs afterwards, and an interaction between anonymisation and sentence embeddings not described before, which matters for any NLP project that replaces personal data with placeholders.`,
    `För företaget gav studien ett validerat analysflöde och en lista med ${F.unlinked} kandidatkluster för problemhanteringen. Utöver fallet gav den två bidrag: en uppmätt koppling mellan dimensionerna i ISO/IEC 25012 och hur väl NLP presterar efteråt, och en tidigare obeskriven interaktion mellan anonymisering och meningsinbäddningar, som berör alla NLP-projekt som ersätter personuppgifter med platshållare.`,
  ),
]

export const limitations = () => [
  l(
    'It is one case. The glossary, the filters and the parameters are tuned to this company’s data and would need tuning again elsewhere. What carries over is the method and the link between data quality and NLP results.',
    'Det är ett enda fall. Ordlistan, filtren och parametrarna är anpassade till företagets data och skulle behöva anpassas igen på andra ställen. Det som går att föra vidare är metoden och kopplingen mellan datakvalitet och NLP-resultat.',
  ),
  l(
    `The silhouette comparison is uneven: HDBSCAN is scored only on the ${pct(F.clusteredPct)} of tickets it puts in a cluster, K-means on all of them. The links to problem records are sparse and recent, near zero in ${F.linkLowYears[0]}–${F.linkLowYears[1]}, so the validation mostly reflects newer tickets.`,
    `Jämförelsen av silhuettvärden är ojämn: HDBSCAN mäts bara på de ${pct(F.clusteredPct)} av ärendena som hamnar i ett kluster, K-means på alla. Kopplingarna till problemärenden är glesa och nya, nära noll ${F.linkLowYears[0]}–${F.linkLowYears[1]}, så valideringen speglar mest nyare ärenden.`,
  ),
  l(
    'The glossary covers only what the documentation and the time allowed, so the results are a lower bound. Fainter false clusters may remain below the detection thresholds. The planned interviews were replaced by quantitative analysis, and the effect on workload, costs and resolution times would have to be measured in real use.',
    'Ordlistan täcker bara det som dokumentationen och tiden räckte till, så resultaten är en undre gräns. Svagare falska kluster kan finnas kvar under detektionsgränserna. De planerade intervjuerna ersattes med kvantitativ analys, och effekten på arbetsbörda, kostnader och lösningstider skulle behöva mätas i verklig drift.',
  ),
]

export const future = () => [
  l(
    'Remove the placeholders after anonymisation, before the text reaches the model. It is a one-line change and takes away the cause of the false clusters.',
    'Ta bort platshållarna efter anonymiseringen, innan texten når modellen. Det är en ändring på en rad och tar bort orsaken till de falska klustren.',
  ),
  l(
    'Let a language model running inside Databricks write the glossary entries for unknown system names, and index internal documentation in a vector database so that new names are picked up without editing the glossary by hand.',
    'Låt en språkmodell som körs i Databricks skriva ordlistans beskrivningar för okända systemnamn, och indexera intern dokumentation i en vektordatabas så att nya namn fångas upp utan att ordlistan ändras för hand.',
  ),
  l(
    'Interview the service desk and IT management to check the candidate list, and study when clustering results are actually used in problem management.',
    'Intervjua servicedesken och IT-ledningen för att pröva kandidatlistan, och undersöka när klustringsresultat faktiskt används i problemhanteringen.',
  ),
]

/** The folded technical notes. */
export const technical = () => {
  const { pii, weights: w, hdbscan: h } = F
  return [
    l(
      `Data came from the Freshservice REST API into a bronze, silver and gold layer in Azure Databricks, loaded incrementally. The embedding model was paraphrase-multilingual-mpnet-base-v2. The final text version, text_weighted, joins the subject ×${w.subject}, the root-cause analysis ×${w.analysis} and the description ×${w.description}.`,
      `Datan hämtades från Freshservice REST API till ett brons-, silver- och guldlager i Azure Databricks, inkrementellt. Embeddingmodellen var paraphrase-multilingual-mpnet-base-v2. Den slutliga textversionen, text_weighted, sätter ihop ämnesraden ×${w.subject}, rotorsaksanalysen ×${w.analysis} och beskrivningen ×${w.description}.`,
    ),
    l(
      `UMAP used ${F.umapNeighbours} neighbours and cosine distance; its coordinates were saved to the gold layer because UMAP is not deterministic. HDBSCAN was tried with minimum cluster sizes ${h.sweep.join(', ')}; the final run used ${h.mcs}, with min_samples ${h.minSamples}. Every run logged its parameters, metrics and model in MLflow.`,
      `UMAP använde ${F.umapNeighbours} grannar och cosinusavstånd; koordinaterna sparades i guldlagret eftersom UMAP inte är deterministiskt. HDBSCAN prövades med minsta klusterstorlek ${h.sweep.join(', ')}; den slutliga körningen använde ${h.mcs}, med min_samples ${h.minSamples}. Varje körning loggade parametrar, mått och modell i MLflow.`,
    ),
    l(
      `Anonymisation used pattern rules for identifiers, then Microsoft Presidio with Swedish and English spaCy models, with a fix so the Swedish model’s person label was mapped correctly. It found ${num(pii.person)} names, ${num(pii.email)} e-mail addresses, ${num(pii.phone)} phone numbers and ${num(pii.idNumber)} personal identity numbers.`,
      `Anonymiseringen använde mönsterregler för identifierare, sedan Microsoft Presidio med svenska och engelska spaCy-modeller, med en rättelse så att den svenska modellens personetikett mappades rätt. Den hittade ${num(pii.person)} namn, ${num(pii.email)} e-postadresser, ${num(pii.phone)} telefonnummer och ${num(pii.idNumber)} personnummer.`,
    ),
    l(
      'Source: Anton Ernstsson, “NLP-baserad klustring av ITSM-data. En fallstudie om identifiering av oregistrerade problemärenden i incidentdata”, degree project, AIDEV24s, spring 2026. Where the thesis text and its tables give different values, this page uses the tables.',
      'Källa: Anton Ernstsson, ”NLP-baserad klustring av ITSM-data. En fallstudie om identifiering av oregistrerade problemärenden i incidentdata”, examensarbete, AIDEV24s, vår 2026. Där arbetets text och tabeller anger olika värden använder sidan tabellerna.',
    ),
  ]
}
