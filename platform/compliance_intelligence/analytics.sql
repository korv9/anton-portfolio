-- Private analytical release. No migration into the publicly backed-up warehouse.
create schema gold;
create table gold.fact_compliance_cases (
    company_id varchar, case_family_id varchar, origin_authority varchar,
    origin_case_number varchar, first_decision_date date, decision_count integer,
    primary key(company_id,case_family_id)
);
create table gold.fact_compliance_decisions (
    decision_id varchar primary key, record_hash varchar, company_id varchar,
    native_case_id varchar, case_family_id varchar, origin_decision_id varchar,
    authority varchar, origin_authority varchar, case_category varchar,
    original_outcome varchar, legal_status varchar, finality_status varchar,
    decision_date date, publication_date date, legal_basis json, origin_decision_date date, is_origin boolean,
    confirmed_administrative_sanction boolean, gdpr_sanction boolean,
    competition_sanction boolean, source_url varchar, document_hash varchar
);
create table gold.fact_compliance_amounts (
    amount_id varchar primary key, decision_id varchar, origin_decision_id varchar,
    company_id varchar, case_family_id varchar, currency varchar not null,
    amount decimal(20,2) not null check(amount >= 0), amount_kind varchar not null
        check(amount_kind in ('original','final_effective')),
    origin_decision_date date, origin_authority varchar, case_category varchar,
    conversion_method varchar not null check(conversion_method='none_native_currency'),
    source_url varchar, document_hash varchar
);
create table gold.mart_compliance_company_summary (
    entity_id varchar primary key, entity_label varchar, entity_scope varchar,
    cohort_id varchar, cohort_member_ids json, member_count integer,
    primary_sni_codes json, employee_size_classes json,
    employees_lower_bound bigint, employees_upper_bound bigint,
    observed_approved_decisions integer, observed_case_families integer,
    confirmed_administrative_sanctions integer, gdpr_sanctions integer,
    competition_law_sanctions integer, criminal_convictions integer,
    criminal_metric_status varchar, cases_under_appeal integer,
    modified_decisions integer, annulled_decisions integer,
    reviewed_source_documents integer, final_monetary_sanctions_by_currency json,
    sanctions_per_1000_employees_lower varchar, sanctions_per_1000_employees_upper varchar,
    final_amounts_per_1000_employees_by_currency json,
    metric_status varchar, coverage_fraction double,
    period_start date, period_end date, group_as_of_date date
);
create table gold.mart_compliance_rankings (
    entity_id varchar, entity_scope varchar, metric varchar, currency varchar,
    observed_value varchar, observed_dense_rank integer, comparison_count integer,
    ranking_basis varchar, coverage_fraction double
);
create table gold.mart_compliance_source_coverage (
    authority varchar, period_start date, period_end date, period_role varchar,
    approved_decision_records integer, reviewed_source_documents integer,
    known_assertion_fields integer, assessed_assertion_fields integer,
    approved_record_field_completeness double,
    source_population_documents integer, source_population_coverage_fraction double,
    search_execution_coverage_fraction double, coverage_status varchar,
    primary key(authority,period_start,period_end,period_role)
);
