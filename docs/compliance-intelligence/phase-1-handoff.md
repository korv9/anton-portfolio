# Phase 1 handoff

This is the original Phase 0 plan. Current implementation and activation commands
are in [Phase 1 operation](phase-1.md); results and the remaining register-input
dependency are in [Phase 1 validation](phase-1-validation.md).

Next phase: Swedish IT company cohort and identity resolution only. Do not ingest
enforcement decisions, construct a dashboard, alter the homepage/intro animations,
or register scheduled enforcement jobs.

## Starting points

Read this directory and the repository instructions first, then query the existing
graph before source lookup. Review the local dirty worktree without reverting other
work. Use `platform/compliance_intelligence/schema.sql` as a version 0 contract and
the existing pytest conventions. No company population, cohort date, API access or
50-row selection has been established in Phase 0.

The proposed population/ranking policy is in [architecture](architecture.md).
Primary SNI 2025 codes: `62100`, `62201`, `62202`, `62900`, `63100`, `58290`.
Qualify active Swedish AB legal entities. Rank known employee-size classes descending,
then verified normalized organization number ascending. Use the source codebook's
explicit class order; do not sort display strings lexically. This is a deterministic
size-class sample, not an exact-employment league table.

## Required inputs

1. Authorized access to the current SCB register API, or a documented equivalent
   register snapshot with the required legal-unit, activity, primary-SNI/version and
   employee-class fields. Phase 0 did not inspect or use secrets. Evaluate free
   Bolagsverket HVD files for corroboration before acquiring broader access.
2. Complete snapshot/query manifest, source terms and timestamps. Preserve all pages
   or a content-addressed manifest with their hashes and verified terminal condition.
   Current-only API data cannot reconstruct an arbitrary historic cohort date.
3. Official SNI and employee-class codebooks pinned to the snapshot, including
   treatment of missing classes, inactive entities and duplicate register observations.
4. Register/company-report evidence for names, aliases and dated relationships.
   Self-reported brand pages are supporting evidence; they cannot override conflicting
   register identity. Keep issuer, sanctioned party and country concepts separate
   even though enforcement data is not acquired in this phase.

If access, reuse rights or population completeness cannot be established, implement
offline selection against an explicitly supplied verified snapshot and report the
remaining input dependency. Do not invent 50 companies, approximate SNI codes,
employee counts, parent links or historic names to complete the file.

## Implementation sequence

1. Add a bounded register loader or snapshot-import interface under
   `platform/compliance_intelligence/`. Keep raw snapshots outside public backup roots
   until their contents/terms are cleared. Reuse byte hashes, request manifests and
   collection checkpoints; never place API secrets in provenance.
2. Implement organization-number normalization/checksum and entity-country validation.
   Populate `dim_company`, `dim_company_alias` and `company_relationship` with evidence
   and effective dates. A name change preserves identity; a merger links distinct
   identities. Foreign parent identifiers stay in their own register namespaces.
3. Implement conservative identity resolution: exact verified register identity;
   time-valid name/brand candidates; conflict/ambiguity hold with candidate IDs,
   match method and evidence. Avoid fuzzy auto-acceptance and group-based case merging.
4. Implement complete-population filters/ranking, draft `cohort_definition` and
   `compliance_cohort`, then validate exactly 50 verified unique eligible entities.
   Freeze the original selection and hash transactionally. Persist exclusions and
   counts, including the size-class boundary/tie-break limitation.
5. Add separate exploratory search over registry candidates. It must return match
   reasons/ambiguity and optional cohort membership without modifying the frozen
   sample or its denominator. A CLI/library interface is sufficient; no frontend.
6. Export the approved cohort and methodology into a reviewable local artifact
   directory. Do not publish to R2 merely because an export succeeds. Propose dbt
   silver/gold integration only for reviewed, reusable public registry fields; inspect
   the whole-database backup path before persisting private tables.

## Deliverable files and columns

Produce a reproducible CLI invocation documented next to the code, a cohort CSV and
JSON, `methodology.json`, `population-manifest.json` and an exclusions/ambiguities
report. These are specified outputs for Phase 1, not files produced in Phase 0.

Every selected row must carry `cohort_id`, `as_of_date`, `selection_rank`, `company_id`,
`organization_number`, `registered_legal_name`, `country_code`, `registry_authority`,
`registry_number`, `primary_sni_code`, `sni_version`, `employee_size_class`,
`size_class_order`, `identity_status`, `source_url`, `document_hash` and
`last_verified_at`. Relationships/aliases belong in separate exports with their
own evidence and dates. Never flatten foreign parents into Swedish cohort members.

Methodology must include snapshot time versus effective source dates, exact filters,
source/terms references and hashes, classification/class ordering versions, full
eligible population count, exclusions by reason, boundary-class population, tie-break,
code SHA, schema version and canonical membership hash. Preserve original sample
attributes even when a later name or ownership annotation changes.

## Acceptance checks

- Rebuild from the same archived snapshot and code yields the same ordered 50
  organization numbers and membership hash, regardless of input order or duplicate
  observations. Fail on fewer than 50 verified eligible identities or incomplete pages.
- Test formatted numbers, invalid checksums, natural-person identifiers, duplicate
  IDs, conflicting legal names and the same brand used by different operators.
- Test a renamed entity before/after the effective date, a Swedish subsidiary with
  a foreign parent, multiple qualifying subsidiaries, an excluded holding parent,
  a registered branch and a merger with preserved predecessor identity.
- Ambiguous or contradictory matches stay unresolved with a candidate set; no
  parent/sibling receives another entity's identity or case association by default.
- Frozen membership rejects replacement/mutation. Exploratory queries cannot alter
  it; current identity annotations do not rewrite the original selection export.
- All selected identities/attributes have source evidence, true snapshot dates and
  review status. No synthetic company rows enter exports.
- Run focused pytest checks and the required repository checks. Record existing
  failures separately; do not edit unrelated frontend/workflow work to hide failures.

Phase 1 completion hands off a verified frozen cohort and identity graph. Enforcement
source pilots, legal-case linkage, review tooling and publication remain later work.
