"""Word lists for the job-ad term analysis (platform/nlp/rising_terms.py).

STOP: function words, Swedish and English. Swedish: the pronouns, determiners, prepositions,
conjunctions, adverbs, auxiliaries and the commonest verbs, written out here (no Swedish list is
installed). English: scikit-learn's ENGLISH_STOP_WORDS, as platform/nlp/symbolic and ml/atlas use
it, without the words an IT ad uses as content (system, computer, full, front, back), plus the
contraction parts the tokenizer leaves (you'll -> you, ll). The AI Act analysis keeps its own
shorter lists in platform/nlp/log_odds.py, so its pre-registered output does not change.

BOILERPLATE: words of the ad and the application process, not of the job.
"""
from __future__ import annotations

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

from log_odds import STOP_EN, STOP_SV

SWEDISH = set("""
jag du han hon den det vi ni de man mig dig honom henne oss er dem sig mitt min mina mitt din dina
ditt hans hennes dess vår våra vårt er era ert deras sin sina sitt någon något några ingen inget
inga ingenting allt alla all annan annat andra varje var vart varannan sådan sådant sådana själv
själva samma denna detta dessa denne vilken vilket vilka vem vad vars hur när där här dit hit
var varför varifrån ett en och eller men utan samt både antingen varken som att om än då så
eftersom medan innan förrän fast trots fastän ty för till från av på i med mot om under över
efter före bakom bredvid mellan genom inom utom kring runt hos åt vid via per enligt bland
ur ut upp ner in fram bort hem iväg tillbaka emot förbi längs sedan sen också även bara redan
ännu fortfarande alltid aldrig ofta ibland nu då snart just inte icke ej ju väl nog kanske
dock alltså nämligen därför därmed dessutom sedan mycket mer mest mindre minst lite flera fler
många mången väldigt ganska helt hela heller också endast enbart framför särskilt främst
är var varit vara blir bli blev blivit har ha hade haft kommer komma kom kommit kan kunna
kunde kunnat ska skall skulle vill vilja ville velat måste får få fick fått bör borde gör göra
gjorde gjort går gå gick gått finns fanns funnits sker ske skedde ger ge gav gett tar ta tog
tagit står stå stod ser se såg sett säger säga sa sade känner hålla håller låter låta brukar
behöver behöva verkar
""".split())

ENGLISH = (set(ENGLISH_STOP_WORDS) - {"system", "computer", "full", "front", "back"}) | set("""
ll ve re s t d m don doesn isn aren wasn weren won wouldn couldn shouldn let lets get gets
getting got make makes making would could should will shall may might must can need needs
""".split())

STOP = STOP_SV | STOP_EN | SWEDISH | ENGLISH

BOILERPLATE = set("""
annons annonsen annonser ansök ansöka ansökan ansökningar ansökningsdag sista sök sökande
tjänst tjänsten tjänster rekrytering rekryteringen rekryteringsprocess rekryteringsprocessen
urval urvalet löpande intervju intervjuer intervjua välkommen välkomna varmt klicka knappen
apply applying application applications applicant applicants position positions role roles
candidate candidates recruitment recruiting recruiter interview interviews welcome click
""".split())
