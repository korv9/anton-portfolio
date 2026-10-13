# Cluster Lab

## Publicerade debatter och länsprofiler

`public_research` återanvänder labbets representationscache, checkpointade embeddings,
klustringskörningar, register och layoutmotor. Det laddar fulltexten som den befintliga
publiceringsmanifesten pekar på, utan ny ingestion eller publicering. Länsprofiler använder
numeriska årsindikatorer och sparad standardisering, inte textinbäddningar.

```powershell
python -m ml.cluster_lab.public_research prepare --config configs/cluster_lab/public_research.yaml
python -m ml.research.prepare_public_profiles
python -m ml.cluster_lab.public_research pilot --config configs/cluster_lab/public_research_clean.yaml
python -m ml.cluster_lab.public_research run --config configs/cluster_lab/public_research_clean.yaml
python -m ml.cluster_lab.public_research run --config configs/cluster_lab/public_research_clean_leaf.yaml
python -m ml.research.public_results resample --config configs/cluster_lab/public_research_clean.yaml
python -m ml.research.public_results analyze --config configs/cluster_lab/public_research_clean.yaml
```

Kommandona kan köras igen efter avbrott. Färdiga försök kontrolleras med checksummor och
återanvänds. `provenance.json` binder implementationen; ändrad ML-kod kräver ett nytt
experimentregister. För annat år eller ändrad segmentering välj också ett nytt `lab.output`.
Snapshoten i ett befintligt register uppdateras aldrig med nya publicerade värden.
`validated-config.yaml` och varje körnings `config.json` visar de använda parametrarna.
SVD:s `fit_seed` är låst separat från UMAP-/klustringsseed.

Öppna resultaten i lokal Cluster Lab genom att starta Vite med
`CLUSTER_LAB_OUTPUT=warehouse/cluster_lab/public-research-clean-2026-10-12`. Inställningen gäller
bara den lokala servern. `gallery/` innehåller samma observations-id och sparade etiketter
för alla layouter; numeriska grupper har länsexempel och medelvärden i originalenheter i
`profiles.json`. Deras nummer är inte en rangordning.

Lokala, återupptagbara experiment för Symbolic Atlas och Platsbankens annonser.
Kör från repots rot. Verktyget byter inte branch, ersätter inga publicerade
resultat och deployar inte.

## YAML-filer

| Fil i `configs/cluster_lab/` | Användning |
| --- | --- |
| `test.yaml` | 400 verkliga observationer per dataset, två layouts vardera. Jobbtestet väljer uttryckligen Q3-arkivet 2026. |
| `overnight.yaml` | Ändlig nattplan för båda dataseten och tre Atlas-familjer. |
| `jobs_2023_2026.yaml` | Separat jobbsökning över alla tillgängliga yrkesområden. |
| `symbolic_atlas.yaml` | Förekomster, unika passager och experiment per symbol. |
| `layouts_only.yaml` | Fler kartor av befintliga klusteretiketter. |

Nattfilen är en egen konfiguration; den importerar inte de separata datasetfilerna.
Ändra `datasets` för källor, datum och familj. Datasetblockets inställningar
ersätter gemensamma YAML-värden. CLI-overrides tillämpas sist, också för baseline.
Alla defaults och overrides sparas i varje körnings `config.json`.

Sökdomäner finns i `sweep.search`: skalärer, kandidatlistor och
`{range: {start: 15, stop: 120, step: 15}}`. `when` väljer metodens parametrar.
`min_cluster_size: {fraction: 0.005}` räknas om mot försöksstorleken; det använda
heltalet sparas. Kandidatantal, finalister, seeds, samples, layouts och resurser
styrs via YAML. Inget globalt tidstak används.

## Start och återupptagning på Windows

```powershell
python -m ml.cluster_lab.cli validate --config configs/cluster_lab/overnight.yaml
python -m ml.cluster_lab.cli prepare --config configs/cluster_lab/overnight.yaml
python -m ml.cluster_lab.cli plan --config configs/cluster_lab/overnight.yaml
python -m ml.cluster_lab.cli run --config configs/cluster_lab/test.yaml --resume
powershell -ExecutionPolicy Bypass -File scripts/start_cluster_lab.ps1
python -m ml.cluster_lab.cli status
python -m ml.cluster_lab.cli stop
```

Startscriptet lämnar en fristående Windows-process, PID och stdout/stderr i
`warehouse/cluster_lab/session.json`. Datorn behöver vara på och vaken. Stopp
sker vid nästa checkpoint efter eventuell pågående modellpassning. Efter exit:

```powershell
Remove-Item -LiteralPath warehouse/cluster_lab/STOP
powershell -ExecutionPolicy Bypass -File scripts/start_cluster_lab.ps1
```

Samma oförändrade konfiguration, data och implementation återanvänder plan och
färdiga försök. Avbrutna block har checksummor och återupptas. Ändrade parametrar
ger nya identiteter. Ett OS-lås hindrar två skrivare i samma register.

## Granska och kör om

```powershell
python -m ml.cluster_lab.cli compare --dataset jobs-2023-2026
python -m ml.cluster_lab.cli layouts --run-id RUN_ID --config configs/cluster_lab/layouts_only.yaml
python -m ml.cluster_lab.cli select --run-id RUN_ID
python -m ml.cluster_lab.cli export
python -m ml.cluster_lab.cli replay --run-id RUN_ID --destination configs/cluster_lab/replay.local.yaml
python -m ml.cluster_lab.cli run --config configs/cluster_lab/replay.local.yaml --resume
```

Replay binder den ursprungliga, hashkontrollerade snapshoten och dess exakta
modellparametrar och sample. För en ny passning med samma inställningar, använd
ett nytt `output` via `--set output=warehouse/cluster_lab/replay`.

Starta `npm run dev` och öppna `http://127.0.0.1:5173/#cluster-visuals`.
Lokala Cluster Lab kan jämföra två körningar, byta layout, visa konfiguration,
profiler, exempel och faktisk täckning. Tunga filer laddas vid öppning.
Urvalsmarkeringar i gränssnittet sparas i webbläsaren. CLI-markeringar sparas i
registret. `CLUSTER_LAB_OUTPUT` kan välja ett annat lokalt register för Vite.

## Data, precision och lagring

Resultat, manifest, loggar och planer ligger i `warehouse/cluster_lab/`.
Delade embeddings och reduktioner finns i dess `cache/`. Fulltext och böcker
ligger i repots `warehouse/raw/`. Allt detta är gitignored.

Coverage-rapporter visar år, månader, yrkesområden, saknade fält och senaste
publicering. 2026 är ett ofullständigt år. Aktiva annonser kompletterar arkiven
men återställer inte historiken för redan borttagna annonser efter senaste
kvartalsarkivet. Sample-resultat är märkta med valda och totala antal samt ID:n.
Fullsteget passar samtliga observationer i den avsedda, frysta snapshoten.

Nattfilen använder CUDA och float16-lagring, med precision i cacheidentitet och
avrundningsdiagnostik. Jobbens fullsteg väljer flera klusterkonfigurationer inom
en representation (`full_representation_limit: 1`) för lokal disk och RAM.
Representationerna jämförs först på 20 000 och 60 000 observationer. Fulla UMAP-
passningar använder konfigurerad, strömmad PCA före UMAP; layout använder den
sparade klusterrymden och mäts mot ursprungsfeatures. Dessa resursval är synliga
och kan ändras. Textvektorcachen är begränsad; matrischeckpoints bevaras separat.

`ingestion.retain_downloads: false` frigör ZIP-cache efter verifierad fulltextimport.
Textshards, metadata, källreferenser och checksummor behålls; resume hämtar inte
färdiga arkiv igen. Sätt `true` för att också behålla ZIP-filerna.

[Metoder, täckning och artefakter](../../docs/cluster-lab.md) beskriver
centrering per verk/författare, HDBSCAN-definitioner, utvärdering och caching.

```powershell
python -m pytest ml/cluster_lab/tests -q --basetemp warehouse/cluster_lab/unit-check
npm run check
npx playwright test --config frontend/playwright.config.ts cluster-lab.spec.ts --workers 1
```
