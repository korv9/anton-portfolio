# Source feasibility

Official-source desk research checked 2026-10-16. This is an access assessment;
no company population or enforcement corpus was collected. Availability of a web
page does not establish completeness, bulk access permission or publication rights.

The [Phase 2 access assessment](phase-2.md) supersedes this desk assessment for
IMY/KKV collection: current robots checks, KKV reuse conditions, its direct-client
403 response and the reference-only pilot are documented there. Other sources
below remain future connectors.
The later [KKV alternative assessment](kkv-alternative.md) documents ordinary
independent court-PDF access, the API robots-policy hold, the fixed-cohort index
search and the local public-document import. It does not establish complete KKV
coverage or replace human evidence/publication review.

## Feasibility matrix

| Source | Access and format | History and gaps | Reuse and restrictions | Phase decision |
| --- | --- | --- | --- | --- |
| [IMY tillsyner och beslut](https://www.imy.se/tillsyn) | Public list of ongoing/completed supervision, detail pages and linked decisions, commonly PDF. Search dates and status are discovery aids. No documented bulk decision API verified. | IMY explicitly describes a selection from 2018 onward. Unpublished cases, older Datainspektionen material and redactions require separate checks or document requests. | [IMY reuse policy](https://www.imy.se/om-oss/vart-uppdrag/vidareutnyttjande-av-data/) notes privacy/confidentiality limits; no blanket CC license established here. Formal Swedish authority decisions have a statutory copyright rule, with exceptions noted below. | Feasible for a bounded manual pilot after identity and document review. Record selected-publication coverage. |
| [Konkurrensverket diarium](https://www.konkurrensverket.se/diarium/sok-i-Konkurrensverkets-diarium/), [search help](https://www.konkurrensverket.se/diarium/sok-i-Konkurrensverkets-diarium/sokhjalp/) | Searchable case metadata, parties and downloadable decisions. Browser-facing search is not a verified supported bulk API. | Help states all registered cases from 1998, updates daily, decisions usually about a day after dispatch. Many closed cases have a decision online; this does not promise every document. Case-type numbering changed in 2013. Curated competition lists are only selections. | Personal names omitted from web diary; missing/secret documents need authority review. No blanket open license or automation quota verified. Use statutory decision-text treatment only where applicable. | Feasible, with case-type and docket normalization. Keep complaints, merger clearances and procurement outcomes distinct from infringements. |
| [Domstolsverket open data](https://www.domstol.se/om-webbplatsen-och-digitala-kanaler/oppna-data/), [Sök rättspraxis](https://www.domstol.se/tjanster-och-blanketter/sok-rattspraxis/) | Public search/RSS; official open-data page links technical YAML. Its download was not retrievable through the research tool. A stable machine API and its terms must be verified in the pilot. | Open-data overview says reports from 1981 and judgments/decisions from March 2025. Start years vary by court/series. This is mainly higher-court precedent, not a national company-case register or complete lower-court history. | Published parties' personal names are omitted. An explicit machine-readable license was not independently verified; do not label the feed CC0 from secondary-site claims. Decision text has statutory treatment below. | Feasible as precedent/discovery evidence; inadequate alone for appeal/finality coverage. |
| [Individual Swedish courts](https://www.domstol.se/domar-och-beslut/bestall-domar-beslut-eller-handlingar/) | Contact the court holding a case to obtain judgments or case documents. Each release is reviewed; some requests incur copying/scanning or delivery charges. | Court-specific websites and registries are needed for unpublished/older judgments, appeals and finality confirmation. Anonymization can prevent organization-number matching. | Public access is assessed per document. Access is not automatic permission to build a personal criminal-history index. Preserve redactions and delivery restrictions. | Manual supplement in a later phase. This task sends no requests to courts or other authorities. |
| [FI sanctions](https://www.fi.se/sv/publicerat/sanktioner/), [financial firms](https://www.fi.se/sv/publicerat/sanktioner/finansiella-foretag/), [market information](https://www.fi.se/sv/publicerat/sanktioner/marknadsinformation/) | Separate category/year lists and linked decisions. No supported bulk sanctions API established. Appeals go to court; administrative findings and closure letters differ. | Lists expose current years and older archives. Earliest complete coverage, removals and category consistency were not established. Securities cases may sanction a shareholder or natural person while naming an unrelated issuer. | [FI open-data policy](https://www.fi.se/sv/om-fi/om-webbplatsen/oppen-data/) permits reuse without fee/agreement, with FI and date as attribution. Document privacy/third-party limits still require review. | Feasible for directly identified legal entities. Sparse applicability for IT firms is possible; preserve issuer and sanctioned party separately. |
| [SCB company register](https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/avgiftsfria-uppgifter-i-foretagsregistret/) | Free current register API; current documentation specifies a personal API key, registration and terms, 5,000 rows/call and 5 calls/second. Employee figures are size classes. | Current information only; no historical endpoint or free delta feed. Snapshot data to reproduce a sample. Companies/legal units and workplaces/CFAR are different units. | Key must not be shared. Record accepted terms; free access does not establish all redistribution conditions. Old certificate instructions describe a replaced interface. | Preferred Phase 1 population, subject to actual authorized access and complete paging. |
| [Bolagsverket high-value API](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder/apiforvardefulladatamangder.5513.html), [download files](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/nedladdningsbarafiler.2517.html) | HVD API requires issued credentials/OAuth2; page specifies no agreement and 60 queries/minute. Downloadable HVD files are free/no agreement, updated weekly. Full company-information API is a separate service. | Digital annual-report file collection is stated to cover digital filings from 2020. Digital filing is incomplete; accounts are lagged and entity/group figures differ. Verify file columns before substituting for the SCB population. | Save dataset-specific terms and attribution evidence. [Full-information API](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/apiforatthamtaforetagsinformation.3988.html) has a separate access/contract process. Do not infer free unrestricted access to every registry field. | Corroborate legal names, registration and relationships; evaluate available HVD files before acquiring broader access. |

## Industry classification

Use a versioned classification from the
[official SNI 2025 publication](https://www.scb.se/contentassets/b06d75cd13f8423595b4ba8290c9ea55/sni-2025.pdf)
and [SCB register variable descriptions](https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/variabelbeskrivning/).
Proposed eligible primary codes: 62.100 programming; 62.201 IT consultancy;
62.202 computer facilities management; 62.900 other IT/computer services;
63.100 data infrastructure, processing and hosting; 58.290 other software publishing.
Persist five digits without punctuation and the classification version.

This intentionally excludes telecom carriers, hardware manufacturing/resale,
holding companies, general web portals and game publishing. It defines an IT
services/software cohort, not the whole ICT sector. Secondary codes alone do not
qualify a company under the proposed rule. A 2007-coded input requires a documented
crosswalk and separate review; never replace 2007 codes with 2025 labels silently.

## Applicable legal and reuse baseline

[Swedish Copyright Act 1960:729, section 9](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1960729-om-upphovsratt-till-litterara-och_sfs-1960-729/)
excludes authority decisions and some other official texts from copyright, with
specified exceptions for included works. This is a statutory rule, not a CC0
license covering an entire website, database, photo collection or attachment set.
Assess the actual document and any third-party content.

[DIGG's guidance on making data available](https://www.digg.se/kunskap-och-stod/oppna-och-delade-data/vagledning-om-oppna-datalagen/krav-vid-tillgangliggorande-av-data-for-vidareutnyttjande)
and IMY's reuse policy require attention to information protection and personal
data. The Open Data Act does not itself create a right to disclosure of secret
documents. Robots rules, technical quotas and published terms must be checked
again before any automated collector is enabled. No attempt to bypass access
controls or infer an unpublished endpoint is part of this design.

[GDPR](https://eur-lex.europa.eu/eli/reg/2016/679) recital 14 and articles 5, 6, 9,
10 and 35 inform the privacy design. Legal-entity data differs from information
about identifiable employees, complainants, sole traders or defendants.
[IMY's article 10 position](https://www.imy.se/globalassets/dokument/rattsligt-stallningstagande/imyrs-2021-1-lagovertradelser.pdf)
explains that protected criminal-offence information can extend to suspicions and
proceedings, including acquittals. Publishing a company record must not expose a
natural person's criminal history by implication. See [risks](risks.md).

## Unknowns and pilot evidence required

The pilot must retain terms/robots verification time, actual API specification
version, request parameters, pagination/terminal evidence, server response metadata,
original-byte hashes and gaps for each source. For HTML/PDF sources, manually test
ordinary decisions, changed decisions, appeals and redacted documents. Establish
minimum/maximum observed dates separately from any authority's advertised coverage.
No observed row count, complete-history date or access permission has been invented
to fill these unresolved checks.
