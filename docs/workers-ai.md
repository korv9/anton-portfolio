# Workers AI

Två demos använder Cloudflare Workers AI: en besökares mening placerad på kartan över
partiledardebatterna, och frågor med citat över ett urval av SFS och EU:s AI-förordning.

## Regeln

Endast öppen, publicerad data skickas till Workers AI. Besökarens text loggas aldrig och sparas inte.

Nycklarna ligger i Cloudflares och GitHubs secrets. För engångskörningar får en lokal `.env`
användas; den är gitignorerad och checkas aldrig in.

## Kontots gränser

Kontot har Workers Free:

- 10 000 neurons per dag, delade av alla anrop. Över gränsen misslyckas anropen.
- 10 ms CPU per request. Väntan på modellen räknas inte.
- Ingen Vectorize.

## Principen

Workern gör bara två saker: den bäddar in text och genererar svar. All vektorsökning körs i
webbläsaren, mot komprimerade vektorer som byggts offline.

## Modellval

`/api/answer` använder `@cf/google/gemma-4-26b-a4b-it` med tänkandet avstängt
(`chat_template_kwargs: { enable_thinking: false }`). Kandidaterna kördes på de 20 evalfrågorna i
`configs/workers_ai/eval_questions.yaml` genom samma väg som sidan: inbäddning med bge-m3, sökning
i webbläsarkoden och svar genom Workern, natten till 2026-10-15 (UTC). Ett svar räknas som verifierat
när Workern godkänner det, alltså när varje citat står ordagrant i det stycke det pekar på.

| Modell             | Inställning             | Frågor | Verifierade | Tokens in | Tokens ut | Neurons per svar |
| ------------------ | ----------------------- | ------ | ----------- | --------- | --------- | ---------------- |
| gemma-4-26b-a4b-it | tänkande av             | 20     | 15 (75 %)   | 2 341     | 331       | 30,2             |
| gpt-oss-20b        | `reasoning_effort: low` | 19     | 12 (63 %)   | 2 328     | 293       | minst 50,3       |
| gpt-oss-20b        | standard (medium)       | 16     | 7 (44 %)    | 2 337     | 1 268     | minst 77,1       |

Tokens och neurons är medelvärden per svar, räknade från tokenantalen och Cloudflares pris per
modell. Cloudflare stoppade anropen kl. 00.15 UTC med beskedet att dagens 10 000 neurons var slut,
fast loggen bara hade räknat 2 793. Inga andra anrop än evalkörningen gjordes efter midnatt, så gpt-oss kostar mer
än tokenantalen visar, troligen för att dess resonemang inte räknas in i `usage`. Siffrorna för
gpt-oss är därför en undre gräns, och den verkliga kostnaden var ungefär fyra gånger högre.
Gemmas pris stämde dagen innan, då 2 725 neurons i loggen gick igenom utan stopp.

Kvoten tog slut innan gpt-oss hann svara på alla frågor. Valet håller ändå: även om de saknade
svaren hade blivit verifierade skulle gpt-oss nå högst 13 av 20 med låg ansträngning och 11 av 20
med standard. Med standardinställningen nådde gpt-oss taket på 2 048 tokens i fyra svar.

Två tidigare körningar ligger bakom inställningen. Med tänkandet på gick hela budgeten åt till
resonemang: med `max_tokens` 700 blev inget av 20 svar verifierat, och med 2 048 blev 3 av 19
verifierade till 72 neurons per svar. Utan exemplet på citatformatet i systemprompten blev 4 av 20
svar verifierade; modellen skrev ofta `[[id]"` i stället för `[[id]]"`.

## Recall efter komprimering

Vektorerna från bge-m3 har 1 024 dimensioner. De komprimeras med PCA och int8. Recall@10 mäter hur
stor del av de tio närmaste grannarna med fulla vektorer som också hittas med de komprimerade.

| Korpus    | Stycken | Recall@10, 256 dim | Recall@10, 384 dim | Levereras |
| --------- | ------- | ------------------ | ------------------ | --------- |
| sfs       | 9 970   | 0,940              | 0,977              | 256       |
| ai-act-sv | 1 413   | 0,961              | 0,987              | 256       |
| ai-act-en | 1 413   | 0,969              | 0,987              | 256       |
| debate    | 33 023  | 0,860              | 0,941              | 384       |

## Evalresultat

Sökningen hittade ett förväntat stycke bland de åtta första för 17 av 20 frågor och bland de tio
första för 18. Missarna bland de åtta första var fråga 6 (offentlighetsprincipen), 8 (arv utan
testamente) och 16 (AI som läser av känslor). Gemma fick ändå fram ett verifierat svar på alla tre
från andra stycken i träfflistan.

| Nr  | Korpus    | Fråga                          | Gemma | gpt-oss låg | gpt-oss medium |
| --- | --------- | ------------------------------ | ----- | ----------- | -------------- |
| 1   | sfs       | Uppsägningstid efter fem år    | ja    | ja          | ja             |
| 2   | sfs       | Antal semesterdagar            | ja    | ja          | ja             |
| 3   | sfs       | Ångra ett köp på nätet         | ja    | ja          | nej            |
| 4   | sfs       | Straff för stöld               | ja    | ja          | ja             |
| 5   | sfs       | Sambor som flyttar isär        | nej   | ja          | ja             |
| 6   | sfs       | Läsa myndigheters handlingar   | ja    | nej         | nej            |
| 7   | sfs       | Uppsägning av hyreskontrakt    | nej   | nej         | nej            |
| 8   | sfs       | Arv utan testamente            | ja    | ja          | ja             |
| 9   | sfs       | Handläggningstid hos myndighet | nej   | nej         | nej            |
| 10  | sfs       | Preskription av skuld          | ja    | ja          | nej            |
| 11  | ai-act-sv | Förbjuden AI                   | ja    | nej         | nej            |
| 12  | ai-act-sv | Vad som är ett AI-system       | ja    | ja          | nej            |
| 13  | ai-act-sv | Chattbotar måste framgå        | ja    | ja          | ja             |
| 14  | ai-act-sv | Märkning av deepfakes          | ja    | ja          | ja             |
| 15  | ai-act-sv | Ansiktsigenkänning i realtid   | nej   | nej         | nej            |
| 16  | ai-act-sv | AI som läser av känslor        | ja    | nej         | nej            |
| 17  | ai-act-sv | Böter för förbjuden AI         | ja    | ja          | –              |
| 18  | ai-act-sv | När förordningen gäller        | ja    | ja          | –              |
| 19  | ai-act-sv | Utbildning av personal         | nej   | nej         | –              |
| 20  | ai-act-sv | Högrisksystem                  | ja    | –           | –              |

`ja` betyder verifierat svar, `nej` att Workern stoppade svaret och `–` att frågan inte hann köras.
Inget svar blev `NO_ANSWER`. Gemmas fem stoppade svar föll på formen eller på ordalydelsen:

- Fråga 5: citaten skrevs som `[[id]"`, med en hakparentes för lite.
- Fråga 7: citatet kom före `[[id]]` i stället för efter.
- Fråga 9: ett citat kortades med `...`.
- Fråga 15 och 19: några hänvisningar saknade citat, och ett citat var omskrivet.

Raderna per fråga, med modellens råa text, ligger i `warehouse/features/workers_ai/eval/`.

Exempelfrågorna på sidan är tre av Gemmas verifierade svar per korpus, för `sfs` och `ai-act-sv`,
tagna direkt från evalraderna utan nya anrop. Frågornas vektorer bäddades in lokalt med samma
bge-m3. En fråga togs bara med när den lokala vektorn gav exakt samma åtta stycken som vektorn från
Workers AI, vilket gällde sex av sju. `ai-act-en` har inga exempel än, eftersom inga engelska frågor
har körts.
