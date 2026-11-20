/**
 * The degree project's text for #thesis (ThesisCase.tsx), summarised from the thesis itself.
 * Every number comes from FACTS (thesisFacts.ts), which gives the thesis page.
 */
import { l } from '../i18n'
import { dec, FACTS as F, num, pct, pctRange } from './thesisFacts'

export type Lead = { lead: string; text: string }

export const summary = () => [
  l(
    'When something breaks, IT support usually fixes it one ticket at a time so the user can get back to work. A fault that keeps coming back can then be fixed again and again without anyone looking for its cause.',
    'När något går sönder löser IT-supporten oftast felet ett ärende i taget, så att användaren snabbt kan jobba igen. Ett fel som återkommer kan då lösas om och om igen utan att någon letar efter orsaken.',
  ),
  l(
    'In my degree project I tested whether NLP clustering could find such faults in real incident data from a company’s IT support, faults the organisation had not registered as problems. I also measured how the quality of the documentation limits what the method can find.',
    'I mitt examensarbete prövade jag om NLP-baserad klustring kunde hitta sådana fel i riktig incidentdata från ett företags IT-support, fel som organisationen inte hade registrerat som problem. Jag mätte också hur dokumentationens kvalitet begränsar vad metoden kan hitta.',
  ),
  l(
    `The method grouped ${num(F.selectedRun)} tickets into ${F.clusters} clusters. ${F.unlinked} of them, with ${num(F.unlinkedTickets)} tickets, had no link to a registered problem. Two findings stood out. The field for the root-cause analysis was empty in most tickets, but where it was filled in the model understood the fault much better. And removing personal data created false patterns.`,
    `Metoden delade in ${num(F.selectedRun)} ärenden i ${F.clusters} kluster. ${F.unlinked} av dem, med ${num(F.unlinkedTickets)} ärenden, saknade koppling till ett registrerat problem. Två fynd stack ut. Fältet för rotorsaksanalys var tomt i de flesta ärenden, men där det var ifyllt förstod modellen felet mycket bättre. Och när personuppgifterna togs bort uppstod falska mönster.`,
  ),
  l(
    'The method works. Its limits are set by how carefully people document their tickets, not by the algorithm.',
    'Metoden fungerar. Gränserna sätts av hur noggrant människor dokumenterar sina ärenden, inte av algoritmen.',
  ),
]

export const problem = () => [
  l(
    'IT service management (ITSM) separates two kinds of work. Incident management restores normal service as fast as possible. Problem management looks for the cause behind incidents that recur and records it in a problem record.',
    'IT-servicehantering (ITSM) skiljer på två slags arbete. Incidenthantering återställer normal drift så snabbt som möjligt. Problemhantering letar efter orsaken bakom incidenter som återkommer och registrerar den i ett problemärende.',
  ),
  l(
    'In practice, incidents are seldom escalated to problems in a systematic way. Every ticket closed without a link to a known pattern is a missed chance to find the root cause, and with hundreds of tickets a month nobody can see the patterns by hand.',
    'I praktiken eskaleras incidenter sällan till problem på ett systematiskt sätt. Varje ärende som stängs utan koppling till ett känt mönster är en missad chans att hitta rotorsaken, och med hundratals ärenden i månaden kan ingen se mönstren för hand.',
  ),
  l(
    `The company’s IT support handles on average ${F.incidentsPerMonth} incidents a month in Freshservice. I did the study during my internship, on a data pipeline that was already in place.`,
    `Företagets IT-support hanterar i genomsnitt ${F.incidentsPerMonth} incidenter i månaden i Freshservice. Jag gjorde studien under min LIA-praktik, på en datapipeline som redan fanns.`,
  ),
]

export const purpose = () =>
  l(
    'The purpose was to find out how NLP clustering can be used on ITSM data to find recurring incident patterns that have no problem record, and to measure how data quality, assessed with ISO/IEC 25012, limits and explains the results.',
    'Syftet var att undersöka hur NLP-baserad klustring kan användas på ITSM-data för att hitta återkommande incidentmönster som saknar problemärende, och att mäta hur datakvalitet enligt ISO/IEC 25012 begränsar och förklarar resultaten.',
  )

export const questions = () => [
  l(
    'How should ITSM data be structured and assessed to make NLP analysis meaningful, and which data-quality dimensions are critical?',
    'Hur bör ITSM-data struktureras och utvärderas för att NLP-analys ska bli meningsfull, och vilka datakvalitetsdimensioner är kritiska?',
  ),
  l(
    'How well can NLP clustering find patterns in incident tickets and flag clusters with no linked problem record?',
    'Hur effektivt kan NLP-baserad klustring hitta mönster i incidentärenden och flagga kluster som saknar kopplat problemärende?',
  ),
  l(
    'To what extent do the patterns lack a problem record, and how can that gap be explained by process maturity measured with ISO/IEC 25012?',
    'I vilken utsträckning saknar mönstren ett problemärende, och hur kan det gapet förklaras av processmognad mätt med ISO/IEC 25012?',
  ),
]

export const caseData = () => [
  l(
    `Data quality was measured on all ${num(F.records)} incident tickets registered from ${F.period.from} to ${F.period.to}, after system alerts, test tickets and cancelled tickets were removed. Service requests were left out of the clustering: their description was filled in for only ${pct(F.srDescription)}, against ${pct(F.description)} for incidents.`,
    `Datakvaliteten mättes på alla ${num(F.records)} incidentärenden registrerade från ${F.period.from} till ${F.period.to}, efter att systemlarm, testärenden och annullerade ärenden tagits bort. Serviceförfrågningar lämnades utanför klustringen: deras beskrivning var ifylld i bara ${pct(F.srDescription)}, mot ${pct(F.description)} för incidenter.`,
  ),
  l(
    `After filtering, ${num(F.anonymised)} unique incidents remained. Personal data was removed from all of them before any text reached the model, in two steps: fixed patterns for identifiers such as personal identity numbers, e-mail addresses and phone numbers, then a language model that recognises names. The run took ${F.anonymiseMinutes} minutes. The final clustering used ${num(F.selectedRun)} of the tickets.`,
    `Efter filtreringen återstod ${num(F.anonymised)} unika incidenter. Personuppgifter togs bort ur alla innan någon text nådde modellen, i två steg: fasta mönster för identifierare som personnummer, e-postadresser och telefonnummer, sedan en språkmodell som känner igen namn. Körningen tog ${F.anonymiseMinutes} minuter. Den slutliga klustringen använde ${num(F.selectedRun)} av ärendena.`,
  ),
  l(
    'Everything ran in the company’s own Azure Databricks environment. No data was sent to an outside model service, as GDPR and the company’s policy require. Results are reported per cluster, so no single ticket or person is pointed out.',
    'Allt kördes i företagets egen Azure Databricks-miljö. Ingen data skickades till en extern modelltjänst, vilket GDPR och företagets policy kräver. Resultaten redovisas per kluster, så inget enskilt ärende och ingen person pekas ut.',
  ),
]

export const method = (): Lead[] => [
  {
    lead: l('Data quality.', 'Datakvalitet.'),
    text: l(
      'I measured five of the dimensions in ISO/IEC 25012: completeness, accuracy, consistency, uniqueness and traceability. The measurement showed which text fields were good enough to use, and which links between incidents and problems could be used to check the clusters.',
      'Jag mätte fem av dimensionerna i ISO/IEC 25012: fullständighet, exakthet, konsistens, unikhet och spårbarhet. Mätningen visade vilka textfält som höll för att användas, och vilka kopplingar mellan incidenter och problem som kunde användas för att kontrollera klustren.',
    ),
  },
  {
    lead: l('Text to vectors.', 'Text till vektorer.'),
    text: l(
      'A multilingual sentence model, which handles the mix of Swedish and English in the tickets, turned each ticket into a vector. Tickets about the same thing then land close together even when they use different words. The text combined the subject, the description and the root-cause analysis, with the root-cause analysis weighted highest.',
      'En flerspråkig meningsmodell, som klarar blandningen av svenska och engelska i ärendena, gjorde om varje ärende till en vektor. Ärenden om samma sak hamnar då nära varandra även när de använder olika ord. Texten kombinerade ämnesraden, beskrivningen och rotorsaksanalysen, med rotorsaksanalysen viktad högst.',
    ),
  },
  {
    lead: l('Glossary.', 'Ordlista.'),
    text: l(
      `The tickets are full of internal system names the model has never seen. I wrote a glossary of ${F.glossaryTerms} such names, each with a short English description that was added to the text before the model read it.`,
      `Ärendena är fulla av interna systemnamn som modellen aldrig har sett. Jag skrev en ordlista med ${F.glossaryTerms} sådana namn, var och ett med en kort engelsk beskrivning som lades till i texten innan modellen läste den.`,
    ),
  },
  {
    lead: l('Grouping.', 'Gruppering.'),
    text: l(
      `UMAP reduced the vectors from ${F.dims.from} to ${F.dims.to} dimensions. HDBSCAN then grouped tickets that lie densely together and left the rest as noise. K-means, which forces every ticket into a cluster, ran beside it for comparison.`,
      `UMAP minskade vektorerna från ${F.dims.from} till ${F.dims.to} dimensioner. HDBSCAN grupperade sedan ärenden som ligger tätt tillsammans och lämnade resten som brus. K-means, som tvingar in varje ärende i ett kluster, kördes bredvid för jämförelse.`,
    ),
  },
  {
    lead: l('Checking.', 'Kontroll.'),
    text: l(
      'Clustering has no answer key, so three measures were combined: the silhouette score, for how well the clusters are separated; the share of each cluster already linked to a problem record, which shows whether the clusters agree with the IT team’s own judgement; and an XGBoost classifier trained on those links, to check that the vectors carry the signal at all.',
      'Klustring har inget facit, så tre mått kombinerades: silhuettvärdet, för hur väl klustren är separerade; andelen av varje kluster som redan var kopplad till ett problemärende, som visar om klustren stämmer med IT-teamets egna bedömningar; och en XGBoost-klassificerare tränad på de kopplingarna, för att kontrollera att vektorerna alls bär signalen.',
    ),
  },
]

export const years = () =>
  l(
    `Fields the system requires filled up as the company formalised its classification. A structured field for business area went from ${pct(F.businessArea.y2024)} in ${F.years[4]} to ${pct(F.businessArea.y2026)} in ${F.years[6]} after a change in the Freshservice interface. The voluntary root-cause field stayed at ${pct(F.analysisByYear[5])} in ${F.years[5]} and ${pct(F.analysisByYear[6])} in ${F.years[6]}. Among high-priority incidents, the share with a root-cause analysis went from ${pct(F.rcaHighPriority.y2023)} in ${F.years[3]} to ${pct(F.rcaHighPriority.y2026)} in ${F.years[6]}.`,
    `Fält som systemet kräver fylldes i takt med att företaget formaliserade sin klassificering. Ett strukturerat fält för verksamhetsområde gick från ${pct(F.businessArea.y2024)} år ${F.years[4]} till ${pct(F.businessArea.y2026)} år ${F.years[6]} efter en ändring i Freshservices gränssnitt. Det frivilliga rotorsaksfältet låg kvar på ${pct(F.analysisByYear[5])} år ${F.years[5]} och ${pct(F.analysisByYear[6])} år ${F.years[6]}. Bland högprioriterade incidenter gick andelen med rotorsaksanalys från ${pct(F.rcaHighPriority.y2023)} år ${F.years[3]} till ${pct(F.rcaHighPriority.y2026)} år ${F.years[6]}.`,
  )

export const clusterText = () => {
  const { silhouette: s, xgb, examples: e, highlighted: h } = F
  return [
    l(
      `HDBSCAN found ${F.clusters} clusters with a silhouette score of ${dec(s.hdbscan)}, against ${dec(s.kmeans)} for K-means with ${s.kmeansClusters} clusters. Across the three text versions compared, HDBSCAN scored ${pctRange(F.silhouetteGain)} higher.`,
      `HDBSCAN hittade ${F.clusters} kluster med silhuettvärdet ${dec(s.hdbscan)}, mot ${dec(s.kmeans)} för K-means med ${s.kmeansClusters} kluster. Över de tre textversioner som jämfördes låg HDBSCAN ${pctRange(F.silhouetteGain)} högre.`,
    ),
    l(
      `${F.linkedClusters} of the ${F.clusters} clusters (${pct(F.linkedClustersPct)}) held at least one ticket linked to a problem record, although the model never saw the links. Where the IT team had made a judgement, the clusters agree with it.`,
      `${F.linkedClusters} av de ${F.clusters} klustren (${pct(F.linkedClustersPct)}) innehöll minst ett ärende kopplat till ett problemärende, fast modellen aldrig såg kopplingarna. Där IT-teamet hade gjort en bedömning stämmer klustren med den.`,
    ),
    l(
      `${F.unlinked} clusters (${pct(F.unlinkedPct)}), with ${num(F.unlinkedTickets)} tickets, had no link to a problem record. They are candidates for review, not proven root causes. ${h.groups} of them, with ${num(h.tickets)} tickets, were the most useful to act on. Among them: a virtual desktop that reset at every restart, ${e.desktop} tickets from ${F.desktopYears[0]} to ${F.desktopYears[1]}; an admin login that failed, ${e.adminLogin} tickets; and messages stuck in a message queue, in ${e.queueClusters} separate clusters.`,
      `${F.unlinked} kluster (${pct(F.unlinkedPct)}), med ${num(F.unlinkedTickets)} ärenden, saknade koppling till ett problemärende. De är kandidater att granska, inte bevisade rotorsaker. ${h.groups} av dem, med ${num(h.tickets)} ärenden, var mest användbara att agera på. Bland dem: ett virtuellt skrivbord som nollställdes vid varje omstart, ${e.desktop} ärenden från ${F.desktopYears[0]} till ${F.desktopYears[1]}; en admininloggning som inte fungerade, ${e.adminLogin} ärenden; och meddelanden som fastnade i en meddelandekö, i ${e.queueClusters} separata kluster.`,
    ),
    l(
      `The XGBoost check confirmed that the signal is there: ROC-AUC ${dec(xgb.rocAuc)} and PR-AUC ${dec(xgb.prAuc)}, almost nine times the ${dec(xgb.random)} of a random guess. Per ticket it was too weak to use, with precision ${dec(xgb.precision)}, recall ${dec(xgb.recall)} and F1 ${dec(xgb.f1)}. That is why the method works on groups of tickets, not on single tickets.`,
      `XGBoost-kontrollen bekräftade att signalen finns: ROC-AUC ${dec(xgb.rocAuc)} och PR-AUC ${dec(xgb.prAuc)}, nästan nio gånger de ${dec(xgb.random)} som en slumpmässig gissning ger. Per ärende var den för svag för att användas, med precision ${dec(xgb.precision)}, recall ${dec(xgb.recall)} och F1 ${dec(xgb.f1)}. Därför arbetar metoden med grupper av ärenden, inte med enskilda ärenden.`,
    ),
  ]
}
