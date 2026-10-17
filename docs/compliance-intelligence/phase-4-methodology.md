# Compliance analytics methodology

Version 1, checked 2026-10-17. These metrics describe reviewed public evidence for
a fixed sample of Swedish IT legal entities. They measure the approved records
represented in a release. They do not estimate all violations, a company's ethics
or its probability of receiving a future sanction.

At the implementation baseline on 2026-10-17, no actual 50-company cohort or
human-approved legal outcomes were available in this workspace and no real company
benchmark had been produced. Later releases declare their own approval and coverage
metadata. Synthetic regression fixtures must be distinguished from measured results.

## Population and dates

The population and selection rule are fixed by [Phase 1](phase-1.md). Eligible
active Swedish limited companies must have a primary SNI 2025 code in 58290,
62100, 62201, 62202, 62900 or 63100. Selection takes 50 companies by descending
employee size class, then organization number within a class. This orders size
classes; it does not establish the largest 50 companies by exact employment.
Only a complete, source-reviewed register population can produce the frozen sample.

Every analytical bundle includes the cohort ID, snapshot date, membership hash,
selection order, eligible codes and selection limitations. Filtering never changes
the original membership. Industry and employee-class filters select a subset of
that membership. No replacement companies are drawn.

The default window starts 2018-05-25 and ends at the register snapshot date.
Explicit windows can differ. Dates are inclusive and select the originating
approved decision's decision date. Publication dates remain separate and do not
substitute for decision dates. `--year` intersects an explicit date window.
Follow-up decisions remain attached even when dated outside the window. Current
status means status known in the approved Gold snapshot, not status reconstructed
at the window end. `status_snapshot_at` records that distinction. Historical
point-in-time legal status is not inferred from a later release.

Authority and case-category filters apply to the originating decision. Native
court issuers, docket IDs and dates remain visible in decision facts and coverage.
Status filters use the latest supported sanction act in the approved linked chain.
Changing a filter produces another versioned bundle with its own context.

## Unit of observation and approval

All decision facts come from Phase 3 Gold records, validated again against the
current private review store. An exact reviewed legal entity and direct attribution
are required. Expired, withdrawn or stale approvals prevent reuse of an old release.
Original documents and private candidates supply validation evidence; they never
add unapproved company findings to these metrics.

An authority/docket identifies a native case. Multiple separate orders within that
case remain distinct acts. Explicit approved appeal, upholding, modification,
annulment, remittal and supersession links identify one sanction lineage across
authorities and courts. A related-case link alone does not merge sanctions.
Ambiguous multi-origin appeals, branching obligations, cycles and cross-company
liability links stop the build. A later document date alone cannot resolve them.

The case fact has one row per legal entity and originating native case ID. The
decision fact has one row per approved decision record ID, retaining native and
originating IDs. Confirmation flags occur only on the originating row of each
sanction lineage. Two separate orders on a docket can therefore produce one case,
two sanctions and several documents without counting an appeal as a new sanction.

## Metric definitions

| Metric | Definition within the selected approved evidence |
| --- | --- |
| Confirmed administrative sanctions | One per explicit sanction lineage whose operative approved act is an administrative sanction against the direct sanctioned party, with current status decided, appealed or final. Alleged, investigation, unknown, unresolved modified and annulled states are excluded. |
| Total final monetary sanctions | Sum of approved operative administrative fine amounts with explicit finality, separately for each native currency. A modified order needs a separately approved replacement act and amount. An annulled or unresolved modified order contributes no final amount. |
| GDPR sanctions | Confirmed administrative sanction lineages categorized as data protection with an explicit GDPR, dataskyddsförordningen or 2016/679 legal basis. |
| Competition law sanctions | Confirmed administrative sanction lineages categorized as competition with an explicit konkurrenslagen or 2008:579 legal basis. |
| Cases under appeal | Distinct originating native cases with current appealed status or a supported pending/filed appeal that has not been resolved by a substantive follow-up. |
| Modified / annulled decisions | Separate counts of approved decision records with the respective current known status. These counts describe records and must not be added to sanction counts. |
| Reviewed source documents | Distinct original document hashes represented by selected approved decisions and their approved status dependencies. Multiple decision slots or URLs for identical bytes count once per summary. |
| Criminal convictions | Currently null with an explicit unmeasured status; see legal scope below. |

Original amounts remain in `fact_compliance_amounts` with `amount_kind=original`
for traceability. Only `final_effective` rows contribute to final totals. Adding
both kinds would double-count the same obligation. SEK and EUR remain separate;
`conversion_method=none_native_currency`. There is no exchange rate, inferred
conversion or total combining currencies. Other currencies and remedy types are
held until their upstream evidence contract is supported.

An issued administrative fine may be under appeal. Its count and its non-final
amount must be read separately. Original findings are preserved when a decision is
subsequently modified or annulled; the original amount does not silently become a
current final liability. IMY explains that GDPR sanction amounts depend on factors
including turnover and the circumstances of the infringement. [IMY supervision outcomes](https://www.imy.se/om-oss/vart-uppdrag/sa-arbetar-vi-med-tillsyn/vad-kan-tillsynen-leda-till)

KKV's decision-making powers and the decision forum changed in March 2021. A
historical dataset must retain the actual issuer and court history; it must not
relabel older court decisions as newly issued KKV sanctions. Its fine calculation
also depends on case-specific circumstances and turnover. [KKV competition fines](https://www.konkurrensverket.se/konkurrens/tillsyn-arenden-och-beslut/sanktioner/konkurrensskadeavgift/)

## Criminal-law scope

A Swedish företagsbot must not be relabeled as a criminal conviction of the legal
entity. Corporate fines and a natural person's criminal responsibility require
separate legal treatment. [Swedish Prosecution Authority glossary](https://www.aklagare.se/ordlista/),
[current Swedish Criminal Code](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/brottsbalk-1962700_sfs-1962-700/)

The current Gold contract supports Swedish administrative/court sources without
a reviewed jurisdiction-specific legal-person conviction scope. Consequently
`criminal_convictions` is null and
`criminal_metric_status=not_measured_separate_legal_entity_criminal_scope_required`.
An incoming criminal conviction/acquittal record is held for a separate scope
contract. A future legally appropriate conviction metric requires
an explicit upstream jurisdiction, legal-person defendant, outcome and finality
contract, its source adapter and human legal/publication approval. A foreign parent,
brand, director's conviction or reference to a corporate fine cannot supply that
missing contract. This metric is unavailable, not zero.

## Entity and corporate-group views

The default view describes individual legal entities by canonical ID. Corporate
groups aggregate only the selected cohort members linked through reviewed
`subsidiary_of` relationships valid at the declared `group_as_of` date. The date
must not exceed the identity snapshot. Unknown start dates and cyclic structures
stop grouping. Merger history, brands, branches and similar names do not imply
group membership.

A foreign parent may label a group if its identity and relationship are documented.
The parent receives no attributed sanction in the facts. Companies outside the
frozen cohort contribute neither sanctions nor employees. Group figures are
therefore cohort-member aggregates, not complete consolidated group exposure.
Industry/size filters apply to members before grouping, and the output lists their
IDs and count. Legal facts retain the original defendant regardless of view.

## Size and financial metadata

Use the register's dated employee size classes as intervals. SCB distinguishes
legal units from workplaces and publishes employment in classes for the register;
an interval must not be presented as an exact headcount. [SCB variable descriptions](https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/variabelbeskrivning/)

For count N and employee bounds L and U, exploratory sanctions per 1,000 employees
have bounds `1,000*N/U` and `1,000*N/L`. Final monetary amounts use the same formula
separately per currency. With L=0, both bounds are null. An open upper employee
class yields a null lower rate bound; the finite upper rate bound is retained.
No midpoint or invented precise employment is used. Group denominators sum only
selected member bounds and do not assume consolidated employment is known.

These intervals are arithmetic bounds for the snapshot, not statistical confidence
intervals. Current company size may differ from employment during the decision
period. Employees are not the number of affected people, processing activities,
transactions, relevant market sales or legal obligations. Enforcement selection,
publication practices, industry and case severity differ. The ratios cannot be
read as violations per employee, causal effects or comparative compliance quality.

No verified revenue or financial statements are available through the current
registry contract. This phase adds no revenue-adjusted metric. Adding financial
normalization requires approved, sourced, dated entity-level values, native
currency, accounting-period and consolidation scope; group revenue must not be
paired silently with one subsidiary's fine.

## Missingness, coverage and comparisons

Companies with no selected approved decision have `metric_status=not_assessed`,
null sanction/appeal/outcome metrics and no ranking row. Their represented document
and decision counts are zero. A company with approved evidence can have zero
confirmed sanctions within that evidence, for example after an annulment. Neither
case establishes an absence of violations. An empty final-amount map means no
qualifying amount in the approved records, not an established zero financial risk.

Coverage has one cell per authority/year/period role. IMY and KKV receive explicit
cells for every requested year, including empty years. Courts and follow-up years
appear when represented. Follow-ups outside the requested window have
`period_role=subsequent_context`, including follow-ups in the same calendar year.
Document counts are distinct within each cell; a document covering several
companies or periods is not additive across summaries/cells.

Field completeness counts known values among these nine fields for approved
decision rows: record hash, authority, company ID, decision date, publication date,
legal basis, case category, original outcome and finality. Null, unknown and empty
legal-basis lists are missing. With no rows the fraction is null. This measures
field availability in approved rows only. Status-reference documents without an
independently published decision row contribute to document counts, not field counts.

The number of all relevant authority publications and the number of completed
company/source searches are not established by the current pilot. Population and
search-coverage denominators and fractions remain null. An empty year is not a
completed negative search. Operational collection status comes from the Phase 3
coverage report and remains separate from approved-record field completeness.

`mart_compliance_rankings` supplies separate descending dense ranks for observed
administrative, GDPR and competition counts and final amounts per currency.
KKV and combined-source rankings are currently disabled because reliable KKV
collection is unavailable. The ranking mart is populated only for an explicitly
IMY-scoped analysis with no competition category. The explorer requires that same
authority filter before enabling metric sorting or ranks. Individual approved
evidence remains inspectable. An IMY-only observation does not turn missing
competition coverage into zero competition sanctions.
It records the comparison count and its observation-only basis. Fewer than two
assessed entities gives a null rank; unassessed entities are excluded. These are
transparent orderings of the selected evidence. There is no combined score,
severity weighting, criminality scale, ethics scale, population percentile or
ranking based on the employee intervals. Unequal and unknown coverage limits
comparisons even where an ordinal value can be computed.

Consumers must present the cohort definition, date/status snapshot, filters,
coverage limitations and warnings alongside any result. The CLI returns this
context with query results. A future public page must display these conditions
before comparative values and link to this methodology.
