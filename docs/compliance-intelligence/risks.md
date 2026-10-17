# Risks and publication controls

Assessed 2026-10-16. These controls are product requirements for later work, not a
claim that the unimplemented publication system already enforces them.

| Risk | Consequence | Required control | Owner / release condition |
| --- | --- | --- | --- |
| Public warehouse backup | Raw PDFs, personal details or reviewer data can leak even when omitted from JSON exports. | Private storage/database outside current upload roots, separate credentials and explicit export allowlist. Test that sentinel private content cannot reach either public releases or whole-database backup. | Data engineer; block enforcement acquisition until isolation exists. |
| Wrong legal entity or brand | A subsidiary, parent, issuer or customer receives another party's finding. | Register-backed numbers, dated aliases, separately reviewed party role and explicit liability scope. Group membership cannot authorize attribution. | Identity reviewer; unresolved/conflicting matches held. |
| Incomplete publication | Selected public decisions create false claims of no cases or unfair company comparisons. | Publish search windows, source selection, failures, withheld documents and verification dates. No company compliance/innocence ranking. | Analytics reviewer; coverage denominator visible. |
| Procedural misclassification | Complaint or administrative fine is described as a conviction. | Separate event/outcome types, forum checks, legal-basis locators and human legal review. | Legal reviewer; category evidence required. |
| Appeal or correction missed | Overturned decisions or reduced amounts are presented as current. | Separate appeal/finality/stay state, linked court dockets, preserve original versions and invalidate affected approvals. | Legal reviewer; proposed 30/90-day freshness policy applied. |
| Personal data in company evidence | Complainants, employees, witnesses, defendants or sole traders become identifiable. | Minimize collection; exclude natural-person identity rows and criminal-history search. Redact derivatives, inspect OCR/PDF metadata and avoid public raw documents. | Privacy reviewer; projection-specific clearance. |
| Legal reuse assumed | Public access is mistaken for blanket licensing or lawful republication. | Retain dated source/dataset terms; apply statutory decision-text rules with exceptions; distinguish attachments and personal data. | Privacy/reuse reviewer; unresolved rights block publication. |
| Sample drift and selection bias | Replacing merged firms or choosing famous sanctioned brands invalidates the study. | Freeze population snapshot, code, methodology, selected rows and hash before any enforcement search; no replacements. | Analytics engineer; exactly 50 verified unique members. |
| Group amount multiplication | One joint fine is counted for each party or for both first instance and appeal. | Decision/remedy grain, explicit latest-effective-outcome policy and deduplication tests before aggregates. | Analytics engineer; reconciled sums and exclusions. |
| Extraction/translation error | OCR decimal, currency, Swedish wording or legal basis changes the meaning. | Keep original-byte evidence and page locators, pin extractor versions, manually compare material fields and review translations. | Legal/data reviewers; uncertain fields remain unknown. |
| Approval becomes stale | A changed record reuses approval of an older version. | Bind reviews to record/evidence hashes and the final export; independent publication approval; withdrawn records removed in the next corrected release. | Publisher; deny publication when any required review is absent. |
| Credentials or query logs leak | Personal API keys, tokens or person numbers reach git, R2 or CI logs. | Secrets managed in authorized secret stores, redact auth/request metadata, use least-privilege source and storage credentials. | Data engineer; secret scan and log inspection before operationalization. |

## Privacy assessment before collection

[GDPR](https://eur-lex.europa.eu/eli/reg/2016/679) distinguishes personal information
from legal-entity information; company documents can contain both. Determine the
controller, purpose and lawful basis for actual personal-data processing, document
minimization/retention, and assess whether a DPIA is required before processing that
may present high risk. Evaluate any storage or processing outside the EEA. These
are assessments of the real processing arrangement, not permissions implied by this
architecture.

[IMY's article 10 guidance](https://www.imy.se/globalassets/dokument/rattsligt-stallningstagande/imyrs-2021-1-lagovertradelser.pdf)
covers more than convictions. A person-level offence/suspicion database is excluded
from this company outcome module. Company fines and proceedings must be described
using the documented legal category; publish no criminal label based on an
administrative decision or on a named employee's conduct. Public-interest or
journalistic exemptions and an issuing authority's own publication do not establish
this project's legal basis automatically. Resolve material legal questions with a
qualified reviewer before the affected release.

## Publication workflow

1. Preserve primary evidence privately and classify access/reuse/privacy status.
2. Resolve the exact party identity and effective-period conflicts. Hold ambiguity.
3. Review event category, forum, legal basis, amount and procedural status.
4. Review the intended public fields, source links and wording for privacy/reuse.
5. Obtain independent publication approval for the record/evidence and artifact hashes.
6. Validate the allowlisted export and release manifest before activation.
7. Handle correction/removal requests through the same versioned review path, recording
   reasons privately and updating public outcome/freshness information promptly.

Current policy proposal: reverify open/appealed outcomes every 30 days and final
outcomes every 90 days, or sooner on new evidence. The data owner must set raw
evidence, rejected-candidate and reviewer-log retention periods before collection;
indefinite retention is not an approved default. Immutable releases need a specific
withdrawal/purge and cache-handling process for accidental personal disclosure.
Removing a current manifest pointer alone does not erase a public object.

The Phase 0 SQL rejects some structurally impossible states but is not an access
control or legal-review engine. Its tests cannot establish publication permission.
