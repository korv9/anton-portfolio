-- Extended inside the existing canonical registry database; no second identity scheme.
create table compliance_intelligence.job_observation (
    job_id varchar primary key, publication_date timestamp not null, payload_hash varchar not null
);
create table compliance_intelligence.company_registry_observation (
    company_id varchar primary key references compliance_intelligence.dim_company(company_id),
    snapshot_date date not null, employee_size_class varchar, primary_sni_code varchar,
    source_url varchar not null, document_hash varchar not null
);
create table compliance_intelligence.company_context_fact (
    company_id varchar references compliance_intelligence.dim_company(company_id), kind varchar not null,
    period varchar not null, label varchar not null, value varchar not null, unit varchar,
    issuer_id varchar, country_code varchar, source_url varchar not null,
    document_hash varchar not null, verified_at timestamptz not null
);
create table compliance_intelligence.job_company_link (
    job_id varchar not null,
    company_id varchar references compliance_intelligence.dim_company(company_id),
    relationship_type varchar not null check(relationship_type in ('advertised_employer','recruiter','actual_employer')),
    match_method varchar not null,
    match_status varchar not null check(match_status in ('verified','ambiguous','unresolved','review_required','rejected')),
    match_confidence double not null check(match_confidence between 0 and 1),
    verified_at timestamptz,
    original_employer_name varchar, original_organization_number varchar, workplace_name varchar,
    job_payload_hash varchar not null, registry_hash varchar not null,
    match_evidence json not null,
    primary key(job_id,relationship_type),
    check((match_status='verified' and company_id is not null and verified_at is not null)
        or (match_status<>'verified' and company_id is null and verified_at is null))
);
create table compliance_intelligence.company_resolution_review (
    review_id varchar primary key, job_id varchar not null, relationship_type varchar not null,
    company_id varchar references compliance_intelligence.dim_company(company_id),
    job_payload_hash varchar not null, registry_hash varchar not null,
    disposition varchar not null check(disposition in ('approved','rejected')),
    reviewer_id varchar not null, reviewed_at timestamptz not null,
    evidence_url varchar not null, document_hash varchar not null, source_locator varchar not null,
    rationale varchar not null
);
create view compliance_intelligence.mart_company_hiring_daily as
select l.company_id, l.relationship_type, j.publication_date::date as day,
    count(distinct l.job_id) as observed_advertisements,
    max(l.verified_at) as identity_verified_at
from compliance_intelligence.job_company_link l
join compliance_intelligence.job_observation j using(job_id)
where l.match_status='verified'
group by l.company_id,l.relationship_type,j.publication_date::date;
create view compliance_intelligence.mart_company_hiring_context as
select h.*, r.employee_size_class, r.primary_sni_code, r.snapshot_date as register_as_of,
    f.period as financial_period, f.label as financial_measure, f.value as financial_value,
    f.unit as financial_unit, f.source_url as financial_source
from compliance_intelligence.mart_company_hiring_daily h
left join compliance_intelligence.company_registry_observation r using(company_id)
left join compliance_intelligence.company_context_fact f on f.company_id=h.company_id and f.kind='financial';
