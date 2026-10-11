# Granskning av projektsidornas layout

Referens: `#politik`. Bakgrund och färgpalett är kvar. Granskningen omfattar 66
projekt-, tema- och plattformsadresser på 1440 × 1000 och 390 × 844 px.
Sidornas första vy och diagram granskades med skärmbilder. Panelernas geometri
kontrollerades även längre ned på sidorna.

## Åtgärdade fynd

- `frontend/src/ui/dash/dash.css:8`: automatiska kolumnbredder kunde göra
  sakdebatternas innehåll 770 px brett på en mobil, trots att sidans overflow var
  klippt. Dashboardens kolumn kan nu krympa till tillgänglig bredd.
- `frontend/src/projects/projectStructure.css:169`: den äldre temalayouten lade
  ett andra rutnät runt dashboarden. På väljar- och voteringssidorna blev det
  tekniska kortet omkring 110 px brett. Temats huvuddelar ligger nu i en kolumn,
  med ett separat rutnät för graf och tekniskt kort.
- `frontend/src/ui/Stage.tsx:49`: KPI:erna låg före sidrubriken i examensarbetet
  och Homie. De placeras nu efter rubriken i diagramramen. Samma ordning gäller
  Concept Journey och Concept Constellation.
- `frontend/src/site/site.css:67`: en generell stor rubrikstil konkurrerade med
  projektens egna stilar. Sidrubriker, avsnitt, grafkort och tekniska sidopaneler
  har nu tydliga, gemensamma storlekar från tokens.
- `frontend/src/datamodel/ErPage.tsx:780`: ER-översiktens text blev för liten när
  hela diagrammet krympte till mobilbredd. Diagrammet behåller läsbar storlek
  och kan rullas inom sin egen ram med pekskärm eller tangentbord.

Övriga rättningar: gemensamma marginaler, mer kompakta introduktioner,
välfärdsgraf före teknisk information och ett tydligt tomt läge för DiVA.

## Kontroller

- Inga överlappande paneler, felaktigt smala kort, klippta paneler eller
  sidfel i den automatiska genomgången av 132 vyer.
- Layouttesterna kontrollerar faktisk panelbredd och placering, inte bara
  avsaknad av horisontell rullning. De kontrollerar också rubrik före KPI:er.
- Diagrammens former, källor, filter och värden är kvar. Manrope, den varma
  paletten och de tekniska modellkorten håller ihop sidornas uttryck.
- Hierarki, fokusmarkeringar, mobilanpassning och kontrast har granskats med
  designprinciperna och webbgränssnittets riktlinjer.
