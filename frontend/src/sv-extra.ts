// Additional Swedish report copy. Keys are whitespace-normalised English source text.
export const swedishReports: Record<string, string> = {
  Close: 'Stäng',
  Menu: 'Meny',
  'Profile overview': 'Profilöversikt',
  'Politics report views': 'Vyer i politikrapporten',
  'Topic colour legend': 'Färgförklaring för ämnen',
  'Largest topic clusters by word share':
    'Största ämnesklustren efter andel ord',
  'Segments are embedded with': 'Segmenten kodas som vektorer med',
  ', reduced with UMAP and clustered with HDBSCAN. The map shows a deterministic sample of up to 400 segments per session.':
    ', reduceras med UMAP och klustras med HDBSCAN. Kartan visar ett deterministiskt urval om högst 400 segment per riksmöte.',
  'Two-dimensional distance is approximate. Labels are machine-generated keywords, not manual coding. Clusters describe language patterns, not political positions. Labels have not been manually validated, and the model will be retrained before making stronger comparisons.':
    'Avstånd i två dimensioner är ungefärliga. Etiketterna är maskingenererade nyckelord, inte manuell kodning. Klustren beskriver språkmönster, inte politiska ståndpunkter. Etiketterna har inte validerats manuellt och modellen ska tränas om innan starkare jämförelser görs.',
  'Code and documentation on GitHub ↗': 'Kod och dokumentation på GitHub ↗',
  'Job ad tables and definitions': 'Annonstabeller och definitioner',
  'Result tables and downloads': 'Resultattabeller och nedladdningar',
  'Chart scrolls horizontally on small screens':
    'Diagrammet kan skrollas i sidled på små skärmar',
  'Share of party budget': 'Andel av partiets budget',
  'Share of matched debate keywords': 'Andel matchade debattord',
  '· all eight parties': '· samtliga åtta partier',
  'Budget share': 'Budgetandel',
  'Keyword share': 'Nyckelordsandel',
  'Budget share / keyword share. A dash means no separate party budget frame. Keyword shares use the selected method and archive, calculated separately within each party. 0.0% means zero detected matches; — means unavailable. They do not measure policy support.':
    'Budgetandel / nyckelordsandel. Ett streck betyder att separat partibudget saknas. Nyckelordsandelen använder vald metod och valt arkiv och beräknas inom varje parti. 0,0 % betyder inga upptäckta träffar; — betyder att data saknas. Andelarna mäter inte politiskt stöd.',
  'Coverage: all eight parties and missing budget data':
    'Täckning: alla åtta partier och saknade budgetdata',
  'Debate speeches are present for all eight parties in these sessions. The cells below count expenditure areas in the imported FiU1 budget table; 27/27 is complete. A dash means there is no separate party budget frame in this export, not zero spending. GOV is the collective government proposal and cannot be assigned to individual parties.':
    'Debatttal finns för alla åtta partier under dessa riksmöten. Cellerna nedan räknar utgiftsområden i den importerade FiU1-tabellen; 27/27 är fullständigt. Ett streck betyder att exporten saknar en separat partibudget, inte noll utgifter. GOV är regeringens gemensamma förslag och kan inte fördelas på enskilda partier.',
  'Budget coverage table scrolls horizontally on small screens':
    'Tabellen över budgettäckning kan skrollas i sidled på små skärmar',
  'Imported budget areas by session and actor':
    'Importerade utgiftsområden per riksmöte och aktör',
  Session: 'Riksmöte',
  '2017/18 and 2018/19 are incomplete imports and are excluded from share-based charts until repaired. In 2014/15, 2015/16, 2020/21 and 2021/22 the importer did not find a machine-readable FiU1 comparison table.':
    'Importerna för 2017/18 och 2018/19 är ofullständiga och ingår inte i andelsdiagrammen innan de rättats. För 2014/15, 2015/16, 2020/21 och 2021/22 hittade importören ingen maskinläsbar FiU1-jämförelsetabell.',
  'Budget deviation heatmap can scroll horizontally on small screens':
    'Värmekartan över budgetavvikelser kan skrollas i sidled på små skärmar',
  'Expenditure area': 'Utgiftsområde',
  'Fewer than two comparable years for this choice.':
    'Färre än två jämförbara år för detta val.',
  'The budget exports could not be loaded.':
    'Budgetexporterna kunde inte läsas in.',
  'Loading the budget comparison…': 'Läser in budgetjämförelsen…',
  'Budgets / proposals and annual accounts': 'Budgetar / förslag och årsutfall',
  'What do the budget proposals contain?': 'Vad innehåller budgetförslagen?',
  'Start with the proposed amounts for any imported year. The optional language comparison uses only sessions with complete budget frames and detectable speech keywords.':
    'Börja med föreslagna belopp för ett importerat år. Den valfria språkjämförelsen använder bara riksmöten med fullständiga budgetramar och upptäckbara nyckelord i talen.',
  'See approved budget versus actual spending ↓':
    'Se beslutad budget mot faktiska utgifter ↓',
  'Compare the separate party proposals at a glance':
    'Jämför partiernas egna förslag i en överblick',
  'Explore speech keywords beside budget shares':
    'Utforska nyckelord i tal bredvid budgetandelar',
  'Select a session and party to compare complete proposals with detected topic words. These controls apply only to the language charts below.':
    'Välj riksmöte och parti för att jämföra fullständiga förslag med upptäckta ämnesord. Dessa val påverkar bara språkdiagrammen nedan.',
  'All available parties': 'Alla tillgängliga partier',
  'budget rows in session': 'budgetrader under riksmötet',
  'All eight parties ·': 'Alla åtta partier ·',
  'The FiU1 source reports one collective government proposal and separate budget motions for some parties. Debate data exists for all eight; a missing party frame cannot be inferred from GOV.':
    'FiU1-källan redovisar ett gemensamt regeringsförslag och separata budgetmotioner för vissa partier. Debattdata finns för alla åtta; en saknad partibudget kan inte härledas från GOV.',
  "These two percentages have different denominators. Budget share is a fraction of a party's proposed expenditure; keyword share is a fraction of matched words across 27 topic dictionaries. A difference between them is a descriptive comparison, not an amount of money, a position on an issue, or a measure of honesty. The debates span the whole session, including speeches after the budget proposal.":
    'De två procenttalen har olika nämnare. Budgetandelen är en del av partiets föreslagna utgifter; nyckelordsandelen är en del av matchade ord i 27 ämnesordlistor. Skillnaden är en beskrivande jämförelse, inte ett belopp, en ståndpunkt eller ett mått på ärlighet. Debatterna täcker hela riksmötet, även tal efter budgetförslaget.',
  'A concrete example:': 'Ett konkret exempel:',
  'The proposal assigns': 'Förslaget avsätter',
  of: 'av',
  "'s total proposed expenditure to this area (":
    's totala föreslagna utgifter till området (',
  'million SEK). In the selected': 'miljoner kronor). I de valda',
  'debates,': 'debatterna',
  'detected area-word matches fall into this dictionary (':
    'av upptäckta träffar på områdesord i denna ordlista (',
  '). Those percentages use different totals. A match does not tell us whether the speaker supported, criticised or merely mentioned the issue.':
    '). Procenttalen bygger på olika totaler. En träff säger inte om talaren stödde, kritiserade eller bara nämnde frågan.',
  'Read the budget source ↗': 'Läs budgetkällan ↗',
  '01 / Budget versus debate': '01 / Budget mot debatt',
  'Where do money and words meet?': 'Var möts pengar och ord?',
  'Each dot is one': 'Varje punkt är ett',
  'expenditure area. Above the diagonal: more keyword attention than budget share.':
    'utgiftsområde. Ovanför diagonalen: större uppmärksamhet i nyckelord än budgetandel.',
  Budget: 'Budget',
  Keywords: 'Nyckelord',
  matches: 'träffar',
  '02 / Difference in shares': '02 / Skillnad i andelar',
  'Most above and below budget share': 'Störst över och under budgetandelen',
  'Keyword share minus budget share, in percentage points. Select a row to inspect that party and area.':
    'Nyckelordsandel minus budgetandel i procentenheter. Välj en rad för att granska parti och område.',
  '03 / Money versus government': '03 / Belopp mot regeringen',
  'Where do party proposals differ?': 'Var skiljer sig partiernas förslag?',
  "Largest 12 deviations among the 27 expenditure areas. Figures are million SEK above or below the government's proposal.":
    'De tolv största avvikelserna bland 27 utgiftsområden. Beloppen är miljoner kronor över eller under regeringens förslag.',
  '− less': '− mindre',
  '+ more': '+ mer',
  'GOV denotes the collective government proposal. Only parties with a machine-readable budget motion in this session appear.':
    'GOV betecknar regeringens gemensamma förslag. Bara partier med en maskinläsbar budgetmotion under detta riksmöte visas.',
  '04 / Available years': '04 / Tillgängliga år',
  'Does the gap move over time?': 'Ändras skillnaden över tid?',
  'Follow budget share and matched debate keyword share for':
    'Följ budgetandel och andel matchade debattord för',
  'and area. Missing years are not estimated.':
    'och område. Saknade år uppskattas inte.',
  'Current proposal': 'Aktuellt förslag',
  'Versus government': 'Jämfört med regeringen',
  '05 / All available sessions': '05 / Alla tillgängliga riksmöten',
  'How does the overall relationship change?':
    'Hur förändras det övergripande sambandet?',
  'Correlation across expenditure areas': 'Korrelation mellan utgiftsområden',
  '. Values near zero indicate a weak linear relationship; this is a compact indicator, not a score of policy consistency.':
    '. Värden nära noll visar ett svagt linjärt samband; detta är en sammanfattande indikator, inte ett mått på politisk konsekvens.',
  'Sources, definitions & important limits':
    'Källor, definitioner och viktiga begränsningar',
  "Budget frames come from the Swedish Parliament's FiU1 comparisons. Each party amount is the government proposal plus that party's reported deviation, in million SEK. Tables are selected for the exact budget year, excluding later forecast years. Budget share divides an area by the party's total proposal for that session.":
    'Budgetramarna kommer från riksdagens FiU1-jämförelser. Varje partibelopp är regeringens förslag plus partiets redovisade avvikelse, i miljoner kronor. Tabellerna väljs för det exakta budgetåret; senare prognosår utesluts. Budgetandelen delar ett områdes belopp med partiets totala förslag under riksmötet.',
  "Debate attention is the area's share of occurrences of the selected exact-word or Swedish-stem lexicon across the 27 mapped areas for that party and session in the selected archive. Only speeches of at least 20 words are included; reply speeches are included and duplicates removed within each archive. It is not a semantic reading of all speech, a measure of policy support, or evidence of budget intent. Correlation summarises the two shares across areas, but is not a score of consistency.":
    'Debattuppmärksamhet är områdets andel träffar i vald ordlista med exakta ord eller svenska ordstammar över 27 områden, för valt parti, riksmöte och arkiv. Endast tal med minst 20 ord ingår; repliker ingår och dubbletter tas bort inom varje arkiv. Det är inte en semantisk tolkning av allt tal, ett mått på stöd eller belägg för budgetavsikt. Korrelationen sammanfattar andelarna mellan områden men mäter inte konsekvens.',
  'Six imported sessions have complete 27-area budget frames for every actor listed in their FiU1 table. The incomplete 2017/18 and 2018/19 imports are excluded from share-based charts. The heatmap shows the largest 12 deviations for readability. A combined semantic map of speeches and budget text, or a separate budget UMAP, would require new embeddings and modelling; no points are invented here.':
    'Sex importerade riksmöten har kompletta ramar för 27 områden för varje aktör i FiU1-tabellen. De ofullständiga importerna 2017/18 och 2018/19 ingår inte i andelsdiagrammen. Värmekartan visar de tolv största avvikelserna för läsbarhetens skull. En gemensam semantisk karta över tal och budgettext, eller en separat budget-UMAP, kräver nya embeddings och modellering; inga punkter har hittats på.',
  'Explore methods and source code ↗': 'Utforska metod och källkod ↗',
  'Open the selected budget source ↗': 'Öppna den valda budgetkällan ↗',
  'Loading recorded votes…': 'Läser in registrerade röster…',
  Committee: 'Utskott',
  'All committees': 'Alla utskott',
  'Party for decision detail': 'Parti för beslutsdetaljer',
  'roll calls in this view · all eight parties':
    'voteringar i denna vy · alla åtta partier',
  'Political observatory · Swedish Parliament':
    'Politiköversikt · Sveriges riksdag',
  'From political words to recorded decisions.':
    'Från politiska ord till registrerade beslut.',
  'Speeches, budget proposals and formal decisions are spread across different documents. This observatory brings the imported records together so you can follow the evidence and make your own comparisons.':
    'Tal, budgetförslag och formella beslut finns i olika dokument. Här samlas de importerade uppgifterna så att du kan följa underlaget och göra egna jämförelser.',
  'Why I built this': 'Varför jag byggde detta',
  'I find it difficult to connect political language with budget priorities and what is actually decided. This is my attempt to make that formal record easier to navigate: start with a question, inspect the data, then open the original source.':
    'Jag tycker att det är svårt att koppla politiskt språk till budgetprioriteringar och faktiska beslut. Här försöker jag göra de formella uppgifterna lättare att utforska: börja med en fråga, granska data och öppna sedan originalkällan.',
  'Explore political records': 'Utforska politiska handlingar',
  '01 · What was said': '01 · Vad som sades',
  'Full speeches, replies and searchable transcripts':
    'Hela tal, repliker och sökbara protokoll',
  '02 · What was proposed': '02 · Vad som föreslogs',
  'Budget frames and language comparisons': 'Budgetramar och språkjämförelser',
  '03 · How they voted': '03 · Hur de röstade',
  'Party votes, exact proposals and cited documents':
    'Partiernas röster, exakta förslag och citerade dokument',
  '04 · Explore the people and speeches': '04 · Utforska personerna och talen',
  'Find a politician, read their words and follow the discussion':
    'Hitta en politiker, läs vad personen sa och följ diskussionen',
  'Political analysis views': 'Vyer för politisk analys',
  'Loading political observatory…': 'Läser in politiköversikten…',
  'party-leader debate speeches': 'tal i partiledardebatter',
  'separately indexed issue speeches': 'separat indexerade tal i sakdebatter',
  'imported roll calls · 2024/25–2025/26':
    'importerade voteringar · 2024/25–2025/26',
  'v2 statute provisions · snapshot corpus':
    'lagbestämmelser i v2 · källögonblicksbilder',
  'Voting session': 'Riksmöte för votering',
  'Roll calls cover two imported sessions. Decisions without a roll call and unimported years are not counted as abstentions. Votes refer to committee points, not automatically to each law or motion cited in them.':
    'Voteringarna täcker två importerade riksmöten. Beslut utan votering och år som inte importerats räknas inte som nedlagda röster. Rösterna gäller utskottsförslag och kan inte automatiskt kopplas till varje lag eller motion som nämns.',
  'One source trail, explicit evidence levels.':
    'En källkedja med tydliga evidensnivåer.',
  'The charts read a versioned gold model with keyed facts, dimensions and documented measures. Original parliamentary exports remain available for audit; decision details and law provisions load separately when selected. The source catalog records file sizes and SHA-256 checksums.':
    'Diagrammen använder en versionerad gold-modell med nycklade fakta, dimensioner och dokumenterade mått. Riksdagens originalexporter finns kvar för granskning; beslutsdetaljer och lagbestämmelser läses in separat vid val. Källkatalogen innehåller filstorlekar och SHA-256-kontrollsummor.',
  'Download gold semantic model': 'Ladda ned den semantiska gold-modellen',
  'Download complete data catalog': 'Ladda ned hela datakatalogen',
  'Parliament export manifest': 'Manifest för riksdagsexporter',
  'Law snapshot index': 'Index över lagögonblicksbilder',
  'Measures that are useful now': 'Mått som kan användas nu',
  'Party agreement with paired denominators and exact vote distributions.':
    'Enighet mellan partier med parvisa nämnare och exakta röstfördelningar.',
  'Exact vote distributions, proposal citations and reservations by committee and session.':
    'Exakta röstfördelningar, hänvisningar till förslag och reservationer per utskott och riksmöte.',
  'Debate volume and topic shares; semantic links as discovery candidates.':
    'Debattvolym och ämnesandelar; semantiska länkar som utforskningskandidater.',
  'Source coverage, snapshot versions and readiness of reviewed legal comparisons.':
    'Källtäckning, versionsögonblicksbilder och beredskap för granskade lagjämförelser.',
  'Measures that need more evidence': 'Mått som kräver mer underlag',
  "A party's tightening/loosening profile needs a reviewed link to an exact before/after legal provision, the governed actor, version dates and annotated slots. Vote-to-direction joins and independent annotation agreement remain missing. We do not convert semantic similarity or lexical counts into a political honesty score.":
    'En profil över om ett parti skärper eller luckrar upp regler kräver en granskad koppling till en exakt lagbestämmelse före och efter ändringen, den reglerade aktören, versionsdatum och annoterade delar. Kopplingen mellan röst och ändringsriktning samt oberoende annoteringssamstämmighet saknas fortfarande. Vi omvandlar inte semantisk likhet eller ordantal till ett mått på politisk ärlighet.',
  'Snapshot pool v1:': 'Källurval v1:',
  'provisions in': 'bestämmelser i',
  'parsed documents. v2:': 'tolkade dokument. v2:',
  provisions: 'bestämmelser',
  in: 'i',
  'parsed documents. The broader v2 source pool contains unparsed documents; these counts describe parsed provision snapshots.':
    'tolkade dokument. Det bredare källurvalet i v2 innehåller otolkade dokument; dessa antal gäller tolkade ögonblicksbilder av bestämmelser.',
  'Independent project using Swedish Parliament public data. Not affiliated with Parliament. Original source text is retained in Swedish.':
    'Ett oberoende projekt med offentliga data från riksdagen. Ingen anknytning till riksdagen. Ursprunglig källtext behålls på svenska.',
  'Debate project ↗': 'Debattprojektet ↗',
  'Allegoria & meaningquality ↗': 'Allegoria och meaningquality ↗',
  'Selected speech': 'Valt tal',
  'Read in context ·': 'Läs i sammanhang ·',
  'Loading the full debate…': 'Läser in hela debatten…',
  Speech: 'Tal',
  'in this discussion. Neighbouring speeches follow the parliamentary order; this does not establish who replied to whom.':
    'i denna diskussion. Närliggande tal följer riksdagens ordning; det visar inte vem som svarade vem.',
  'Previous speech': 'Föregående tal',
  'Next speech': 'Nästa tal',
  'Read this speech at the Swedish Parliament ↗': 'Läs talet hos riksdagen ↗',
  'Other speakers in this discussion (': 'Andra talare i diskussionen (',
  'Explore Swedish politics': 'Utforska svensk politik',
  'What did they actually say?': 'Vad sa de egentligen?',
  'Pick a politician, party or debate. Read their own words, then move through the surrounding discussion. You do not need to know how the underlying data is organised.':
    'Välj en politiker, ett parti eller en debatt. Läs personens egna ord och följ sedan diskussionen. Du behöver inte känna till hur underliggande data är organiserade.',
  'Read the speeches': 'Läs talen',
  'People, parties and debates': 'Personer, partier och debatter',
  'Compare budget priorities': 'Jämför budgetprioriteringar',
  'Proposals and spending areas': 'Förslag och utgiftsområden',
  'See how they voted': 'Se hur de röstade',
  'Proposals, party votes and reservations':
    'Förslag, partiröster och reservationer',
  'Read the legal sources': 'Läs lagkällorna',
  'Imported law snapshots': 'Importerade lagögonblicksbilder',
  'These are imported parliamentary records, not complete political coverage. Original quotations remain in Swedish. Some source exports contain damaged characters; open the parliamentary source to verify the wording. Browsing speeches and budgets side by side does not establish a formal link between them.':
    'Det här är importerade riksdagshandlingar, inte fullständig täckning av politiken. Originalcitat är kvar på svenska. Vissa källexporter innehåller skadade tecken; öppna riksdagens källa för att kontrollera ordalydelsen. Att visa tal och budgetar bredvid varandra innebär inte en formell koppling.',
  'Find a politician or debate': 'Hitta en politiker eller debatt',
  'Name, debate title or opening words': 'Namn, debattitel eller inledande ord',
  'Parliamentary year': 'Riksmöte',
  'Discussion type': 'Debattyp',
  'All discussions': 'Alla debatter',
  'Party-leader debates': 'Partiledardebatter',
  'Issue debates': 'Sakdebatter',
  'Search covers names, debate titles and opening excerpts within the selected parliamentary year. Open a speech to read the full text.':
    'Sökningen omfattar namn, debattitlar och inledande utdrag inom valt riksmöte. Öppna ett tal för att läsa hela texten.',
  'Loading speeches…': 'Läser in tal…',
  'speeches found · newest first': 'tal hittade · nyast först',
  'Read full speech →': 'Läs hela talet →',
  'No speeches match. Try another year, party or search term.':
    'Inga tal matchar. Prova ett annat år, parti eller sökord.',
  'Show more speeches': 'Visa fler tal',
  'Start with a person or a question.': 'Börja med en person eller en fråga.',
  'Select a speech to read it here. You can then follow the next speaker and explore the debate in order.':
    'Välj ett tal för att läsa det här. Sedan kan du följa nästa talare och gå igenom debatten i ordning.',
  'Loading source evidence…': 'Läser in källunderlag…',
  '· point': '· punkt',
  'Read the exact committee proposal ↗': 'Läs det exakta utskottsförslaget ↗',
  'Exact proposal text is missing in this export. Read the source before interpreting the vote.':
    'Den exakta förslagstexten saknas i exporten. Läs källan innan du tolkar voteringen.',
  'yes /': 'ja /',
  'no /': 'nej /',
  'abstain /': 'avstod /',
  absent: 'frånvarande',
  'Named member votes (': 'Namngivna ledamöters röster (',
  'Explicit document citations (': 'Direkta dokumenthänvisningar (',
  'A citation means the proposal is considered here; it does not establish support.':
    'En hänvisning betyder att förslaget behandlas här; den visar inte stöd.',
  'Reservations (': 'Reservationer (',
  'Related earlier debate passages (': 'Relaterade tidigare debattavsnitt (',
  'Semantic search candidates, not evidence of consistency or contradiction. Similarity ≥ 0.60; selected earlier speeches from the same party.':
    'Kandidater från semantisk sökning, inte bevis för samstämmighet eller motsägelse. Likhet ≥ 0,60; utvalda tidigare tal från samma parti.',
  '· similarity': '· likhet',
  'Read the speech ↗': 'Läs talet ↗',
  'Vote → enacted law → versioned provision → reviewed slot change is not yet established. No tightening/loosening party score is assigned.':
    'Kedjan röst → antagen lag → versionerad bestämmelse → granskad ändring är ännu inte fastställd. Inget partimått för skärpning eller uppluckring beräknas.',
  '03 / Follow the evidence': '03 / Följ underlaget',
  'What did they actually vote on?': 'Vad röstade de faktiskt om?',
  'Search decisions': 'Sök beslut',
  "'s position": 's position',
  'All positions': 'Alla positioner',
  'Yes to committee proposal': 'Ja till utskottets förslag',
  'No to committee proposal': 'Nej till utskottets förslag',
  Abstain: 'Avstod',
  'matching roll calls. Original source text stays in Swedish.':
    'matchande voteringar. Ursprunglig källtext är kvar på svenska.',
  'Show 20 more': 'Visa 20 till',
  'Select a decision': 'Välj ett beslut',
  'Inspect the exact proposal, all eight parties, named votes, reservations, cited documents and related speeches.':
    'Granska det exakta förslaget, alla åtta partier, namngivna röster, reservationer, citerade dokument och relaterade tal.',
  '01 / Recorded positions': '01 / Registrerade positioner',
  'How do parties vote?': 'Hur röstar partierna?',
  'The most common cast vote in each party, per roll call. Yes means support for the committee proposal, which may itself reject a bill.':
    'Den vanligaste avgivna rösten inom varje parti per votering. Ja betyder stöd för utskottets förslag, som i sig kan avstyrka en proposition.',
  '● Yes': '● Ja',
  '● No': '● Nej',
  '● Abstain': '● Avstod',
  'Unclassified or tied positions remain outside the three coloured categories. Select a party to inspect decisions.':
    'Oklassificerade positioner eller lika röstetal ligger utanför de tre färgade kategorierna. Välj ett parti för att granska besluten.',
  '02 / Voting together': '02 / Röstar lika',
  'Where do parties agree?': 'Var är partierna överens?',
  'Same yes/no position divided by roll calls where both parties have a yes/no position. Abstentions are excluded; this is not ideological distance.':
    'Samma ja/nej-position dividerad med voteringar där båda partierna har en ja/nej-position. Nedlagda röster utesluts; detta är inte ett ideologiskt avstånd.',
  'Party agreement matrix': 'Matris över partiers röstsamstämmighet',
  'Agreement percentage · select a cell to see the denominator':
    'Andel lika röster · välj en cell för att se nämnaren',
  'Browse budget proposals': 'Bläddra bland budgetförslag',
  'Budget proposals / the money': 'Budgetförslag / pengarna',
  'Choose a year and see each proposed spending frame.':
    'Välj ett år och se varje föreslagen utgiftsram.',
  "All amounts below are proposed expenditure by area for the selected budget year. “Difference” means compared with the government's proposal for that same year. It is not a change from the previous year, actual spending or a measure of a party's support in a vote.":
    'Alla belopp nedan är föreslagna utgifter per område för valt budgetår. ”Skillnad” avser jämförelse med regeringens förslag samma år. Det är inte en förändring från föregående år, faktiska utgifter eller ett mått på partiets stöd i en votering.',
  'Budget year': 'Budgetår',
  Proposal: 'Förslag',
  'Budget year · session': 'Budgetår · riksmöte',
  'Areas present for': 'Områden som finns för',
  'Versus government · complete frames only':
    'Mot regeringen · endast fullständiga ramar',
  'Available in this import:': 'Tillgängligt i denna import:',
  '. A missing separate party frame cannot be inferred from the collective government proposal.':
    '. En saknad separat partibudget kan inte härledas från regeringens gemensamma förslag.',
  Area: 'Område',
  'Read the parliamentary comparison table ↗':
    'Läs riksdagens jämförelsetabell ↗',
  'This proposal has no imported row for this area.':
    'Förslaget saknar en importerad rad för detta område.',
  'View all 27 expenditure areas and source amounts':
    'Visa alla 27 utgiftsområden och källbelopp',
  'All expenditure areas, scroll horizontally':
    'Alla utgiftsområden, skrolla i sidled',
  'Government amount': 'Regeringens belopp',
  amount: 'belopp',
  Difference: 'Skillnad',
  'Riksdagen ↗': 'Riksdagen ↗',
  'Annual accounts / a different question': 'Årsutfall / en annan fråga',
  'What was budgeted, and what was spent?':
    'Vad budgeterades och vad användes?',
  "These annual accounts compare the approved budget with recorded expenditure for each area. This is separate from the parties' proposals above. Differences can reflect amendments, timing and implementation; they do not show which party caused an outcome.":
    'Dessa årsutfall jämför beslutad budget med redovisade utgifter per område. Det är skilt från partiernas förslag ovan. Skillnader kan bero på ändringar, tidpunkter och genomförande; de visar inte vilket parti som orsakade ett utfall.',
  'The annual accounts could not be loaded.':
    'Årsutfallen kunde inte läsas in.',
  'Loading annual accounts…': 'Läser in årsutfall…',
  'Annual account year': 'År för årsutfall',
  'Approved budget · 27 areas': 'Beslutad budget · 27 områden',
  'Recorded expenditure · 27 areas': 'Redovisade utgifter · 27 områden',
  'Outturn minus approved budget': 'Utfall minus beslutad budget',
  years: 'år',
  'Available:': 'Tillgängligt:',
  'Largest differences in': 'Största skillnaderna i',
  '. Select an area to inspect its figures; the full 27-area table is below.':
    '. Välj ett område för att granska siffrorna; den fullständiga tabellen med 27 områden finns nedan.',
  'Recorded expenditure · approved budget':
    'Redovisade utgifter · beslutad budget',
  '· difference': '· skillnad',
  'Reported amendments:': 'Redovisade ändringar:',
  '. This field is shown separately and is not added to the difference above.':
    '. Detta fält visas separat och läggs inte till skillnaden ovan.',
  'Annual accounts source ↗': 'Källa för årsutfall ↗',
  'Read all 27 areas for': 'Läs alla 27 områden för',
  'Annual account table, scroll horizontally':
    'Tabell över årsutfall, skrolla i sidled',
  'Approved budget': 'Beslutad budget',
  'Recorded expenditure': 'Redovisade utgifter',
  'Reported amendments': 'Redovisade ändringar',
  'Source: Statskontoret annual outturn aggregate, 1997–2025, one row per budget year and expenditure area. Historical area definitions may differ; this view compares values within each year and does not automatically join them to the FiU1 proposal snapshots.':
    'Källa: Statskontorets aggregat över årsutfall, 1997–2025, en rad per budgetår och utgiftsområde. Historiska områdesdefinitioner kan skilja sig åt; denna vy jämför värden inom varje år och kopplar dem inte automatiskt till ögonblicksbilder av FiU1-förslag.',
  'What counts as “talking about” an area?':
    'Vad räknas som att ”tala om” ett område?',
  'A zero is no detected match, not silence or lack of support. Short party-leader debates, a small vocabulary and exact word forms can all create zeros. Issue debates cover a different agenda and are shown separately.':
    'Noll betyder ingen upptäckt träff, inte tystnad eller brist på stöd. Korta partiledardebatter, begränsade ordlistor och exakta ordformer kan ge nollor. Sakdebatter har en annan dagordning och visas separat.',
  'Speech corpus': 'Talkorpus',
  'Language method': 'Språkmetod',
  'Exact keyword baseline': 'Exakta nyckelord · baslinje',
  'Swedish stemming · exploratory NLP': 'Svensk ordstamning · utforskande NLP',
  'party–area cells have no matches.': 'parti–område-celler saknar träffar.',
  'eligible speeches;': 'berättigade tal;',
  'area-assigned hits. All charts below use this corpus and method.':
    'områdestilldelade träffar. Alla diagram nedan använder denna korpus och metod.',
  'The comparison uses the whole parliamentary session, including speeches after the budget proposal. It describes topic attention, not what caused a budget decision. Neither matching method detects support, opposition or references to another party.':
    'Jämförelsen använder hela riksmötet, även tal efter budgetförslaget. Den beskriver uppmärksamhet kring ämnen, inte vad som orsakade ett budgetbeslut. Ingen av matchningsmetoderna upptäcker stöd, motstånd eller hänvisningar till ett annat parti.',
  'Inspect coverage and matching words': 'Granska täckning och matchade ord',
  'Language coverage table': 'Tabell över språktäckning',
  Speeches: 'Tal',
  'With any match': 'Med minst en träff',
  'Total hits': 'Totalt antal träffar',
  'Zero areas / 27': 'Områden med noll träffar / 27',
  'Dictionary for the selected area:': 'Ordlista för valt område:',
  'matches ·': 'träffar ·',
  'Stemming groups some inflected Swedish forms. It can also merge unrelated words and does not resolve synonyms, compounds, context or policy stance. It is a sensitivity check, not a validated semantic classifier. Shares use all area-assigned hits within that party and session; they are not a percentage of all speech.':
    'Ordstamning grupperar vissa böjda svenska ordformer. Den kan också slå ihop ord som inte hör ihop och hanterar inte synonymer, sammansättningar, sammanhang eller politisk ståndpunkt. Det är en känslighetskontroll, inte en validerad semantisk klassificerare. Andelarna bygger på alla områdestilldelade träffar inom parti och riksmöte; de är inte en procentandel av allt tal.',
  'How could semantic NLP improve this?':
    'Hur skulle semantisk NLP kunna förbättra detta?',
  "Next: split speeches into passages, retrieve candidate expenditure areas with multilingual embeddings, then review multi-label classifications against a hand-labelled Swedish sample. Keep an “unclassified” category, report precision and recall per area, and distinguish the speaker's proposal from criticism or quotations. Match time windows to budget submission dates. More matches alone do not demonstrate better results.":
    'Nästa steg: dela tal i passager, hitta möjliga utgiftsområden med flerspråkiga embeddings och granska fleretikettsklassificering mot ett handmärkt svenskt urval. Behåll en kategori för oklassificerat, redovisa precision och recall per område och skilj talarens egna förslag från kritik eller citat. Anpassa tidsfönstren till budgetarnas inlämningsdatum. Fler träffar i sig visar inte bättre resultat.',
  'The budget in plain numbers': 'Budgeten i tydliga siffror',
  'What would each proposal change?': 'Vad skulle varje förslag ändra?',
  'Government expenditure frames total': 'Regeringens utgiftsramar uppgår till',
  "billion SEK. Each card compares a party's proposal with the same year's government proposal—not with last year's spending. These are proposed expenditure frames, not actual spending or the full fiscal balance.":
    'miljarder kronor. Varje kort jämför ett partis förslag med regeringens förslag samma år – inte med förra årets utgifter. Det här är föreslagna utgiftsramar, inte faktiska utgifter eller hela budgetens saldo.',
  'Net difference ·': 'Nettoskillnad ·',
  'bn SEK total': 'mdkr totalt',
  'Largest increases': 'Största ökningarna',
  'No increases in these frames.': 'Inga ökningar i dessa ramar.',
  'Largest reductions': 'Största minskningarna',
  'No reductions in these frames.': 'Inga minskningar i dessa ramar.',
  'Read budget table ↗': 'Läs budgettabellen ↗',
  'No separate complete party proposal in this export. The collective government frame is not assigned to':
    'Inget separat fullständigt partiförslag finns i exporten. Regeringens gemensamma ram fördelas inte på',
  'Swedish Political Observatory': 'Svensk politiköversikt',
  'Interactive research': 'Interaktiv analys',
  'What do politicians say, propose and vote for?':
    'Vad säger, föreslår och röstar politikerna för?',
  'A shared entry point to formal parliamentary records. I started this because the connection between political language, budget priorities and recorded decisions is difficult to follow.':
    'En gemensam ingång till formella riksdagshandlingar. Jag började bygga den eftersom kopplingen mellan politiskt språk, budgetprioriteringar och registrerade beslut är svår att följa.',
  'Read speeches': 'Läs tal',
  'Published data snapshot': 'Publicerad dataögonblicksbild',
  'How has the market for data and software roles changed?':
    'Hur har marknaden för data- och mjukvaruroller förändrats?',
  'Historical job-ad aggregates, role definitions and technology mentions, with clear denominators and downloadable data.':
    'Historiska aggregat av platsannonser, rolldefinitioner och teknikomnämnanden med tydliga nämnare och nedladdningsbara data.',
  'Research pipeline · v2': 'Forskningsflöde · v2',
  'How well does a model generalise to unseen drug pairs?':
    'Hur bra generaliserar en modell till okända läkemedelspar?',
  'Drug and cell-line entity resolution, a DuckDB warehouse and model evaluation under four cross-validation strategies. Explore the exported results and their assumptions.':
    'Matchning av läkemedels- och cellinjeidentiteter, ett DuckDB-datalager och modellutvärdering med fyra korsvalideringsstrategier. Utforska de exporterade resultaten och deras antaganden.',
  'Allegoria / RFC Drift': 'Allegoria / förändringar i RFC-krav',
  'Work in progress': 'Pågående projekt',
  'What changes when a requirement goes from MUST to SHOULD?':
    'Vad förändras när ett krav går från MUST till SHOULD?',
  'A structured meaning-quality engine explored through RFC requirement profiles and clearly labelled synthetic examples. Validated political direction scoring is not available.':
    'En strukturerad motor för betydelsekvalitet som utforskas med kravprofiler från RFC:er och tydligt märkta syntetiska exempel. Validerade riktningsmått för politik finns inte.',
  'Incident NLP · Degree project': 'Incident-NLP · examensarbete',
  'Case study · Fora': 'Fallstudie · Fora',
  'Can similar incidents reveal useful review candidates?':
    'Kan liknande incidenter visa användbara kandidater för granskning?',
  'A privacy-aware Databricks workflow combining selected ISO/IEC 25012 data-quality dimensions, embeddings and clustering. Only approved aggregate results are shown.':
    'Ett integritetsmedvetet Databricks-flöde med utvalda datakvalitetsdimensioner ur ISO/IEC 25012, embeddings och klustring. Endast godkända aggregerade resultat visas.',
  'API contract · partial implementation':
    'API-kontrakt · delvis implementerat',
  'How can household activity become understandable analytics?':
    'Hur kan hushållsaktiviteter bli begriplig analys?',
  'A FastAPI and PostgreSQL project with authentication, immutable completion-event design and aggregation SQL. Household, task and analytics endpoints remain documented stubs.':
    'Ett FastAPI- och PostgreSQL-projekt med autentisering, oföränderlig händelsedesign för utförda sysslor och aggregerande SQL. Endpoints för hushåll, uppgifter och analys är fortfarande dokumenterade stubbar.',
  'DrugComb / data engineering & model evaluation':
    'DrugComb / data engineering och modellutvärdering',
  'Does the prediction hold up on something new?':
    'Håller prediktionen för något nytt?',
  'A research pipeline connecting drug-combination screens to molecular and cell-line features. The interesting question is how performance changes when the test data contains unfamiliar pairs, drugs or cell lines.':
    'Ett forskningsflöde som kopplar screening av läkemedelskombinationer till molekylära egenskaper och cellinjedata. Den intressanta frågan är hur prestandan förändras när testdata innehåller okända par, läkemedel eller cellinjer.',
  'The DrugComb report could not be loaded.':
    'DrugComb-rapporten kunde inte läsas in.',
  'Loading published research results…':
    'Läser in publicerade forskningsresultat…',
  'pair × cell line × study rows': 'rader för par × cellinje × studie',
  'resolved molecules': 'identifierade molekyler',
  'human cell lines': 'mänskliga cellinjer',
  '01 / Generalisation': '01 / Generalisering',
  'The test split changes the question.':
    'Uppdelningen av testdata ändrar frågan.',
  'Feature set / model': 'Egenskaper / modell',
  'Pearson correlation between predicted and observed ZIP. Same model across all four splits; higher is better. Bars use a fixed 0–1 scale.':
    'Pearsonkorrelation mellan förutsagt och observerat ZIP-värde. Samma modell i alla fyra uppdelningar; högre är bättre. Staplarna har en fast skala från 0 till 1.',
  'Means over three folds; fold SD is not a confidence interval. The mean-only baseline has no defined correlation. These are saved upstream results, not a new training run.':
    'Medelvärden över tre delmängder; standardavvikelsen är inte ett konfidensintervall. Baslinjen som bara förutsäger medelvärdet saknar definierad korrelation. Detta är sparade resultat från källprojektet, inte en ny träningskörning.',
  '02 / Data preparation': '02 / Dataförberedelse',
  'From measurements to a modelling table.':
    'Från mätningar till modelltabell.',
  'Counts at each recorded cleaning stage. Replicates are averaged after resolving drug and cell-line identities.':
    'Antal i varje dokumenterat rensningssteg. Replikat medelvärdesbildas efter matchning av läkemedels- och cellinjeidentiteter.',
  '03 / Dataset context': '03 / Datamaterialets sammanhang',
  'Synergy differs across the screened tissue groups.':
    'Synergi skiljer sig mellan de undersökta vävnadsgrupperna.',
  'analysed rows · scale 0–100%': 'analyserade rader · skala 0–100 %',
  'What I built, evaluation assumptions & data access':
    'Vad jag byggde, antaganden och dataåtkomst',
  'The pipeline performs entity resolution, builds a DuckDB star schema, applies data-quality checks and evaluates symmetric chemistry/biology features with LightGBM and baselines. The portfolio keeps a pinned copy of the pipeline and all 22 published result tables.':
    'Dataflödet matchar identiteter, bygger ett stjärnschema i DuckDB, gör datakvalitetskontroller och utvärderar symmetriska kemi- och biologiegenskaper med LightGBM och baslinjer. Portfolion innehåller en fast version av dataflödet och alla 22 publicerade resultattabeller.',
  'Monotherapy features come from the same experimental screen and assume single-agent responses are already available. RNA PCA uses the broader DepMap corpus, so the cell-line setup is not a fully isolated biological representation experiment. A low shuffled-label score is a useful diagnostic, not proof that every leakage risk is absent. These experimental results are not clinical evidence.':
    'Egenskaper för monoterapi kommer från samma experimentella screening och förutsätter att svar på enskilda substanser redan finns. RNA-PCA använder en bredare DepMap-korpus, så cellinjeupplägget är inte ett helt isolerat experiment med biologiska representationer. Ett lågt resultat med omkastade etiketter är en användbar diagnos, inte bevis för att alla risker för dataläckage saknas. Resultaten är experimentella och inte klinisk evidens.',
  'The full raw screening and DepMap files are not bundled here. Their source URLs, releases and hashes are in the input manifest. The local report provides all published aggregates and evaluation tables.':
    'De fullständiga råfilerna från screening och DepMap ingår inte här. Källadresser, versioner och kontrollsummor finns i inläsningsmanifestet. Den lokala rapporten innehåller alla publicerade aggregat och utvärderingstabeller.',
  'Browse all result tables ↓': 'Bläddra bland alla resultattabeller ↓',
  'Full upstream report': 'Fullständig rapport i källprojektet',
  'Input manifest': 'Manifest över indata',
  'Pinned source revision ↗': 'Fast version av källkoden ↗',
  'More original analysis figures': 'Fler ursprungliga analysfigurer',
  '· open full figure': '· öppna hela figuren',
  'Allegoria · a small experiment in RFC drift':
    'Allegoria · ett litet experiment om RFC-förändringar',
  'When MUST becomes SHOULD.': 'När MUST blir SHOULD.',
  "Can a small change in wording weaken a technical requirement? Allegoria's meaningquality engine makes that change explicit. Here, a cookie-specification comparison and a controlled example show what it can—and cannot—measure.":
    'Kan en liten ändring i ordval försvaga ett tekniskt krav? Allegorias meaningquality-motor tydliggör ändringen. Här visar en jämförelse av specifikationer för cookies och ett kontrollerat exempel vad motorn kan – och inte kan – mäta.',
  'The RFC export could not be loaded.': 'RFC-exporten kunde inte läsas in.',
  '01 / The language profile changed': '01 / Språkprofilen förändrades',
  'RFC 2965 (2000) → RFC 6265 (2011). Share of statements extracted by the heuristic reader, grouped by their first requirement keyword.':
    'RFC 2965 (2000) → RFC 6265 (2011). Andel påståenden som den heuristiska läsaren extraherade, grupperade efter första kravordet.',
  'extracted statements': 'extraherade påståenden',
  'A different document-wide profile is not proof that the protocol became looser. These documents differ in content, scope and wording.':
    'En annan profil på dokumentnivå bevisar inte att protokollet blev mindre strikt. Dokumenten skiljer sig i innehåll, omfattning och ordval.',
  '02 / A change the engine can explain':
    '02 / En ändring som motorn kan förklara',
  'Synthetic example · the actor and action stay identical. Only obligation strength changes.':
    'Syntetiskt exempel · aktör och handling är desamma. Bara skyldighetens styrka ändras.',
  'Requirement change': 'Kravändring',
  'Before: The client': 'Före: Klienten',
  'validate the response.': 'validera svaret.',
  'After: The client': 'Efter: Klienten',
  'Actual meaningquality output': 'Faktiskt resultat från meaningquality',
  "The result is computed offline using an annotated duty's modality change. It is not a claim about a real amendment in these RFCs.":
    'Resultatet beräknas offline från en annoterad skyldighets ändrade modalitet. Det är inte ett påstående om en verklig ändring i dessa RFC:er.',
  'matched keyword changes': 'matchade ändringar av kravord',
  'The strict sentence-matching method found no changed requirement pairs in the real comparison. That is a matching limitation, not evidence that nothing changed.':
    'Den strikta metoden för meningsmatchning hittade inga ändrade kravpar i den verkliga jämförelsen. Det är en begränsning i matchningen, inte belägg för att inget ändrades.',
  'Method, sources & limitations': 'Metod, källor och begränsningar',
  'The reader groups MUST/SHALL/REQUIRED, SHOULD/RECOMMENDED and MAY/OPTIONAL, including negative forms. It uses the first keyword per extracted sentence, skips quoted sentences and heuristically removes page furniture. Extraction recall has not been independently evaluated. It can miss multiple obligations, conditions, exceptions and rewritten requirements. Optional is displayed as optional, not missing data.':
    'Läsaren grupperar MUST/SHALL/REQUIRED, SHOULD/RECOMMENDED och MAY/OPTIONAL, inklusive negativa former. Den använder första kravordet per extraherad mening, hoppar över citerade meningar och tar heuristiskt bort sidornas kringtext. Extraktionens täckning har inte utvärderats oberoende. Den kan missa flera skyldigheter, villkor, undantag och omskrivna krav. Frivilligt visas som frivilligt, inte som saknad data.',
  "Real drift needs reviewed matches for the same actor, action, polarity and scope. The engine's direction rules are tested separately from this reader. Counts measure extracted statements, not every requirement in a standard.":
    'Verklig förändringsriktning kräver granskade matchningar för samma aktör, handling, polaritet och omfattning. Motorns riktningsregler testas separat från läsaren. Antalen gäller extraherade påståenden, inte varje krav i en standard.',
  'source ↗': 'källa ↗',
  'Snapshot SHA-256:': 'Ögonblicksbildens SHA-256:',
  'RFC 2119 requirement levels ↗': 'Kravnivåer i RFC 2119 ↗',
  'Allegoria source ↗': 'Källkod för Allegoria ↗',
  'Homie API / backend engineering': 'Homie API / backendutveckling',
  'From household events to useful summaries.':
    'Från hushållshändelser till användbara sammanfattningar.',
  'An API and data-model project exploring how chore-completion events can support workload, balance and cadence reports. It is an implementation in progress with an explicit API contract.':
    'Ett API- och datamodellprojekt som undersöker hur händelser för utförda hushållssysslor kan stödja rapporter om arbetsbörda, balans och regelbundenhet. Implementeringen pågår och har ett tydligt API-kontrakt.',
  Record: 'Registrera',
  'Immutable completion events': 'Oföränderliga slutförandehändelser',
  Enrich: 'Berika',
  'Household, task and member context':
    'Sammanhang för hushåll, uppgift och medlem',
  Aggregate: 'Aggregera',
  'Weekly workload, fairness and cadence':
    'Veckovis arbetsbörda, fördelning och rytm',
  Serve: 'Tillgängliggör',
  'Typed FastAPI response contracts': 'Typade svarskontrakt i FastAPI',
  Implemented: 'Implementerat',
  'Authentication, password hashing, database health checks, database schema and aggregation SQL. The design separates event records from the materialized views intended for analytics.':
    'Autentisering, lösenordshashning, hälsokontroller för databasen, databasschema och aggregerande SQL. Designen skiljer händelseregister från materialiserade vyer för analys.',
  'Still stubbed': 'Fortfarande stubbar',
  'Household, task, completion and analytics routes return documented previews or synthetic fixtures. Stub writes do not persist changes. No real household metrics are presented here.':
    'Rutter för hushåll, uppgifter, slutföranden och analys returnerar dokumenterade förhandsvyer eller syntetiska testdata. Skrivningar till stubbarna sparas inte. Inga verkliga hushållsmått presenteras här.',
  'Source & implementation status ↗': 'Källkod och implementeringsstatus ↗',
  'OpenAPI contract ↗': 'OpenAPI-kontrakt ↗',
  'Open data desk': 'Öppet databord',
  'Inspect the records behind the charts.':
    'Granska posterna bakom diagrammen.',
  'Search every row in the imported datasets, including budget proposals and decisions without a recorded roll call. Downloads contain the full selected table. Coverage is limited to the imported snapshots.':
    'Sök i varje rad i de importerade datamängderna, även budgetförslag och beslut utan registrerad votering. Nedladdningar innehåller hela den valda tabellen. Täckningen är begränsad till de importerade ögonblicksbilderna.',
  'Popular datasets': 'Populära datamängder',
  Dataset: 'Datamängd',
  rows: 'rader',
  'Search all columns': 'Sök i alla kolumner',
  'Try a decision title, party or document ID':
    'Prova en beslutstitel, ett parti eller dokument-ID',
  'Download full JSON': 'Ladda ned hela JSON-filen',
  'Original CSV': 'Ursprunglig CSV',
  'Definitions & relationships': 'Definitioner och relationer',
  'Loading selected records…': 'Läser in valda poster…',
  'matching rows of': 'matchande rader av',
  '. “—” means missing or not applicable.':
    '. ”—” betyder saknat eller inte tillämpligt.',
  'Dataset table, scroll horizontally': 'Datatabell, skrolla i sidled',
  'Source ↗': 'Källa ↗',
  'No rows match these filters.': 'Inga rader matchar filtren.',
  Previous: 'Föregående',
  Page: 'Sida',
  Next: 'Nästa',
  'imported speeches. Reply flags describe the source classification, not who is replying to whom.':
    'importerade tal. Replikmarkeringar beskriver källans klassificering, inte vem som svarar vem.',
  'Speech and reply counts per party': 'Antal tal och repliker per parti',
  'speeches ·': 'tal ·',
  replies: 'repliker',
  'Transcript party': 'Parti i protokollet',
  'Search this transcript': 'Sök i protokollet',
  'Search source text or speaker': 'Sök i källtext eller efter talare',
  'matches in this transcript.': 'träffar i detta protokoll.',
  'Read parliamentary source ↗': 'Läs källan hos riksdagen ↗',
  'Show 15 more speeches': 'Visa 15 tal till',
  'Read the debate in context': 'Läs debatten i sitt sammanhang',
  'Speeches, replies and the surrounding discussion.':
    'Tal, repliker och diskussionen runt omkring.',
  'Full source text from the imported metadata selection. Issue debates form a separate archive and are not included in the party-leader UMAP model. Older categorisation is incomplete; counts are coverage, not all political discussion.':
    'Fullständig källtext från det importerade metadataurvalet. Sakdebatter ligger i ett separat arkiv och ingår inte i UMAP-modellen för partiledardebatter. Äldre kategorisering är ofullständig; antalen beskriver täckning, inte all politisk diskussion.',
  Archive: 'Arkiv',
  'Debate session': 'Debattens riksmöte',
  'Find a debate': 'Hitta en debatt',
  'Search debate titles': 'Sök debattitlar',
  matching: 'matchande',
  'Show 30 more sections': 'Visa 30 avsnitt till',
  'Select a debate to load its full transcript.':
    'Välj en debatt för att läsa hela protokollet.',
  '· snapshot, not verified as the law on a debate date.':
    '· ögonblicksbild, inte verifierad som gällande lag vid debattdatumet.',
  'Search provisions': 'Sök bestämmelser',
  'Statute source ↗': 'Källa till författning ↗',
  'Source SHA-256:': 'Källans SHA-256:',
  'Law texts & source evidence': 'Lagtexter och källunderlag',
  'Read the source snapshots and inspect the limits of proposed-law comparisons.':
    'Läs källornas ögonblicksbilder och granska begränsningarna i jämförelser av lagförslag.',
  'Read the source law': 'Läs lagkällan',
  'Browse both available statute provision pools, with source hashes, snapshot versions and original text. Overlapping pools must not be added together as unique laws.':
    'Bläddra i båda tillgängliga urvalen av lagbestämmelser, med källornas kontrollsummor, versioner och originaltext. Överlappande urval får inte läggas ihop som om de vore unika lagar.',
  'Corpus pool': 'Källurval',
  'v1 · frozen corpus': 'v1 · fryst korpus',
  'v2 · expanded pool': 'v2 · utökat urval',
  'Search laws': 'Sök lagar',
  'Law snapshot': 'Lagögonblicksbild',
  'Select from': 'Välj bland',
  snapshots: 'ögonblicksbilder',
  'What does the summary leave out?': 'Vad utelämnar sammanfattningen?',
  'Two source-linked examples compare a political description with proposed legal text. They are not verified enacted amendments or eligible direction measurements. The second extraction interleaves two law-text columns and requires layout review.':
    'Två källänkade exempel jämför en politisk beskrivning med föreslagen lagtext. De är inte verifierade antagna ändringar eller lämpliga för riktningsmätning. Den andra extraktionen blandar två lagtextkolumner och kräver granskning av layouten.',
  'Political description': 'Politisk beskrivning',
  'Read source ↗': 'Läs källan ↗',
  'Proposed law ·': 'Föreslagen lag ·',
  'Inspect proposal layout ↗': 'Granska förslagets layout ↗',
  'Status:': 'Status:',
  'Software Developer': 'Mjukvaruutvecklare',
  'Data Scientist': 'Data Scientist',
  'Business & economy': 'Näringsliv och ekonomi',
  'EMU & referendum': 'EMU och folkomröstning',
  'Women & men': 'Kvinnor och män',
  'Police & crime': 'Polis och brott',
  'Housing & rents': 'Bostäder och hyror',
  'Climate, energy & EU': 'Klimat, energi och EU',
  'Sweden Democrats': 'Sverigedemokraterna',
  'Schools & teachers': 'Skolor och lärare',
  'Children & families': 'Barn och familjer',
  'General debate': 'Allmän debatt',
  'Euro & currency': 'Euro och valuta',
  Healthcare: 'Hälso- och sjukvård',
  'Elder care & pensions': 'Äldreomsorg och pensioner',
  Taxes: 'Skatter',
  'Jobs & labour market': 'Jobb och arbetsmarknad',
  'EU & Europe': 'EU och Europa',
  'UN & Afghanistan': 'FN och Afghanistan',
  'Parties & politics': 'Partier och politik',
  'Tax & public spending': 'Skatt och offentliga utgifter',
  'Russia & Ukraine': 'Ryssland och Ukraina',
  'NATO & defence': 'Nato och försvar',
  'Jobs & unemployment': 'Jobb och arbetslöshet',
  'Political responsibility': 'Politiskt ansvar',
  'Sweden & the world': 'Sverige och omvärlden',
  'Government administration': 'Rikets styrelse',
  'Public finance': 'Samhällsekonomi och finansförvaltning',
  'Tax & customs': 'Skatt, tull och exekution',
  Justice: 'Rättsväsendet',
  'International cooperation': 'Internationell samverkan',
  'Defence & crisis readiness': 'Försvar och krisberedskap',
  'International aid': 'Internationellt bistånd',
  'Health & social care': 'Hälsovård, sjukvård och social omsorg',
  'Sickness & disability benefits':
    'Ekonomisk trygghet vid sjukdom och funktionsnedsättning',
  'Old-age income security': 'Ekonomisk trygghet vid ålderdom',
  'Family & child benefits': 'Ekonomisk trygghet för familjer och barn',
  'Integration & equality': 'Integration och jämställdhet',
  'Labour market': 'Arbetsmarknad och arbetsliv',
  'Student support': 'Studiestöd',
  'Education & research': 'Utbildning och universitetsforskning',
  'Culture & media': 'Kultur, medier, trossamfund och fritid',
  'Housing & planning': 'Samhällsplanering, bostadsförsörjning och byggande',
  'Regional development': 'Regional utveckling',
  'Climate & environment': 'Allmän miljö- och naturvård',
  Energy: 'Energi',
  'Transport & communications': 'Kommunikationer',
  'Rural affairs & food': 'Areella näringar, landsbygd och livsmedel',
  Business: 'Näringsliv',
  'Municipal grants': 'Allmänna bidrag till kommuner',
  'Public debt interest': 'Statsskuldsräntor',
  'EU contribution': 'Avgiften till Europeiska unionen',
  'Random rows': 'Slumpmässiga rader',
  'Unseen drug pair': 'Okänt läkemedelspar',
  'Unseen drug': 'Okänt läkemedel',
  'Unseen cell line': 'Okänd cellinje',
  'Other observations of the same entities can appear in training.':
    'Andra observationer av samma entiteter kan finnas i träningsdata.',
  'The tested drug pair is absent from training.':
    'Det testade läkemedelsparet saknas i träningsdata.',
  'At least one drug in each test row is absent from training.':
    'Minst ett läkemedel i varje testrad saknas i träningsdata.',
  'The tested cell line is absent from training.':
    'Den testade cellinjen saknas i träningsdata.',
  'Not defined': 'Ej definierat',
  'Distribution of observed ZIP synergy scores':
    'Fördelning av observerade ZIP-synergivärden',
  'Agreement between repeated experimental measurements':
    'Överensstämmelse mellan upprepade experimentella mätningar',
  'Enrichment among highly ranked predictions':
    'Anrikning bland högt rankade prediktioner',
  'Prediction calibration by evaluation split':
    'Prediktionens kalibrering per utvärderingsuppdelning',
  'ZIP > 10 in the analysed data': 'ZIP > 10 i analyserade data',
  'Share of analysed rows with ZIP > 10, by lineage. Differences also reflect which drugs and studies were included; this is not a treatment comparison.':
    'Andel analyserade rader med ZIP > 10 per vävnadsgrupp. Skillnader speglar också vilka läkemedel och studier som ingick; detta är ingen jämförelse av behandlingar.',
  Incomplete: 'Ofullständigt',
  'Total proposed expenditure': 'Totala föreslagna utgifter',
  'No comparable total calculated': 'Ingen jämförbar total beräknad',
  'Largest spending areas': 'Största utgiftsområdena',
  'Largest differences, either direction': 'Största skillnaderna åt båda håll',
  'Government proposal': 'Regeringens förslag',
  Missing: 'Saknas',
  'No matching word forms': 'Inga matchande ordformer',
  Reply: 'Replik',
  protocols: 'protokoll',
  'debate sections': 'debattavsnitt',
  'no separate frame': 'ingen separat ram',
  unavailable: 'saknas',
  'budget + debate': 'budget och debatt',
  'debate only': 'endast debatt',
  'party-leader': 'partiledar',
  issue: 'sak',
  ads: 'annonser',
  'Loading topic patterns…': 'Läser in ämnesmönster…',
  'Topic shares use the full analysed corpus, not the map sample.':
    'Ämnesandelarna bygger på hela den analyserade korpusen, inte urvalet i kartan.',
  'Loading the job-market summary…':
    'Läser in sammanfattningen av arbetsmarknaden…',
  'parties with comparable data': 'partier med jämförbara data',
  'matched keyword occurrences across parties':
    'matchade nyckelordsträffar över partierna',
  'each available party': 'varje tillgängligt parti',
  'one party': 'ett parti',
  ' · top 8 forms': ' · de åtta vanligaste formerna',
  "Speaker's recorded vote:": 'Talarens registrerade röst:',
  'No same-member vote established.':
    'Ingen röst från samma ledamot har fastställts.',
  'raw rows': 'råa rader',
  'has drug & cell names': 'har namn på läkemedel och cellinje',
  'numeric ZIP score': 'numeriskt ZIP-värde',
  'ZIP within [-100, 100]': 'ZIP inom [-100, 100]',
  'two different molecules': 'två olika molekyler',
  'human cell lines only': 'endast mänskliga cellinjer',
  'unique (pair, cell line, study) after replicate mean':
    'unika (par, cellinje, studie) efter medelvärde av replikat',
  'Global mean': 'Globalt medelvärde',
  'Screen history (ridge on in-fold means)':
    'Screeninghistorik (ridge på medelvärden inom delmängd)',
  'LightGBM: chemistry + biology': 'LightGBM: kemi + biologi',
  'LightGBM: + screen history': 'LightGBM: + screeninghistorik',
  'LightGBM: + study': 'LightGBM: + studie',
  'LightGBM: + monotherapy': 'LightGBM: + monoterapi',
  'LightGBM: + targets (all features)':
    'LightGBM: + målmolekyler (alla egenskaper)',
  'LightGBM: all features except screen history':
    'LightGBM: alla egenskaper utom screeninghistorik',
  'Budget proposer': 'Budgetförslagsställare',
  'Evaluation split': 'Utvärderingsuppdelning',
  Model: 'Modell',
}
