# Exportunderlag för Swedish Job Market Analytics

Rapporten visar ännu inga historiska resultat. Dessa filer behövs från en granskad historisk körning, inte från `fixtures/jobs.json`.

Källversion: https://github.com/korv9/swedish-job-market-analytics/tree/59ffcf5a896c28449b424d0dcf1dd284dcc19b58

## Skapa exporten i källprojektet

När den historiska pipelinen och dbt-kontrollerna redan har körts:

```sh
python scripts/export_analytics.py --database data/history.duckdb --output data/powerbi
```

Detta körs i jobbmarknadsprojektet, inte i portfolion. Exportören vägrar ofullständig arkivtäckning och ändrade urvalsregler. Den skapar även interna granskningsfiler med textutdrag: dessa ska inte kopieras till den publika portfolion.

## Tre planerade grafer

### 1. Annonsvolym per månad · linjediagram

Fil: `Jobs.csv`.

Fält: `publication_month`, `role_family`, `total_ads`, `is_complete`.

Definition: antal unika annons-ID:n i vald roll, grupperat efter publiceringsmånad. Inte antal lediga tjänster, anställningar eller aktuell annonsstock. Ofullständig månad är saknad data, inte noll.

### 2. Teknikomnämnanden över tid · andelsdiagram

Fil: `Skills.csv`.

Fält: `publication_month`, `role_family`, `skill`, `ads_with_skill`, `total_ads`, `skill_share`, `is_complete`, `sufficient_volume`.

Definition: `ads_with_skill / total_ads`. Nämnaren är samtliga annonser i samma månad och roll, inte summan av teknikmatchningar. En annons kan nämna flera tekniker. Noll nämnare ger saknad andel. Textmatchning skiljer inte krav från meriter eller negationer. Små urval måste märkas, med modellens `sufficient_volume` som en dokumenterad signal, inte en statistisk signifikansbedömning.

### 3. Andelsskillnad 2025 mot 2024 · horisontella staplar

Fil: `Comparison.csv`.

Fält: `role_family`, `skill`, `baseline_year`, `comparison_year`, `is_complete`, `baseline_skill_ads`, `baseline_total_ads`, `comparison_skill_ads`, `comparison_total_ads`, `share_change_pp`.

Definition: `100 × (comparison_skill_ads / comparison_total_ads - baseline_skill_ads / baseline_total_ads)`. Årsandelarna beräknas från årsvolymer, inte genomsnittet av månadsandelar. Båda åren kräver tolv kompletta månader. Visa procentenheter, inte procent.

## Proveniens och kvalitetskontroll före införande

- Bifoga `export_manifest.json` med exporttid, radantal, kolumnschema och SHA-256 per fil. Avlägsna manifestets absoluta lokala `database`-sökväg ur en publik kopia; bevara övrig proveniens.
- Bifoga en granskad sammanfattning av arkivkällor, faktisk period/täckning, rollregler, saknade beskrivningar, tvetydiga rollmatchningar och möjliga återpubliceringar. Råtexter och kontaktuppgifter behövs inte.
- Kontrollera unika nycklar per roll/månad/teknik och att ingen period saknas. En uttryckligen komplett period utan annonser kan visas som noll, men inte en saknad rad.
- Kontrollera antal mot nämnare och andelar, valda år samt kontrollsummor. Testdata måste uttryckligen avvisas som marknadsresultat.
- Omvandla enbart granskade aggregat till en statisk lokal datafil. Sajten ska fortsatt sakna live-API.
- Varje graf ska ha källa, faktisk period, definition, begränsningar och tillgänglig datatabell. Lägg till relevanta tester för beräkningar och saknade observationer när graferna implementeras.

Urvalet gäller Data Engineer, Analytics Engineer och Data Scientist enligt projektets versionerade titel-/taxonomiregler. Det representerar inte hela svenska arbetsmarknaden. Återpubliceringar och olika ID:n för liknande annonser kan påverka volymen.
