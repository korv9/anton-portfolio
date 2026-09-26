from pathlib import Path
from hashlib import sha256
import yaml

virtues = [
    ('mod', 'Den modiges hållning ligger mellan den feges undvikande och den dumdristiges likgiltighet inför fara. Rädslan har en plats i denna karaktär utan att fylla hela synfältet. Fastheten består i uppmärksamhet på faran och handlingens betydelse.'),
    ('måttfullhet', 'Den måttfulles karaktär ligger mellan den utsvävandes upptagenhet av njutning och den känslolöses avstånd till all glädje. Begären ingår i ett sammanhang av vänskap, arbete och vila. Njutningen har ett värde utan att ensam bestämma personens sätt att leva.'),
    ('generositet', 'Den generöses hållning ligger mellan den giriges slutna hand och den slösaktiges likgiltighet inför tillgångarnas värde. Gåvan uttrycker uppmärksamhet på mottagaren och på det gemensamma livet. Egendomen är varken ett självändamål eller något helt betydelselöst.'),
    ('sannfärdighet', 'Den sannfärdiges karaktär ligger mellan skrytarens förstoring av den egna betydelsen och den självförringandes förnekelse av sina förmågor. Berättelsen har proportioner som svarar mot erfarenheten. Personen framträder med både sina förtjänster och sina begränsningar. Talet präglas av saklighet snarare än beräkning.'),
    ('vänlighet', 'Den vänliges hållning ligger mellan den inställsammes ständiga bekräftelse och den grälsjukes sökande efter motsättningar. Samvaron rymmer värme och en tydlig egen röst. Intresset för andra vilar i en stadig karaktär och saknar beroende av deras omedelbara uppskattning. Oenighet ryms inom denna vänlighet.'),
    ('mildhet', 'Den mildes karaktär ligger mellan den hetsiges vrede och den likgiltiges frånvaro av gensvar. Upprördheten står i proportion till händelsens betydelse och dess sammanhang. Lugn och känslighet hör samman i denna hållning, med utrymme för både allvar och försoning. Ilskan är varken härskare eller främling i personens liv.'),
    ('självaktning', 'Den självaktandes hållning ligger mellan den fåfänges uppblåsta självbild och den försagdes förminskning av sitt värde. Förhållandet till erkännande präglas av stadga. Andras uppskattning är betydelsefull utan att ensam bära personens uppfattning av sin egen förmåga. Självkännedomen förenar tillförsikt med ett klart sinne för begränsningar.'),
    ('kvickhet', 'Den kvickes karaktär ligger mellan gycklarens gränslösa skämtande och den sträves avstånd till lekfullhet. Humorn hör till en uppmärksam samvaro. Dess lätthet rymmer känsla för samtalets ton och för människorna i rummet, med en rörelse mellan allvar och avspänning. Skrattet uttrycker gemenskap och en blick för tillvarons motsägelser.'),
    ('ambition', 'Den balanserat ambitiöses hållning ligger mellan den ärelystnes jakt på erkännande och den håglöses ointresse för förtjänst. Arbetets värde och den egna insatsen framträder i samma blick. Framgång har betydelse utan att fylla hela föreställningen om ett gott liv. Uthålligheten har sin grund i intresset för uppgiften och i känslan för dess plats i ett större sammanhang.'),
    ('storslagenhet', 'Den storslagnes karaktär ligger mellan den pråliges uppvisning av rikedom och den småaktiges upptagenhet av varje utgift. Ett gemensamt företags betydelse ger form åt insatsen. Omsorgen gäller helhetens kvalitet och människornas deltagande, med sinne för proportioner. Storleken är förbunden med sammanhanget och dess värdighet. Det synliga resultatet uttrycker denna samlade blick.'),
]
pairs = [
    ('löfte', 'En löftesgivare ska hålla sitt löfte till mottagaren. Plikten avser fullgörandet av den handling som löftet uttrycker och inte enbart en försäkran om god vilja.', 'löftets fullgörande medför allvarlig skada för mottagaren'),
    ('sann uppgift', 'En uppgiftslämnare ska lämna sanningsenliga uppgifter till mottagaren. Plikten avser överensstämmelsen mellan uppgiften och det uppgiftslämnaren känner till, med samma krav på tal och skrift.', 'uppgiftens innehåll utsätter mottagaren för allvarlig skada'),
    ('återlämnande', 'En förvarare ska återlämna den anförtrodda egendomen till ägaren. Plikten avser samma föremål som förvararen tog emot och innebär ett faktiskt överlämnande till den person som äger föremålet.', 'överlämnandet utsätter ägaren för en omedelbar fara'),
    ('redovisning', 'En förvaltare ska redovisa de anförtrodda medlen sanningsenligt för huvudmannen. Plikten avser en redovisning som återger användningen av medlen och ger huvudmannen en riktig bild av förvaltningen. Redovisningen omfattar varje utgift.', 'redovisningen röjer en skyddad persons vistelseort'),
    ('erkännande', 'En uppdragstagare ska tillskriva medarbetaren dennes eget arbete. Plikten avser erkännandet av den faktiska arbetsinsatsen i presentationen av det gemensamma resultatet inför uppdragsgivaren. Erkännandet ingår i själva presentationen.', 'namngivningen utsätter medarbetaren för allvarlig skada'),
    ('samtycke', 'En undersökningsledare ska inhämta deltagarens fria samtycke till medverkan. Plikten avser deltagarens eget ställningstagande till den beskrivna undersökningen och dess användning av deltagarens uppgifter. Samtycket är deltagarens eget beslut.', 'deltagaren behöver en omedelbar livräddande insats'),
    ('avtal', 'En avtalspart ska fullgöra sitt frivilligt ingångna åtagande gentemot motparten. Plikten avser den överenskomna prestationen i dess helhet och inte enbart ett uttryck för fortsatt samarbetsvilja. Det frivilliga åtagandet binder den part som ingick avtalet.', 'prestationen orsakar motparten en allvarlig skada'),
    ('rättelse', 'En intygsgivare ska rätta sin egen felaktiga uppgift till mottagaren. Plikten avser en rättelse som tydligt anger vilken uppgift som var oriktig och återger det förhållande som intyget beskriver. Rättelsen ingår i intygsgivarens ansvar för sitt eget uttalande.', 'rättelsen röjer en skyddad persons identitet'),
    ('respekt', 'En samtalsledare ska bemöta varje deltagare som en självständig person. Plikten avser ett bemötande som erkänner deltagarens egen vilja och ställning i samtalet, med samma respekt för varje deltagare. Deltagarens ställning grundas i dennes person och inte i nyttan för samtalsledaren.', 'bemötandet hindrar avvärjandet av en omedelbar fara'),
    ('förtroende', 'En förtroendeperson ska bevara den anförtrodda hemligheten. Plikten avser hemlighetens innehåll och omfattar dess återgivning i både tal och skrift inför andra personer än den som lämnade förtroendet. Förtroendet binder mottagaren genom dennes eget åtagande att bevara innehållet.', 'tystnaden utsätter en annan person för allvarlig skada'),
]
rows = []
def add(pid, group, topic, text, pair_id=None):
    rows.append(dict(passage_id=pid, group=group, pair_id=pair_id, topic=topic, text=text,
                     text_sha256=sha256(text.encode('utf-8')).hexdigest(),
                     source='constructed:2026-09-11; philosophical form, not quotation',
                     review_note='Human philosophical and slot review pending.'))
for i, (topic, text) in enumerate(virtues, 1):
    add(f'virtue-{i:02}', 'virtue', topic, text)
for i, (topic, body, condition) in enumerate(pairs, 1):
    for group, ending in [
        ('categorical', 'Detta gäller utan undantag, oberoende av egen fördel och av andras önskemål.'),
        ('conditional', f'Detta gäller dock inte om {condition}.')
    ]:
        add(f'{group}-{i:02}', group, topic, body+' '+ending, f'pair-{i:02}')
Path('corpus/philosophy_v1.yaml').write_text(yaml.safe_dump(
    dict(schema_version=1, passages=rows), allow_unicode=True, sort_keys=False, width=100),
    encoding='utf-8')
