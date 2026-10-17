"""Reproducible metrics from live-validated approved Gold and a frozen cohort only."""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from compliance_intelligence.cohort import verify_cohort  # noqa: E402
from compliance_intelligence.legal_extraction import AUTHORITY_PATTERNS, STATUSES, VALUE_SCHEMAS, document_pages, validate_proposal  # noqa: E402
from compliance_intelligence.legal_review import ReviewStore  # noqa: E402
from compliance_intelligence.registry import POLICY, encoded, validate_identity_evidence  # noqa: E402
from compliance_intelligence.review_cli import evidence_body  # noqa: E402
from compliance_intelligence.sources import load_snapshot, new_output, now, seal, verify, write_json  # noqa: E402
from lib.rawstore import sha256  # noqa: E402

TABLES = ('fact_compliance_cases', 'fact_compliance_decisions', 'fact_compliance_amounts',
          'mart_compliance_company_summary', 'mart_compliance_rankings', 'mart_compliance_source_coverage')
CHAIN_RELATIONS = {'appeal_of', 'upholds', 'modifies', 'annuls', 'remands', 'supersedes'}
BASE_AUTHORITIES = ('Integritetsskyddsmyndigheten', 'Konkurrensverket')
WARNINGS = [
    'Counts describe approved records found in selected public sources, not all violations.',
    'No identified record is not proof of no violations; unassessed companies have null metrics.',
    'Administrative sanctions and criminal convictions are separate categories.',
    'Amounts remain in native currencies; there is no combined-currency total.',
    'Ranks compare observed approved metrics only, not criminality, ethics or underlying risk.',
    'Employee class intervals are not exact headcounts or exposure-adjusted violation rates.',
    'Corporate groups aggregate only selected cohort members; no liability is transferred.',
]


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def employee_bounds(code):
    label = POLICY['employee_size_classes'][code]
    if label.endswith('+'):
        return int(label[:-1]), None
    parts = label.split('-')
    return int(parts[0]), int(parts[-1])


def decimal_text(number):
    return format(number.quantize(Decimal('0.000001')), 'f')


def interval_rate(numerator, lower, upper):
    if lower is None or lower <= 0:
        return {'lower': None, 'upper': None}
    return {'lower': decimal_text(Decimal(numerator) * 1000 / upper) if upper else None,
            'upper': decimal_text(Decimal(numerator) * 1000 / lower)}


def legal_group(company_id, snapshot, when):
    if any(r['company_id'] == company_id and r['relationship_type'] == 'subsidiary_of' and not r.get('valid_from')
           for r in snapshot['relationships']):
        raise ValueError('group_relationship_start_date_unknown')
    edges = {r['company_id']: r['related_company_id'] for r in snapshot['relationships']
             if r['relationship_type'] == 'subsidiary_of'
             and r.get('valid_from') and r['valid_from'] <= when
             and (not r.get('valid_to') or when < r['valid_to'])}
    visited = set()
    while company_id in edges:
        if company_id in visited:
            raise ValueError('corporate_group_cycle')
        visited.add(company_id)
        company_id = edges[company_id]
        if any(r['company_id'] == company_id and r['relationship_type'] == 'subsidiary_of' and not r.get('valid_from')
               for r in snapshot['relationships']):
            raise ValueError('group_relationship_start_date_unknown')
    return company_id


def roots_for(rows):
    by_id = {r['record_id']: r for r in rows}
    if len(by_id) != len(rows):
        raise ValueError('duplicate_approved_decision_id')
    parent, relation = {}, {}
    for row in rows:
        for child in row['subsequent_decisions']:
            if child['relation'] not in CHAIN_RELATIONS:
                continue
            cid = child['record_id']
            if cid in parent and parent[cid] != row['record_id']:
                raise ValueError('multi_origin_appeal_requires_scoped_review')
            parent[cid], relation[cid] = row['record_id'], child['relation']
    roots = {}
    for decision_id in by_id:
        node, seen = decision_id, set()
        while node in parent:
            if node in seen:
                raise ValueError('decision_lineage_cycle')
            seen.add(node)
            node = parent[node]
        roots[decision_id] = node
        if node not in by_id or by_id[node]['company_id'] != by_id[decision_id]['company_id']:
            raise ValueError('lineage_cannot_transfer_company_liability')
        if decision_id in parent and relations_money_conflict(by_id, decision_id, parent[decision_id], relation[decision_id]):
            raise ValueError('upholding_cannot_change_monetary_sanction')
    return by_id, roots, parent, relation


def relations_money_conflict(by_id, child, parent, relation):
    if relation != 'upholds' or parent not in by_id:
        return False
    a, b = by_id[child]['original_monetary_sanction'], by_id[parent]['original_monetary_sanction']
    return bool(a and b and a != b)


def reconciled_sources(store, rows, *, refresh=False):
    """Validate the already-approved assertions against exact original publication bytes."""
    clients, checked, results = {}, set(), []
    try:
        for row in rows:
            hashes = [row['record_hash']]
            for link in row['subsequent_decisions']:
                head = store.execute('select record_hash from review.current_record where record_id=?', [link['record_id']]).fetchone()
                if not head:
                    raise ValueError('missing_reviewed_status_evidence')
                hashes.append(head[0])
            for digest in hashes:
                if digest in checked:
                    continue
                rec = store.record(digest)
                doc = store.document(rec['document_id'])
                body = evidence_body(store, doc, refresh=refresh, clients=clients)
                validate_proposal(rec['payload']['proposal'], document_pages(body, doc['content_type']))
                checked.add(digest)
                results.append({'record_hash': digest, 'document_hash': doc['document_hash'],
                    'source_url': doc['source_url'], 'status': 'original_bytes_and_claim_excerpts_verified'})
        return results
    finally:
        for client in clients.values():
            client.close()


def input_data(store, release, cohort):
    store.validate_release(release)
    cohort_info = verify_cohort(cohort)
    snapshot = load_snapshot(cohort)
    validate_identity_evidence(snapshot)
    members = read_json(Path(cohort) / 'cohort.json')
    rows = read_json(Path(release) / 'decisions.json')
    identities = {r['company_id']: r for r in snapshot['companies']}
    for row in rows:
        if row['review_status'] != 'approved' or row['attribution_scope'] != 'direct_legal_entity':
            raise ValueError('approved_direct_gold_required')
        company = identities.get(row['company_id'])
        if company and row['organization_number'] and company['organization_number'] != row['organization_number']:
            raise ValueError('cohort_gold_identity_conflict')
        if row['original_outcome'] in ('criminal_conviction', 'acquittal'):
            # Current Gold supports Swedish fora only and has no cleared foreign criminal scope.
            raise ValueError('criminal_legal_entity_scope_requires_separate_approved_gold_contract')
    return rows, snapshot, members, cohort_info


def select_members(members, filters):
    return [m for m in members if (not filters.get('industry') or m['primary_sni_code'] in filters['industry'])
            and (not filters.get('size_class') or m['employee_size_class'] in filters['size_class'])]


def analysis_rows(rows, members, snapshot, filters):
    """Internal transform; the CLI invokes this only after input and source verification."""
    rows = sorted(rows, key=lambda r: r['record_id'])
    start, end = filters['date_from'], filters['date_to']
    when, scope = filters['group_as_of'], filters['scope']
    selected = select_members(members, filters)
    company_ids = {m['company_id'] for m in selected}
    by_id, roots, parent, relations = roots_for(rows)
    families = defaultdict(list)
    for row in rows:
        families[roots[row['record_id']]].append(row)
    chosen = {}
    for root_id, acts in families.items():
        root = by_id[root_id]
        if root['company_id'] not in company_ids or not start <= root['decision_date'] <= end:
            continue
        if filters.get('authority') and root['authority'] not in filters['authority']:
            continue
        if filters.get('category') and root['case_type'] not in filters['category']:
            continue
        # Select the final approved sanction act in the explicit lineage, never by timestamp alone.
        sanctions = [r for r in acts if r['original_outcome'] == 'administrative_sanction' and r['party_role'] == 'sanctioned_party'
                     and r['original_status'] not in ('alleged','investigation')]
        leaves = []
        for candidate in sanctions:
            descendants = []
            for other in sanctions:
                node = other['record_id']
                while node in parent:
                    node = parent[node]
                    if node == candidate['record_id']:
                        descendants.append(other)
                        break
            if not descendants:
                leaves.append(candidate)
        if len(leaves) > 1:
            raise ValueError('branched_sanction_obligations_require_review')
        head = leaves[0] if leaves else root
        status = head['current_known_status']
        if filters.get('status') and status not in filters['status']:
            continue
        confirmed = bool(sanctions and status in ('decided', 'appealed', 'final'))
        chosen[root_id] = {'root': root, 'acts': acts, 'head': head, 'confirmed': confirmed,
            'appealed': status == 'appealed' or (not any(l['relation'] in ('upholds','annuls','modifies','supersedes','remands') for l in head['subsequent_decisions'])
                and head['appeal_information'] in ('filed','pending'))}
    cases, decisions, amounts, source_docs = {}, [], [], set()
    per_company = defaultdict(list)
    for root_id, family in sorted(chosen.items()):
        root, head, acts = family['root'], family['head'], family['acts']
        company_id, case_id = root['company_id'], root['case_id']
        per_company[company_id].append(family)
        key = (company_id, case_id)
        cases.setdefault(key, {'company_id': company_id, 'case_family_id': case_id,
            'origin_authority': root['authority'], 'origin_case_number': root['case_number'],
            'first_decision_date': root['decision_date'], 'decision_count': 0})
        cases[key]['first_decision_date'] = min(cases[key]['first_decision_date'], root['decision_date'])
        cases[key]['decision_count'] += len(acts)
        gdpr = root['case_type'] == 'data_protection' and any(re.search(r'GDPR|dataskyddsförordningen|2016/679', v, re.I) for v in root['legal_basis'])
        competition = root['case_type'] == 'competition' and any(re.search(r'konkurrenslagen|2008:579', v, re.I) for v in root['legal_basis'])
        family['gdpr'], family['competition'] = gdpr, competition
        for act in acts:
            is_origin = act['record_id'] == root_id
            decisions.append({'decision_id': act['record_id'], 'record_hash': act['record_hash'], 'company_id': company_id,
                'native_case_id': act['case_id'], 'case_family_id': case_id, 'origin_decision_id': root_id,
                'authority': act['authority'], 'origin_authority': root['authority'], 'case_category': root['case_type'],
                'original_outcome': act['original_outcome'], 'legal_status': act['current_known_status'],
                'finality_status': act['finality_status'], 'decision_date': act['decision_date'],
                'publication_date': act['publication_date'], 'legal_basis': act['legal_basis'],
                'origin_decision_date': root['decision_date'], 'is_origin': is_origin,
                'confirmed_administrative_sanction': is_origin and family['confirmed'],
                'gdpr_sanction': is_origin and family['confirmed'] and gdpr,
                'competition_sanction': is_origin and family['confirmed'] and competition,
                'source_url': act['source_url'], 'document_hash': act['document_hash']})
            docs = [(act['document_hash'], act['authority'], act['decision_date'])] + [
                (c['document_hash'], c['authority'], c['decision_date']) for c in act['subsequent_decisions']]
            for digest, authority, stamp in docs:
                source_docs.add((company_id, digest, authority, stamp))
            money = act['original_monetary_sanction']
            if money:
                amounts.append(amount_row(act, root, money, 'original'))
        final = head['effective_monetary_sanction']
        if final is not None and family['confirmed'] and head['finality_status'] == 'final':
            if final != head['original_monetary_sanction']:
                raise ValueError('effective_amount_without_approved_basis')
            amounts.append(amount_row(head, root, final, 'final_effective'))
    identities = {r['company_id']: r for r in snapshot['companies']}
    groups = defaultdict(list)
    for member in selected:
        root = legal_group(member['company_id'], snapshot, when) if scope == 'corporate_group' else member['company_id']
        groups[root].append(member)
    summaries = []
    for entity_id, group_members in sorted(groups.items()):
        mids = {m['company_id'] for m in group_members}
        fs = [f for company_id in mids for f in per_company[company_id]]
        acts = {a['record_id']: a for f in fs for a in f['acts']}
        observed = bool(acts)
        lower_bounds, upper_bounds = zip(*(employee_bounds(m['employee_size_class']) for m in group_members))
        lower = sum(lower_bounds)
        upper = sum(upper_bounds) if all(v is not None for v in upper_bounds) else None
        count = sum(f['confirmed'] for f in fs) if observed else None
        total = defaultdict(Decimal)
        for a in amounts:
            if a['company_id'] in mids and a['amount_kind'] == 'final_effective':
                total[a['currency']] += Decimal(a['amount'])
        totals = {c: format(v, '.2f') for c, v in sorted(total.items())}
        rate = interval_rate(count, lower, upper) if count is not None else {'lower': None, 'upper': None}
        summaries.append({'entity_id': entity_id, 'entity_label': identities[entity_id]['registered_legal_name'], 'entity_scope': scope,
            'cohort_id': members[0]['cohort_id'], 'cohort_member_ids': sorted(mids), 'member_count': len(mids),
            'primary_sni_codes': sorted({m['primary_sni_code'] for m in group_members}),
            'employee_size_classes': sorted({m['employee_size_class'] for m in group_members}),
            'employees_lower_bound': lower, 'employees_upper_bound': upper,
            'observed_approved_decisions': len(acts), 'observed_case_families': len({f['root']['case_id'] for f in fs}),
            'confirmed_administrative_sanctions': count,
            'gdpr_sanctions': sum(f['confirmed'] and f['gdpr'] for f in fs) if observed else None,
            'competition_law_sanctions': sum(f['confirmed'] and f['competition'] for f in fs) if any(f['competition'] for f in fs) else None,
            'criminal_convictions': None, 'criminal_metric_status': 'not_measured_separate_legal_entity_criminal_scope_required',
            'cases_under_appeal': len({f['root']['case_id'] for f in fs if f['appealed']}) if observed else None,
            'modified_decisions': sum(a['current_known_status'] == 'modified' for a in acts.values()) if observed else None,
            'annulled_decisions': sum(a['current_known_status'] == 'annulled' for a in acts.values()) if observed else None,
            'reviewed_source_documents': len({digest for company_id, digest, _, _ in source_docs if company_id in mids}),
            'final_monetary_sanctions_by_currency': totals if observed else None,
            'sanctions_per_1000_employees_lower': rate['lower'], 'sanctions_per_1000_employees_upper': rate['upper'],
            'final_amounts_per_1000_employees_by_currency': {c: interval_rate(v, lower, upper) for c, v in totals.items()} if observed else None,
            'metric_status': 'observed_approved_records_only' if observed else 'not_assessed', 'coverage_fraction': None,
            'period_start': start, 'period_end': end, 'group_as_of_date': when})
    return {'fact_compliance_cases': list(cases.values()), 'fact_compliance_decisions': decisions,
            'fact_compliance_amounts': amounts, 'mart_compliance_company_summary': summaries,
            'mart_compliance_rankings': ranking_rows(summaries) if independent_ranking_scope(filters) else [],
            'mart_compliance_source_coverage': coverage_rows(decisions, source_docs, start, end)}


def amount_row(act, root, money, kind):
    if money['currency'] not in ('SEK', 'EUR') or money['sanction_type'] != 'administrative_fine':
        raise ValueError('unsupported_currency_or_remedy')
    return {'amount_id': sha256(encoded([root['record_id'], act['record_id'], kind])),
        'decision_id': act['record_id'], 'origin_decision_id': root['record_id'], 'company_id': root['company_id'],
        'case_family_id': root['case_id'], 'currency': money['currency'], 'amount': money['amount'], 'amount_kind': kind,
        'origin_decision_date': root['decision_date'], 'origin_authority': root['authority'], 'case_category': root['case_type'],
        'conversion_method': 'none_native_currency', 'source_url': act['source_url'], 'document_hash': act['document_hash']}


def independent_ranking_scope(filters):
    # KKV collection remains unavailable/partial. Only explicitly IMY-scoped comparisons are enabled.
    return filters.get('authority') == ['Integritetsskyddsmyndigheten'] and not set(filters.get('category',[])) - {'data_protection'}


def ranking_rows(summaries):
    comparisons = defaultdict(list)
    for row in summaries:
        for metric in ('confirmed_administrative_sanctions', 'gdpr_sanctions', 'competition_law_sanctions'):
            if row[metric] is not None:
                comparisons[(metric, None)].append((row, Decimal(row[metric])))
        for currency, amount in (row['final_monetary_sanctions_by_currency'] or {}).items():
            comparisons[('total_final_monetary_sanctions', currency)].append((row, Decimal(amount)))
    output = []
    for (metric, currency), rows in sorted(comparisons.items(), key=lambda v: str(v[0])):
        distinct = sorted({v for _, v in rows}, reverse=True)
        for row, value in rows:
            output.append({'entity_id': row['entity_id'], 'entity_scope': row['entity_scope'], 'metric': metric,
                'currency': currency, 'observed_value': str(value),
                'observed_dense_rank': distinct.index(value)+1 if len(rows) > 1 else None,
                'comparison_count': len(rows), 'ranking_basis': 'observed_approved_metric_descending_not_risk', 'coverage_fraction': None})
    return output


def coverage_rows(decisions, source_docs, start, end):
    docs = {(digest, authority, stamp) for _, digest, authority, stamp in source_docs}
    years = range(date.fromisoformat(start).year, date.fromisoformat(end).year+1)
    cells = {(a, y, 'requested_window') for a in BASE_AUTHORITIES for y in years}
    def role(stamp):
        return 'requested_window' if start <= stamp <= end else 'subsequent_context'
    cells.update((a, int(stamp[:4]), role(stamp)) for _, a, stamp in docs if a and stamp)
    cells.update((r['authority'], int(r['decision_date'][:4]), role(r['decision_date'])) for r in decisions)
    fields = ('record_hash','authority','company_id','decision_date','publication_date','legal_basis','case_category','original_outcome','finality_status')
    result = []
    for authority, year, period_role in sorted(cells):
        lo, hi = f'{year}-01-01', f'{year}-12-31'
        context = period_role == 'subsequent_context'
        if not context:
            lo, hi = max(lo, start), min(hi, end)
        acts = [r for r in decisions if r['authority'] == authority and lo <= r['decision_date'] <= hi and role(r['decision_date']) == period_role]
        known = sum(r[f] not in (None, 'unknown', '', []) for r in acts for f in fields)
        expected = len(acts)*len(fields)
        result.append({'authority': authority, 'period_start': lo, 'period_end': hi,
            'period_role': period_role,
            'approved_decision_records': len(acts),
            'reviewed_source_documents': len({d for d, a, stamp in docs if a == authority and stamp and lo <= stamp <= hi and role(stamp) == period_role}),
            'known_assertion_fields': known, 'assessed_assertion_fields': expected,
            'approved_record_field_completeness': known/expected if expected else None,
            'source_population_documents': None, 'source_population_coverage_fraction': None,
            'search_execution_coverage_fraction': None, 'coverage_status': (
                'partial_kkv_selected_approved_documents' if acts else 'unavailable_kkv_direct_access_blocked'
                ) if authority=='Konkurrensverket' else 'selected_approved_documents_population_unknown'})
    return result


def normalized_filters(snapshot, cohort_info, **options):
    filters = {'date_from': options.get('date_from') or '2018-05-25',
               'date_to': options.get('date_to') or cohort_info['as_of_date'],
               'group_as_of': options.get('group_as_of') or cohort_info['as_of_date'],
               'scope': options.get('scope') or 'legal_entity'}
    for key in ('date_from','date_to','group_as_of'):
        filters[key] = date.fromisoformat(filters[key]).isoformat()
    if filters['date_from'] > filters['date_to'] or filters['group_as_of'] > snapshot['metadata']['as_of_date']:
        raise ValueError('invalid_date_window_or_future_group_snapshot')
    if filters['scope'] not in ('legal_entity','corporate_group'):
        raise ValueError('invalid_entity_scope')
    for key in ('authority','category','status','industry','size_class'):
        filters[key] = sorted(set(options.get(key) or []))
    if set(filters['industry']) - set(POLICY['primary_sni_codes']) or set(filters['size_class']) - set(POLICY['employee_size_class_order']):
        raise ValueError('unknown_industry_or_size_class')
    if set(filters['authority']) - set(AUTHORITY_PATTERNS) or set(filters['status']) - set(STATUSES) or set(filters['category']) - set(VALUE_SCHEMAS['case_type']['enum']):
        raise ValueError('unknown_authority_category_or_status')
    return filters


def build(root, release, cohort, output, *, refresh=False, **options):
    store = ReviewStore(root)
    try:
        rows, snapshot, members, info = input_data(store, release, cohort)
        info['as_of_date'] = members[0]['as_of_date']
        filters = normalized_filters(snapshot, info, **options)
        data = analysis_rows(rows, members, snapshot, filters)
        # Lineages use the full release; recheck selected acts and their status dependencies.
        used = {r['record_hash'] for r in data['fact_compliance_decisions']}
        reconciliations = reconciled_sources(store, [r for r in rows if r['record_hash'] in used], refresh=refresh)
        definition = read_json(Path(cohort)/'methodology.json')
        context = {'schema_version': 1, 'cohort_id': info['cohort_id'], 'cohort_as_of_date': info['as_of_date'],
            'cohort_size': 50, 'membership_hash': info['membership_hash'], 'filters': filters,
            'ranking_status': 'enabled_imy_only' if independent_ranking_scope(filters) else 'disabled_kkv_unavailable_or_partial',
            'selection_order': definition['selection_order'], 'primary_sni_codes': POLICY['primary_sni_codes'],
            'selection_limitations': definition['limitations'], 'warnings': WARNINGS,
            'status_snapshot_at': read_json(Path(release)/'release-manifest.json')['created_at'],
            'gold_manifest_hash': sha256((Path(release)/'artifact-manifest.json').read_bytes()),
            'code_sha256': sha256(Path(__file__).read_bytes()+Path(__file__).with_suffix('.sql').read_bytes()),
            'datasets': {table: {'rows': len(data[table]), 'data_sha256': sha256(encoded(data[table]))} for table in TABLES}}
        with new_output(output) as stage:
            with duckdb.connect(str(stage/'analytics.duckdb')) as con:
                con.execute(Path(__file__).with_suffix('.sql').read_text(encoding='utf-8'))
                for table in TABLES:
                    description = con.execute('describe gold.'+table).fetchall()
                    columns = [d[0] for d in description]
                    json_columns = {d[0] for d in description if d[1] == 'JSON'}
                    if data[table]:
                        con.executemany('insert into gold.'+table+' values ('+','.join('?' for _ in columns)+')',
                            [[json.dumps(row[c], ensure_ascii=False) if c in json_columns and row[c] is not None else row[c]
                              for c in columns] for row in data[table]])
                    write_json(stage/(table+'.json'), data[table])
                    con.execute('copy gold.'+table+' to ? (format parquet, compression zstd)', [str(stage/(table+'.parquet'))])
            write_json(stage/'methodology.json', context)
            write_json(stage/'cohort-definition.json', {k: context[k] for k in ('cohort_id','cohort_as_of_date','cohort_size','membership_hash','selection_order','primary_sni_codes','selection_limitations')})
            write_json(stage/'reconciliation.json', {'status': 'verified' if reconciliations else 'no_approved_decisions_to_reconcile', 'documents': reconciliations})
            seal(stage)
        return context
    finally:
        store.close()


def validate_analytics(root, release, cohort, bundle):
    verify(bundle)
    context = read_json(Path(bundle)/'methodology.json')
    store = ReviewStore(root)
    try:
        rows, snapshot, members, info = input_data(store,release,cohort)
        if context['membership_hash'] != info['membership_hash'] or context['gold_manifest_hash'] != sha256((Path(release)/'artifact-manifest.json').read_bytes()):
            raise ValueError('analytics_input_version_mismatch')
        info['as_of_date'] = members[0]['as_of_date']
        definition = read_json(Path(cohort)/'methodology.json')
        expected_context = {'schema_version':1, 'cohort_id':info['cohort_id'],
            'cohort_as_of_date':info['as_of_date'], 'cohort_size':50,
            'ranking_status':'enabled_imy_only' if independent_ranking_scope(context['filters']) else 'disabled_kkv_unavailable_or_partial',
            'selection_order':definition['selection_order'], 'primary_sni_codes':POLICY['primary_sni_codes'],
            'selection_limitations':definition['limitations'], 'warnings':WARNINGS,
            'status_snapshot_at':read_json(Path(release)/'release-manifest.json')['created_at'],
            'code_sha256':sha256(Path(__file__).read_bytes()+Path(__file__).with_suffix('.sql').read_bytes())}
        if any(context.get(key) != value for key,value in expected_context.items()):
            raise ValueError('analytics_methodology_or_code_version_mismatch')
        if context['filters'] != normalized_filters(snapshot,info,**context['filters']):
            raise ValueError('analytics_filters_not_canonical')
        expected = analysis_rows(rows,members,snapshot,context['filters'])
        for table in TABLES:
            actual = read_json(Path(bundle)/(table+'.json'))
            if (actual != expected[table] or context['datasets'][table]['data_sha256'] != sha256(encoded(actual))
                    or context['datasets'][table]['rows'] != len(actual)):
                raise ValueError('analytics_values_differ_from_approved_gold')
        # Recompute JSON/Parquet/SQL agreement without relying on a re-sealable manifest.
        with duckdb.connect(str(Path(bundle)/'analytics.duckdb'),read_only=True) as con:
            for table in TABLES:
                expected_count = len(expected[table])
                if con.execute('select count(*) from gold.'+table).fetchone()[0] != expected_count:
                    raise ValueError('analytics_database_row_count_mismatch')
                columns = con.execute('describe gold.'+table).fetchall()
                gold_rows = []
                for row in con.execute('select * from gold.'+table).fetchall():
                    out = {}
                    for (name,kind,*_),value in zip(columns,row):
                        if value is not None and kind == 'JSON':
                            value = json.loads(value)
                        elif isinstance(value,date):
                            value = value.isoformat()
                        elif isinstance(value,Decimal):
                            value = format(value,'.2f')
                        out[name] = value
                    gold_rows.append(out)
                if sorted(map(encoded,gold_rows)) != sorted(map(encoded,expected[table])):
                    raise ValueError('analytics_database_projection_mismatch')
                different = con.execute('(select * from gold.'+table+' except all select * from read_parquet(?)) union all '
                    '(select * from read_parquet(?) except all select * from gold.'+table+')',
                    [str(Path(bundle)/(table+'.parquet'))]*2).fetchall()
                if different:
                    raise ValueError('analytics_parquet_projection_mismatch')
        return {'valid':True,'datasets':context['datasets'],'cohort_id':info['cohort_id']}
    finally:
        store.close()


def status(root):
    store = ReviewStore(root)
    try:
        summary = store.summary()
        return {'as_of_utc': now(), 'approved_gold_candidates': summary['publication_eligible'],
            'cohort_required': 'verified_frozen_50_company_bundle', 'source_coverage': summary['source_coverage'],
            'ready_for_real_benchmarks': False if not summary['publication_eligible'] else None,
            'tables': list(TABLES), 'warnings': WARNINGS}
    finally:
        store.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    inspect = sub.add_parser('status')
    inspect.add_argument('--root', type=Path, required=True)
    create = sub.add_parser('build')
    for flag in ('root','release','cohort','output'):
        create.add_argument('--'+flag, type=Path, required=True)
    create.add_argument('--refresh-references', action='store_true')
    create.add_argument('--scope', choices=('legal_entity','corporate_group'), default='legal_entity')
    for flag in ('date-from','date-to','group-as-of'):
        create.add_argument('--'+flag)
    create.add_argument('--year', type=int)
    for flag in ('authority','category','status','industry','size-class'):
        create.add_argument('--'+flag, action='append')
    query = sub.add_parser('query')
    query.add_argument('--bundle', type=Path, required=True)
    query.add_argument('--table', choices=TABLES, required=True)
    check = sub.add_parser('validate')
    check.add_argument('--bundle',type=Path,required=True)
    for command in (query,check):
        for flag in ('root','release','cohort'):
            command.add_argument('--'+flag,type=Path,required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'status':
            result = status(args.root)
        elif args.command == 'query':
            validate_analytics(args.root,args.release,args.cohort,args.bundle)
            result = {'context': read_json(args.bundle/'methodology.json'), 'rows': read_json(args.bundle/(args.table+'.json'))}
        elif args.command == 'validate':
            result = validate_analytics(args.root,args.release,args.cohort,args.bundle)
        else:
            options = vars(args).copy()
            for key in ('command','root','release','cohort','output','refresh_references','year'):
                options.pop(key, None)
            if args.year is not None:
                if not 1 <= args.year <= 9999:
                    raise ValueError('invalid_year')
                options['date_from'] = max(args.date_from or f'{args.year:04d}-01-01', f'{args.year:04d}-01-01')
                options['date_to'] = min(args.date_to or f'{args.year:04d}-12-31', f'{args.year:04d}-12-31')
            result = build(args.root, args.release, args.cohort, args.output, refresh=args.refresh_references, **options)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, KeyError, TypeError, duckdb.Error) as exc:
        message = str(exc) if type(exc) is ValueError else ''
        code = message if re.fullmatch(r'[a-z][a-z0-9_:,]{0,200}', message) else type(exc).__name__
        print('Phase 4 held: '+code, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
