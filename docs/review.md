# Granskningsunderlag

## Förändring

En tom arbetsmapp har fått en statisk React-/TypeScript-portfolio med svensk text, responsiv layout, mobilmeny, ankarnavigering, öppningsbara metoddjup, källhänvisningar och ett rapportavsnitt.

Pass A: startsida och projektfall. Pass B: källkontroll av historiska aggregat, transparenta rapporttomlägen, exportspecifikation samt granskning av mobilvy och tillgänglighet. Inga marknadsgrafer visas eftersom verifierade data inte finns. Rapportdefinitioner och syntetiska testannonser räcker inte som empiriskt underlag.

## Viktigt att granska före publicering

- Examensarbetets disposition och syntetiska illustration behöver stämmas av mot den godkända rapporten. Valda kvalitetsdimensioner och faktiska resultat saknas.
- E-post, LinkedIn och CV ska fyllas i via `src/content.ts` när materialet finns. De synliga statusarna är avsiktliga.
- Projektkällor är låsta till granskade versioner; se `docs/sources.md`.
- Sajten skickar inga formulär, anropar inga affärs-API:er och innehåller inga interna rådata.
- Ingen Git-remote fanns. Ingen PR, push eller publicering utfördes.

## Verifierat 2026-09-21

- Produktionsbygget med TypeScript och Vite lyckades.
- Sex Playwright-tester godkända i Chromium, desktop och mobil emulering.
- Meny, interna ankarlänkar, metodavsnitt och nedladdning av exportspecifikation fungerar.
- Ingen horisontell overflow vid 320, 375, 768 och 1280 px, samt vid 200 % textstorlek på 375 px.
- Axe hittade inga överträdelser i de kontrollerade WCAG 2 A/AA- och 2.1 AA-reglerna, inklusive öppnade metodavsnitt och mobilmeny. Detta är en automatisk kontroll, inte full tillgänglighetscertifiering eller manuell skärmläsargranskning.
- Skärmbilder av mobil- och desktoplayout granskades visuellt.
- Paketinstallationens audit: 0 kända sårbarheter.
- Två lokalt paketerade typsnitt; inga externa fontanrop. Ingen analys-/spårningstjänst.

Windows-sandlådan blockerade Node med EPERM. Installation, bygg- och webbläsarkontroller kördes därför med godkänd utökad åtkomst. Ett fontimportfel och ett startargumentfel rättades. Första webbläsarkörningen hittade låg kontrast i ett stegnummer och överflytning vid förstorad text; båda rättades innan den godkända körningen. Ett test behövde även korrigera hur en summary-text med dekorativt plus hittades.

## Körda huvudkommandon

```sh
npm install
npm install @fontsource-variable/dm-sans @fontsource-variable/manrope
npm install --save-dev prettier
npx playwright install chromium
npm run dev
npm run test:e2e
npm run format
npm run format:check
npm run check
npm run build
```
