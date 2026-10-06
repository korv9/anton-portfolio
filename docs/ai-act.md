# EU AI Act Observatory

`#ai-act` asks: **what does the EU AI Act actually mean for organisations building or deploying
AI?** It is a source-traceable map of Regulation (EU) 2024/1689's articles, actors, obligations,
application dates and changes, built from official EU sources only. It is a navigation aid, not
legal advice.

```
npm run ai-act            # ingest + dbt build + publish
npm run ai-act:ingest     # python platform/ingest/eu_ai_act/run.py
npm run ai-act:build      # dbt build --select tag:ai_act (models, seeds and tests)
npm run ai-act:publish    # python platform/publish/eu_ai_act/export_ai_act.py
npm run architecture:build  # the Data Constellation picks the domain up
```

## Official sources

| Source | What | How |
|---|---|---|
| Publications Office of the EU, **Cellar** (the repository behind EUR-Lex) | The documents related to the Act: amending acts, corrigenda, consolidated versions, proposals to amend it, acts based on it | SPARQL endpoint `publications.europa.eu/webapi/rdf/sparql` (`platform/legal/cellar.py`) |
| Cellar content negotiation | The text of the Act (Official Journal), of each consolidated version and of each amending act, as XHTML, in English and Swedish | `publications.europa.eu/resource/celex/<CELEX>` with `Accept: application/xhtml+xml` and `Accept-Language` |
| European Commission | Guidelines, codes of practice, templates, the AI Act policy page and the AI Act Service Desk | The pages listed in `platform/ingest/eu_ai_act/sources.py` |

EUR-Lex pages are what a reader follows (every row carries its `source_url`); they are not
fetched, since EUR-Lex answers automated requests with a browser challenge. No secondary source
(law firms, blogs) is used for legal data.

## Ingestion and versioning

`platform/ingest/eu_ai_act/` writes to `warehouse/raw/eu_ai_act/` through `lib/rawstore.py`, so
every file has a provenance line in `_manifest.jsonl`: URL, request headers (format, language),
fetch time, SHA-256 and size.

```
warehouse/raw/eu_ai_act/
  acts/<CELEX>.<en|sv>.xhtml         one file per published text; a CELEX number names one text,
                                      so a new consolidated version is a new file
  cellar/related@<sha12>.json        every distinct Cellar answer, kept (store_version)
  cellar/fetched.json                which texts the last run asked for and whether Cellar had them
  guidance/<id>@<sha12>.html         every distinct version of each Commission page
  guidance/sources.json              the page list
  _manifest.jsonl
```

Nothing is overwritten: texts are immutable per CELEX number, and pages and query answers that
change in place are kept per version (`rawstore.store_version`). A run is a handful of requests
spaced two to three seconds apart, so it is safe to schedule (weekly is plenty); a scheduled run
detects a new amendment, corrigendum or consolidated version as a new Cellar answer and fetches
the new text.

Fetched on 6 October 2026: Cellar listed 28 related documents; set aside the consolidations of
other acts and 20 documents remain, the Act included. Six texts were fetched; one (the English
rendering of the first consolidated version) is not held by Cellar and is recorded as unavailable.

## The versions

The Act was amended by **Regulation (EU) 2026/1744 (Digital Omnibus on AI)** of 8 July 2026, and
Cellar holds a consolidated text of 27 July 2026 (`02024R1689-20260727`). The site reads that
text as current and compares it with the text published in the Official Journal on 12 July 2024
(`32024R1689`). `dim_ai_act_document` gives each consolidated version a validity window (from
its date until the day before the next); exactly one is current (a test checks it).

The comparison (`int_ai_act_provision_changes`) is provision by provision. A consolidated text
marks amended passages with ▼ markers naming the amending act (`32026R1744: REPLACED`), each
holding until the next marker; the parser carries them forward. A provision is **inserted**,
**deleted**, **amended** (texts differ and a marker names the act) or **unchanged**. When the
texts differ but no marker names an act, it is **text_differs**, never called an amendment: that
can be a corrigendum or a difference in rendering. Result: 38 provisions amended, 7 inserted,
1 text_differs (Article 108), 87 unchanged.

## The parser (`platform/legal/parse.py`)

Both the Official Journal and the consolidated rendering mark structure with ELI ids:
`cpt_III` (chapter), `cpt_III.sct_2` (section), `art_6`, `rct_12`, `anx_III`, each with a
`.tit_1` title. The parser follows those ids in document order, so it does not depend on either
rendering's styling, and keeps the text verbatim apart from white space: one line per block,
list markers joined to their item, footnote calls left out (their numbering differs between
renderings), powers written as `10^25`. It is written for any EU act; the AI Act is the first.
Tests: `platform/tests/legal/`.

## Data model

| Layer | Model | Grain |
|---|---|---|
| bronze | `stg_ai_act_texts`, `stg_ai_act_related`, `stg_ai_act_guidance_pages`, `stg_ai_act_fetches` | file as fetched, with provenance |
| silver | `int_ai_act_documents` | document (Cellar), with document type from the CELEX scheme and version validity |
| silver | `int_ai_act_provisions` | version × language × provision (article, recital, annex), verbatim |
| silver | `int_ai_act_definitions` | Article 3 point: term and definition verbatim |
| silver | `int_ai_act_provision_changes` | provision: change between the OJ text and the current text |
| silver | `int_ai_act_guidance` | Commission page: title and date read from the page |
| silver | `int_ai_act_article_actors` | article × actor: mentions and "shall" sentences (derived) |
| gold | `dim_ai_act_document`, `dim_ai_act_guidance` | documents and guidance |
| gold | `dim_ai_act_article`, `dim_ai_act_annex`, `dim_ai_act_recital` | the current text, English and Swedish |
| gold | `dim_ai_act_actor`, `dim_ai_act_risk_class` | actors with Article 3 definitions; risk classes |
| gold | `bridge_ai_act_article_actor`, `bridge_ai_act_article_reference`, `bridge_ai_act_article_guidance` | many-to-many links |
| gold | `mart_ai_act_obligations` | actor × obligation × article |
| gold | `mart_ai_act_timeline` | milestone (application dates, deadlines, document dates) |
| gold | `mart_ai_act_changes` | change (documents, guidance, provisions) |

### Actors

Eleven, under the Act's own terms (`seeds/eu_ai_act/ai_act_actors.csv`): provider, deployer,
provider of a general-purpose AI model, downstream provider, authorised representative,
importer, distributor (operators); notified body; market surveillance authority, national
competent authority, AI Office (authorities). Each carries its Article 3 definition verbatim.
A provider of a general-purpose AI model has no definition of its own; it is a provider under
Article 3(3), and the row says so.

### Application dates

Each article gets the date from which it applies under Article 113 as amended
(`seeds/eu_ai_act/ai_act_application_rules.csv`): the most specific rule wins (article, then
section, then chapter, then the general date). Every rule carries the sentence of Article 113 it
rests on. Where only part of an article has a different date (Article 5's prohibitions added in
2026), the article carries a second date and is shown as *partly applying* in between.

### Obligations

51 obligations (`seeds/eu_ai_act/ai_act_obligations.csv`), the main ones, not every duty in the
Act. Each row has three kinds of content, kept apart:

- `source_quote`: the sentence of the Act the obligation rests on, **verbatim**;
- actor, risk class and requirement type: our classification of it;
- `summary_en` / `summary_sv`: a one-line explanation written for this site.

## Source, derived, interpretation

Every published file and every block on the page is one of three kinds, and the page marks it:

| Kind | What |
|---|---|
| **Source** (official text) | Article text, definitions, quoted sentences, document titles and dates, as published |
| **Derived** | Computed from the text by a stated method: actor mentions and "shall" sentences (term patterns), cross-references (patterns), what changed between versions (comparison) |
| **Interpretation** | Written for this site: obligation summaries and classification, risk-class descriptions, the navigator's questions and rules |

No summary replaces legal text; no LLM output is used anywhere in this product.

## Tests

- `assert_ai_act_quotes_in_current_text`: every curated sentence (obligations, milestones,
  application rules, risk classes) appears verbatim in the current English text of the article
  it cites. If the law changes under a quote, the build fails.
- `assert_ai_act_sources_are_official`: every public row links to EUR-Lex, the Publications
  Office or the Commission.
- `assert_ai_act_dates_valid`, `assert_ai_act_one_current_version`, and unique, not-null,
  accepted-values and relationship tests on every model (115 dbt nodes and tests in all).
- Python: `platform/tests/legal` (parser, comparison, markers, Cellar, ingest selection).
- Unit: `frontend/tests/unit/aiact.test.ts` (files hang together, Article 113 dates, status on a
  day, navigator rules). End to end: `frontend/tests/aiact.spec.ts`.

## The page

`frontend/src/aiact/`. Views: overview (what it is, what applies now, what is next, who is
affected; latest official change, application date, next milestone, latest guidance; a monthly
snapshot sized for a screenshot with "copy as text"), today (every article by chapter with its
status on the reader's date), timeline, roles, risk classes, obligations (role × topic matrix
and a filterable list), the **startup navigator**, changes (with "what changed this month")
and sources. `#ai-act-article?a=<n>` opens an article with its official text in the reader's
language. The reader's date decides what applies; `?idag=YYYY-MM-DD` previews another day.

The navigator's rules live in `platform/publish/eu_ai_act/navigator.json` and are checked
against the obligations and articles when published. Its result says what a scenario *may
involve* and never classifies anyone.

## Limitations

- A navigation aid, not legal advice. Recitals, annexes, delegated and implementing acts,
  standards and national law all matter for whether a provision applies.
- The obligations are a curated selection; the "shall" signal per article is a pattern, not a
  legal reading.
- Application dates are per article; paragraph-level exceptions (Article 6(5), Article 5's new
  points) are noted, not modelled per paragraph.
- Corrigenda are listed from Cellar's metadata (Cellar gives no English title for them); their
  text is not compared separately.
- Guidance pages without a publication date on the page keep none.
- Quotes and the version comparison use the English text; the Swedish text is shown as the
  official Swedish language version.

## Built for more EU law

Nothing in `platform/legal/` is specific to the AI Act: another act (GDPR, the DSA, the Data
Act, NIS2, the Cyber Resilience Act) needs its CELEX number, a source list, and its own seeds
for actors, obligations and application rules.
