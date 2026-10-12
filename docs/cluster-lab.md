# Cluster Lab

Lokala experiment för hela Symbolic Atlas och Platsbankens annonser. Kör från
repots rot på den redan utcheckade branchen. Resultaten stannar i `warehouse/`;
verktyget uppdaterar inga publicerade atlaser och deployar inte.

## Konfiguration

- `configs/cluster_lab/test.yaml`: två verkliga smoke-körningar, 400 observationer
  vardera. Jobbtestet använder det uttryckligen valda arkivet `2026-Q3`, inte hela
  2023–2026. Atlas-testet väljer ur alla tillgängliga verk.
- `jobs_2023_2026.yaml`: hela den tillgängliga jobbmarknaden, datum från och med
  2023-01-01 och före 2027-01-01. Ingen tech-, titel- eller kompetensavgränsning.
- `symbolic_atlas.yaml`: förekomster, unika passager och experiment per symbol.
- `overnight.yaml`: båda dataseten och alla tre Atlas-familjerna i en ändlig plan.
- `layouts_only.yaml`: nya kartor från redan sparade klusteretiketter.

`datasets` väljer adaptrar, källor, datum och familj. `max_symbols: null` tar alla
symboler som klarar `min_occurrences` och `min_works`. Nattkonfigurationen tillåter
20 symboler; antalet kvalificerade symboler bestäms ur den inlästa korpusen.
`source_archives` är ett uttryckligt källurval för test, aldrig en dold gräns.

Ändra basparametrar direkt i YAML eller använd en override:

```powershell
python -m ml.cluster_lab.cli validate --config configs/cluster_lab/overnight.yaml --set clustering.min_samples=10
```

Datasetets egna YAML-inställningar har företräde framför gemensamma inställningar.
CLI-overrides tillämpas sist, även efter datasetets baseline.
För Atlas ändras alltså dess `representation`, `clustering` eller `sweep` i
datasetblocket i nattkonfigurationen. Alla defaults och overrides sparas i
varje körnings `config.json`.

Sökområden finns i `sweep.search`. Enskilda värden, listor och ändliga intervall:

```yaml
sweep:
  coarse_candidates: 24
  search:
    - parameters:
        reduction.method: [none, pca, svd, umap]
        clustering.min_samples: [3, 5, 10, 20]
        clustering.min_cluster_size: [100, 300, {fraction: 0.005}]
    - when: {reduction.method: umap}
      parameters:
        reduction.n_components: [5, 10, 20, 30]
        reduction.n_neighbors: {range: {start: 15, stop: 120, step: 15}}
```

`fraction` räknas mot det faktiska antalet observationer i försöket. Det använda
heltalet sparas separat. Villkor väljer metodens sökområde. En reproducerbar,
begränsad slumpmässig sökning väljer kandidater; den kör inte hela produkten.
Ogiltiga nycklar, tomma listor, modellrevisioner och parameterkombinationer ger fel.

## Inläsning och täckning

Verktyget använder repots JobTech-arkivhämtare med ett nytt fulltextläge. Den
befintliga filtrerade IT-pipelinen och aggregerade marknadsrapporten behåller sina
uppgifter. Samma hämtare används av Cluster Lab, med återupptagbara Range-hämtningar,
retries för throttling/serverfel och checkpointade Parquet-block. ZIP-importen kan
skanna tillbaka till senast färdigskrivna block efter ett avbrott. Stabilt annons-ID
deduplicerar versioner mellan arkiv. Olika annonser slås inte ihop på textlikhet.

Årsarkiv 2023–2025 och kvartalsarkiv 2026 hämtas från den
[officiella arkivkatalogen](https://data.arbetsformedlingen.se/annonser/historiska/).
JobStreams [officiella API-schema](https://jobstream.api.jobtechdev.se/swagger.json)
beskriver `/v2/snapshot` som alla **aktiva** annonser. 