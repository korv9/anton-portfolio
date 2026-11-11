-- Private domain contracts. Never execute against the publicly backed-up warehouse.
create schema compliance_intelligence;

create type compliance_intelligence.review_state as enum
    ('unreviewed', 'in_review', 'approved', 'rejected', 'withdrawn');

create table compliance_intelligence.source_document (
    document_id varchar primary key,
    source_id varchar not null,
    source_url varchar not null check (regexp_matches(source_url, '^https://')),
    publisher varchar not null,
    publication_date date,
    fetched_at timestamptz not null,
    document_hash varchar not null check (regexp_full_match(document_hash, '[a-f0-9]{64}')),
    content_type varchar not null,
    byte_count bigint not null check (byte_count > 0),
    storage_ref varchar,
    access_status varchar not null default 'unknown'
        check (access_status in ('public', 'request_required', 'restricted', 'unknown')),
    reuse_status varchar not null default 'unverified'
        check (reuse_status in ('unverified', 'permitted', 'restricted')),
    terms_url varchar,
    privacy_status varchar not null default 'unreviewed'
        check (privacy_status in ('unreviewed', 'cleared', 'redaction_required', 'blocked')),
    last_verified_at timestamptz not null
);

create table compliance_intelligence.dim_company (
    company_id varchar primary key,
    organization_number varchar unique
        check (regexp_full_match(organization_number, '[0-9]{10}')),
    registered_legal_name varchar not null check (length(trim(registered_legal_name)) > 0),
    country_code varchar not null check (regexp_full_match(country_code, '[A-Z]{2}')),
    registry_authority varchar not null,
    registry_number varchar not null,
    legal_form varchar not null,
    entity_kind varchar not null default 'legal_entity'
        check (entity_kind in ('legal_entity', 'registered_branch')),
    identity_status varchar not null default 'unverified'
        check (identity_status in ('unverified', 'verified', 'ambiguous')),
    source_document_id varchar not null references compliance_intelligence.source_document(document_id),
    last_verified_at timestamptz not null,
    unique (country_code, registry_authority, registry_number),
    check ((country_code = 'SE' and organization_number is not null
            and registry_number = organization_number)
        or (country_code <> 'SE' and organization_number is null))
);

create table compliance_intelligence.dim_company_alias (
    alias_id varchar primary key,
    company_id varchar not null references compliance_intelligence.dim_company(company_id),
    alias varchar not null check (length(trim(alias)) > 0),
    alias_type varchar not null
        check (alias_type in ('brand', 'trading_name', 'historic_legal_name')),
    valid_from date,
    valid_to date,
    source_document_id varchar not null references compliance_intelligence.source_document(document_id),
    review_status compliance_intelligence.review_state not null default 'unreviewed',
    last_verified_at timestamptz not null,
    check (valid_to is null or valid_from is null or valid_to > valid_from)
);

create table compliance_intelligence.company_relationship (
    relationship_id varchar primary key,
    company_id varchar not null references compliance_intelligence.dim_company(company_id),
    related_company_id varchar not null references compliance_intelligence.dim_company(company_id),
    relationship_type varchar not null
        check (relationship_type in ('subsidiary_of', 'merged_into', 'branch_of')),
    valid_from date,
    valid_to date,
    source_document_id varchar not null references compliance_intelligence.source_document(document_id),
    review_status compliance_intelligence.review_state not null default 'unreviewed',
    last_verified_at timestamptz not null,
    check (company_id <> related_company_id),
    check (valid_to is null or valid_from is null or valid_to > valid_from)
);

create table compliance_intelligence.cohort_definition (
    cohort_id varchar primary key,
    as_of_date date not null,
    target_size integer not null check (target_size = 50),
    methodology_version varchar not null,
    methodology_json json not null,
    population_document_id varchar not null references compliance_intelligence.source_document(document_id),
    population_manifest_hash varchar not null check (regexp_full_match(population_manifest_hash, '[a-f0-9]{64}')),
    selection_code_sha varchar not null check (regexp_full_match(selection_code_sha, '[a-f0-9]{40,64}')),
    frozen_at timestamptz,
    membership_hash varchar check (regexp_full_match(membership_hash, '[a-f0-9]{64}')),
    check ((frozen_at is null and membership_hash is null)
        or (frozen_at is not null and membership_hash is not null))
);

create table compliance_intelligence.compliance_cohort (
    cohort_id varchar not null references compliance_intelligence.cohort_definition(cohort_id),
    company_id varchar not null references compliance_intelligence.dim_company(company_id),
    selection_rank integer not null check (selection_rank between 1 and 50),
    primary_sni_code varchar not null check (regexp_full_match(primary_sni_code, '[0-9]{5}')),
    sni_version varchar not null check (sni_version in ('2007', '2025')),
    employee_size_class varchar not null,
    size_class_order integer not null check (size_class_order >= 0),
    selection_document_id varchar not null references compliance_intelligence.source_document(document_id),
    primary key (cohort_id, company_id),
    unique (cohort_id, selection_rank)
);

create table compliance_intelligence.legal_case (
    case_id varchar primary key,
    authority varchar not null,
    authority_case_number varchar not null,
    jurisdiction_country varchar not null check (regexp_full_match(jurisdiction_country, '[A-Z]{2}')),
    case_type varchar not null check (case_type in
        ('data_protection', 'competition', 'procurement', 'financial_regulation', 'civil', 'criminal', 'other')),
    lifecycle_status varchar not null default 'unknown'
        check (lifecycle_status in ('unknown', 'open', 'closed', 'remanded')),
    source_document_id varchar not null references compliance_intelligence.source_document(document_id),
    last_verified_at timestamptz not null,
    unique (authority, authority_case_number)
);

create table compliance_intelligence.legal_decision (
    decision_id varchar primary key,
    case_id varchar not null references compliance_intelligence.legal_case(case_id),
    decision_kind varchar not null check (decision_kind in
        ('administrative', 'administrative_judgment', 'civil_judgment', 'criminal_judgment', 'procedural')),
    outcome_type varchar not null check (outcome_type in
        ('regulatory_finding', 'administrative_sanction', 'criminal_conviction',
         'acquittal', 'dismissal', 'no_finding', 'other')),
    decision_date date,
    publication_date date,
    legal_basis varchar[],
    decision_status varchar not null default 'unknown'
        check (decision_status in ('unknown', 'issued', 'corrected', 'varied', 'overturned', 'withdrawn')),
    appeal_status varchar not null default 'unknown'
        check (appeal_status in ('unknown', 'not_appealed_verified', 'appealed', 'pending',
                               'decided', 'withdrawn', 'not_appealable')),
    finality_status varchar not null default 'unknown'
        check (finality_status in ('unknown', 'not_final', 'final')),
    stay_status varchar not null default 'unknown'
        check (stay_status in ('unknown', 'not_stayed', 'stayed')),
    sanction_type varchar not null default 'unknown' check (sanction_type in
        ('unknown', 'none', 'administrative_fine', 'corporate_fine', 'coercive_fine', 'damages', 'costs')),
    sanction_amount decimal(20, 2) check (sanction_amount >= 0),
    currency varchar check (regexp_full_match(currency, '[A-Z]{3}')),
    source_document_id varchar not null references compliance_intelligence.source_document(document_id),
    review_status compliance_intelligence.review_state not null default 'unreviewed',
    last_verified_at timestamptz not null,
    unique (case_id, decision_id),
    check ((sanction_amount is null and currency is null)
        or (sanction_amount is not null and currency is not null)),
    check (sanction_type <> 'none' or sanction_amount is null),
    check (outcome_type not in ('criminal_conviction', 'acquittal') or decision_kind = 'criminal_judgment'),
    check (outcome_type <> 'administrative_sanction' or decision_kind in ('administrative', 'administrative_judgment')),
    check (finality_status <> 'final' or appeal_status in ('not_appealed_verified', 'decided', 'not_appealable'))
);

create table compliance_intelligence.case_event (
    event_id varchar primary key,
    case_id varchar not null references compliance_intelligence.legal_case(case_id),
    decision_id varchar,
    event_type varchar not null check (event_type in
        ('allegation', 'investigation', 'regulatory_finding', 'administrative_sanction',
         'judgment', 'final_judgment', 'criminal_conviction', 'acquittal', 'appeal_filed',
         'appeal_decided', 'remittal', 'closure_without_finding', 'correction')),
    event_date date,
    recorded_at timestamptz not null,
    source_document_id varchar not null references compliance_intelligence.source_document(document_id),
    review_status compliance_intelligence.review_state not null default 'unreviewed',
    foreign key (case_id, decision_id) references compliance_intelligence.legal_decision(case_id, decision_id),
    check (event_type not in ('regulatory_finding', 'administrative_sanction', 'judgment',
                             'final_judgment', 'criminal_conviction', 'acquittal') or decision_id is not null)
);

create table compliance_intelligence.decision_company (
    decision_id varchar not null references compliance_intelligence.legal_decision(decision_id),
    company_id varchar not null references compliance_intelligence.dim_company(company_id),
    party_role varchar not null check (party_role in
        ('sanctioned_party', 'regulated_entity', 'claimant', 'respondent', 'issuer', 'contextual_mention')),
    attribution_scope varchar not null default 'context_only'
        check (attribution_scope in ('direct_legal_entity', 'documented_joint_liability', 'context_only')),
    identity_status varchar not null default 'unverified'
        check (identity_status in ('unverified', 'verified', 'ambiguous')),
    source_document_id varchar not null references compliance_intelligence.source_document(document_id),
    review_status compliance_intelligence.review_state not null default 'unreviewed',
    primary key (decision_id, company_id, party_role),
    check (party_role <> 'sanctioned_party' or
        (attribution_scope <> 'context_only' and identity_status = 'verified'))
);

create table compliance_intelligence.source_evidence (
    evidence_id varchar primary key,
    target_table varchar not null,
    target_id varchar not null,
    record_hash varchar not null check (regexp_full_match(record_hash, '[a-f0-9]{64}')),
    field_name varchar not null,
    document_id varchar not null references compliance_intelligence.source_document(document_id),
    locator varchar not null check (length(trim(locator)) > 0),
    extraction_method varchar not null check (extraction_method in ('manual', 'structured', 'text', 'ocr')),
    extractor_version varchar not null,
    observed_at timestamptz not null
);

create table compliance_intelligence.record_review (
    review_id varchar primary key,
    target_table varchar not null,
    target_id varchar not null,
    record_hash varchar not null check (regexp_full_match(record_hash, '[a-f0-9]{64}')),
    review_kind varchar not null check (review_kind in ('identity', 'legal', 'privacy', 'publication')),
    review_status compliance_intelligence.review_state not null default 'unreviewed',
    reviewer_id varchar,
    reviewed_at timestamptz,
    rationale varchar not null,
    check (review_status not in ('approved', 'rejected', 'withdrawn') or
        (reviewer_id is not null and length(trim(reviewer_id)) > 0 and reviewed_at is not null))
);

create table compliance_intelligence.coverage_observation (
    coverage_id varchar primary key,
    company_id varchar not null references compliance_intelligence.dim_company(company_id),
    source_id varchar not null,
    window_start date not null,
    window_end date not null,
    searched_at timestamptz,
    search_status varchar not null default 'not_started' check (search_status in
        ('not_started', 'complete', 'partial', 'failed', 'not_applicable', 'restricted')),
    query_manifest json,
    candidate_count integer check (candidate_count >= 0),
    limitations varchar not null,
    check (window_end >= window_start),
    check (search_status <> 'complete' or (searched_at is not null and query_manifest is not null)),
    check (search_status <> 'not_started' or (searched_at is null and candidate_count is null))
);
