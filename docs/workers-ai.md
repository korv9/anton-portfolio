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

_Inte gjort._ Fylls i när kandidaterna har jämförts på evalfrågorna.

## Recall efter komprimering

_Inte mätt._ Fylls i med uppmätt recall@10 mot de fullständiga vektorerna.

## Evalresultat

_Inte körda._ Fylls i med resultaten per fråga och modell.
