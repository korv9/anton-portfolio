# The Riksdag and AI

`#ai-act-politics`, inside the EU AI Act Observatory, asks: **how has Swedish political language
about AI changed as the AI Act developed?** It counts which words the Riksdag uses about AI, by
whom and when, puts that next to the Act's milestones, and adds a separate, derived layer of
semantic similarity between speeches and the Act's text. It describes language; it does not infer
motives or claim that the Act caused anything.

```
npm run ai-politics              # all of the below
npm run ai-politics:ingest       # every speech archive since 2016/17 (rawstore)
npm run ai-politics:build        # dbt build --select tag:ai_politics
npm run ai-politics:similarity   # embeddings and nearest pairs, then the similarity mart
npm run ai-politics:publish      # frontend/public/data/ai-act/politics/*.json
```

The AI Act models must be built first (`npm run ai-act:build`): the similarity stage reads the
Act's Swedish text from them.

## Source

Riksdagen's open data publishes every speech in the chamber, one archive per riksmöte
(`anforande-201617.json.zip`). `platform/ingest/riksdagen/ingest_speeches.py` reads the list from
Riksdagen's open-data page and stores each archive as served under
`warehouse/raw/riksdagen/speeches/`, with URL, time and SHA-256 in the Riksdagen fetch log.
The default start, 2016/17, gives more than four years before the Commission's proposal
(21 April 2021).

Fetched on 6 October 2026: ten sessions, **129,110 speeches** from 13 September 2016 to
13 August 2026.

## The dictionary

`seeds/ai_politics/ai_politics_concepts.csv`: each group of words is a regular expression with a
description and, where needed, a caveat. The page prints every pattern verbatim.

- **Gate** (`ai`): a paragraph is about AI when it contains upper-case *AI* (also in compounds
  such as *AI-system*), *artificiell intelligens*, *maskininlärning*, *djupinlärning*,
  *språkmodell…*, *ChatGPT* or *generativ AI*. Upper case only for the abbreviation, so words
  containing the letters do not count.
- **The Act by name** (`ai_act`): *AI-förordningen*, *AI-akten*, *AI Act*, *förordningen om
  artificiell intelligens*.
- **Framing groups** (15): innovation; competitiveness and growth; *säkerhet*; security and
  defence; risk and threat; privacy and data protection; surveillance and biometrics; fundamental
  rights; transparency; responsibility; human oversight; automation and algorithms; work and
  jobs; regulation; disinformation and democracy.
- **Pairs** (`ai_politics_framing_pairs.csv`): innovation vs *säkerhet*, privacy vs security,
  regulation vs competitiveness.

Matching is **per paragraph**: a speech is about AI when one of its paragraphs passes the gate,
and the framing groups are looked for in those paragraphs only. A budget speech that mentions AI
once therefore does not count its other paragraphs. Code: `platform/nlp/text/concepts.py`;
tests with examples that must and must not match: `platform/tests/ai_politics/`.

Swedish has one word, *säkerhet*, for both safety and security; that group cannot tell them
apart, and the page says so. The narrower security group (cybersecurity, national security,
defence) is a separate concept.

## Data model

| Layer | Model | Grain |
|---|---|---|
| bronze | `stg_riksdag_speeches` (Python) | speech: metadata as written, text as plain paragraphs, archive hash |
| silver | `int_riksdag_speeches` | speech with a normalised party (none for the chair and speakers without a party) |
| silver | `int_ai_speech_paragraphs` (Python) | paragraph passing the AI gate, with the framing terms found in it |
| silver | `int_ai_speech_concepts` | speech × concept |
| gold | `fact_ai_speech` | speech: mentions AI, names the Act; the denominator for every share |
| gold | `mart_ai_politics_monthly` | month: speeches, AI speeches, AI Act speeches, share, three-month rolling share |
| gold | `mart_ai_politics_party_year` | party × year |
| gold | `mart_ai_politics_concepts` | party (or ALL) × period × concept, among AI speeches |
| gold | `mart_ai_politics_framing` | pair × party × period: counts and balance |
| gold | `mart_ai_politics_examples` | example paragraphs per concept, and every paragraph naming the Act |
| gold | `mart_ai_act_speech_similarity` | AI Act article × rank: the closest Riksdag AI paragraphs |

Shares always carry their denominator; rolling shares are sums over the window, not averages of
monthly shares. Periods are calendar years and three phases: before the proposal (to
20 April 2021), proposal to publication (to 11 July 2024), after publication. The phase dates are
Cellar's: the Act's original proposal (`52021PC0206`) is now fetched with the Act.

A framing **balance** is (A − B) / (A + B) over the AI speeches using either side, and is left
empty below ten such speeches.

## Semantic similarity

`platform/nlp/ai_politics/similarity.py` embeds, with one multilingual model
(`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, shared in
`platform/nlp/text/embeddings.py`):

- every paragraph of the current consolidated AI Act in its **official Swedish version**
  (1,077 passages; Articles 102–110, which only amend other acts, are left out);
- every Riksdag AI paragraph (1,256).

Both sides are Swedish, so the model compares like with like. For each article the eight closest
speech paragraphs are kept (three are published), and for each speech paragraph the three
closest passages of the Act. `run.json` records a chance baseline: 5,000 random speech–article
pairs have mean similarity 0.32 and a 95th percentile of 0.58; only pairs above that percentile
are published. A test checks that the mart rests on one model.

This is **semantic similarity**: the passages use related language. It is not influence, a
response to the Act, or shared meaning, and the page says so where the pairs are shown.

## Results (6 October 2026)

- 711 of 129,110 speeches mention AI in at least one paragraph (1,256 paragraphs); 26 name the AI
  Act (27 paragraphs).
- The yearly share of speeches mentioning AI stayed under 0.4 % every year from 2016 to 2022, then
  rose to 0.64 % in 2023, 0.97 % in 2024, 1.12 % in 2025 and 1.65 % in 2026 (to August).
- Among AI speeches, the most frequent groups over the whole period are innovation (16 %),
  regulation (14 %), risk (12 %), work and jobs (10 %) and *säkerhet* (10 %); human oversight
  is rare (under 1 %).

The rise coincides with the Act's negotiation and application and also with the public launch of
generative AI; the data cannot separate the two, and the page's caveat says that temporal overlap
does not prove causation.

## Limitations

- A dictionary counts words, not meaning: a paragraph can use a word to reject an idea, and AI can
  be discussed without the words in the gate.
- Party codes are as Riksdagen records them; ministers speak with their party code, so a
  governing party's counts include its ministers.
- Small denominators: a party with fewer than 20 AI speeches in a period is shown faded.
- Examples are the most recent paragraphs per concept, not a representative sample.
- Similarity depends on the model; scores are comparable within this run only.
