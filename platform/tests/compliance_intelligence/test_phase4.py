"""Reviewed synthetic publication examples; no real company approvals or network calls."""
import copy
import io
import json
import sys
from pathlib import Path

import duckdb
import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from compliance_intelligence.analytics import (  # noqa: E402
    TABLES, analysis_rows, build, coverage_rows, employee_bounds, input_data,
    interval_rate, normalized_filters, reconciled_sources, roots_for, validate_analytics,
)
from compliance_intelligence.cohort import build_cohort, verify_cohort  # noqa: E402
from compliance_intelligence.legal_extraction import document_pages, extract_candidate  # noqa: E402
from compliance_intelligence.legal_review import ReviewStore  # noqa: E402
from compliance_intelligence.sources import ingest_local, load_snapshot, seal  # noqa: E402
from lib.rawstore import sha256  # noqa: E402
from test_phase1 import number, rows, write_local, relation  # noqa: E402
from test_phase3 import approve, claim, request, ROSTER  # noqa: E402


def pdf(text):
    writer = PdfWriter()
    page = writer.add_blank_page(600, 800)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'),
        NameObject('/BaseFont'): NameObject('/Helvetica'), NameObject('/Encoding'): NameObject('/WinAnsiEncoding')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
    content = DecodedStreamObject()
    escaped = text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    content.set_data(('BT /F1 10 Tf 10 700 Td ('+escaped+') Tj ET').encode('cp1252'))
    page[NameObject('/Contents')] = writer._add_object(content)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


@pytest.fixture
def ready(tmp_path):
    data = rows(55)
    data[0]['registered_legal_name'] = 'Synthetic Example AB'
    data[1]['registered_legal_name'] = 'Synthetic Second AB'
    for row in data:
        row['valid_from']='2020-01-01'
    source, sidecar = write_local(tmp_path, data)
    register, cohort = tmp_path/'register', tmp_path/'cohort'
    ingest_local(source, sidecar, register)
    build_cohort(register, cohort, 'synthetic-phase4')
    snap = load_snapshot(cohort)
    store = ReviewStore(tmp_path/'private')
    yield store, cohort, snap
    store.close()


def add_publication(store, snap, *, index=0, reference='IMY-2025-100', date='2026-10-16', amount='1,8 miljoner kronor',
                    final=False, appealed=False, law='GDPR', authority='imy'):
    name = 'Synthetic Example AB' if index == 0 else 'Synthetic Second AB'
    extra = ' Beslutet har vunnit laga kraft.' if final else (' Beslutet har överklagats.' if appealed else '')
    issuer = 'Integritetsskyddsmyndigheten' if authority == 'imy' else 'Konkurrensverket'
    heading = 'Integritetsskyddsmyndighetens' if authority == 'imy' else 'Konkurrensverkets'
    text = (heading+' beslut. Diarienummer: '+reference+' Datum: '+date+'. '
        +issuer+' beslutar att '+name+' ('+number(index)+') ska betala en administrativ sanktionsavgift på '
        +amount+' enligt '+law+'.'+extra)
    body = pdf(text)
    host = 'www.imy.se' if authority == 'imy' else 'www.konkurrensverket.se'
    doc_id, _ = store.accept(authority,'https://'+host+'/globalassets/synthetic-'+reference+'-'+sha256(body)[:16]+'.pdf',
        {'content-type':'application/pdf'},body, {'rationale':'Owned synthetic fixture; permitted private test copy'})
    pages = document_pages(body,'application/pdf')
    proposal = extract_candidate(store.document(doc_id),pages)
    if final:
        claim(proposal,'status','final',pages,'Beslutet har vunnit laga kraft')
    elif appealed:
        claim(proposal,'status','appealed',pages,'Beslutet har överklagats')
    result = store.add_candidate(proposal,pages,snapshot=snap)
    approve(store,result)
    return result


def gold_rows(store):
    return [store.gold_record(r['record_hash']) for r in store.current_records() if not store.blockers(r['record_hash'])]


def transform(ready, **options):
    store, cohort, snap = ready
    members = json.loads((cohort/'cohort.json').read_text())
    info = {**verify_cohort(cohort),'as_of_date':members[0]['as_of_date']}
    filters = normalized_filters(snap,info,**options)
    return analysis_rows(gold_rows(store),members,snap,filters)


def company(data, index=0):
    return next(r for r in data['mart_compliance_company_summary'] if r['entity_id']=='se:orgnr:'+number(index))


def test_approved_publication_counts_and_native_final_amounts(ready):
    store, _, snap = ready
    add_publication(store,snap,final=True)
    data = transform(ready)
    first = company(data)
    assert first['confirmed_administrative_sanctions']==1 and first['gdpr_sanctions']==1
    assert first['final_monetary_sanctions_by_currency']=={'SEK':'1800000.00'}
    assert first['reviewed_source_documents']==1
    assert len(data['fact_compliance_cases'])==len(data['fact_compliance_decisions'])==1
    assert len(data['fact_compliance_amounts'])==2
    assert company(data,1)['confirmed_administrative_sanctions'] is None
    assert company(data,1)['metric_status']=='not_assessed'
    assert first['criminal_convictions'] is None


def test_appealed_orders_count_separately_from_final_money(ready):
    store, _, snap = ready
    add_publication(store,snap,appealed=True)
    first = company(transform(ready))
    assert first['confirmed_administrative_sanctions']==1
    assert first['cases_under_appeal']==1
    assert first['final_monetary_sanctions_by_currency']=={}


def test_two_orders_same_case_are_distinct_but_cases_are_not_duplicated(ready):
    store, _, snap = ready
    add_publication(store,snap,date='2026-10-15',final=True)
    add_publication(store,snap,date='2026-10-16',amount='2 miljoner kronor',final=True)
    data = transform(ready)
    assert company(data)['confirmed_administrative_sanctions']==2
    assert company(data)['observed_case_families']==1
    assert company(data)['final_monetary_sanctions_by_currency']=={'SEK':'3800000.00'}


def test_incompatible_currencies_are_never_combined(ready):
    store, _, snap = ready
    add_publication(store,snap,final=True)
    add_publication(store,snap,reference='IMY-2025-101',amount='35000 euro',final=True)
    data = transform(ready,authority=['Integritetsskyddsmyndigheten'])
    assert company(data)['final_monetary_sanctions_by_currency']=={'EUR':'35000.00','SEK':'1800000.00'}
    ranks = [r for r in data['mart_compliance_rankings'] if r['metric']=='total_final_monetary_sanctions']
    assert {r['currency'] for r in ranks}=={'SEK','EUR'}
    assert all(r['observed_dense_rank'] is None for r in ranks)


def test_transparent_observed_ranks_exclude_unassessed_companies(ready):
    store, _, snap = ready
    add_publication(store,snap,final=True)
    add_publication(store,snap,index=1,reference='IMY-2025-101',final=True)
    add_publication(store,snap,index=1,reference='IMY-2025-102',final=True)
    data = transform(ready,authority=['Integritetsskyddsmyndigheten'])
    ranks = [r for r in data['mart_compliance_rankings'] if r['metric']=='confirmed_administrative_sanctions']
    assert len(ranks)==2 and {r['observed_dense_rank'] for r in ranks}=={1,2}
    assert all(r['comparison_count']==2 and r['coverage_fraction'] is None for r in ranks)
    assert all('not_risk' in r['ranking_basis'] for r in ranks)


def test_missing_kkv_coverage_never_becomes_zero_or_a_combined_ranking(ready):
    store,_,snap=ready
    add_publication(store,snap,final=True)
    data=transform(ready)
    assert not data['mart_compliance_rankings']
    assert company(data)['competition_law_sanctions'] is None
    assert transform(ready,authority=['Integritetsskyddsmyndigheten'])['mart_compliance_rankings']


def test_filters_do_not_modify_frozen_cohort(ready):
    store, cohort, snap = ready
    add_publication(store,snap,final=True)
    before = verify_cohort(cohort)['membership_hash']
    data = transform(ready,status=['appealed'])
    assert len(data['mart_compliance_company_summary'])==50
    assert not data['fact_compliance_decisions']
    assert all(r['confirmed_administrative_sanctions'] is None for r in data['mart_compliance_company_summary'])
    assert verify_cohort(cohort)['membership_hash']==before
    assert not transform(ready,industry=['58290'])['mart_compliance_company_summary']


def test_source_coverage_separates_field_completeness_from_population(ready):
    store, _, snap = ready
    add_publication(store,snap)
    coverage = transform(ready)['mart_compliance_source_coverage']
    imy = next(r for r in coverage if r['authority']=='Integritetsskyddsmyndigheten' and r['period_start']=='2026-01-01')
    assert imy['reviewed_source_documents']==1
    assert imy['approved_record_field_completeness'] < 1
    assert imy['source_population_coverage_fraction'] is None
    assert imy['search_execution_coverage_fraction'] is None
    kkv = next(r for r in coverage if r['authority']=='Konkurrensverket' and r['period_start']=='2026-01-01')
    assert kkv['reviewed_source_documents']==0 and kkv['approved_record_field_completeness'] is None


@pytest.mark.parametrize('code,expected', [('1',(0,0)),('6',(50,99)),('16',(10000,None))])
def test_employee_classes_remain_intervals(code,expected):
    assert employee_bounds(code)==expected


def test_exploratory_normalization_does_not_invent_midpoints():
    assert interval_rate(1,50,99)=={'lower':'10.101010','upper':'20.000000'}
    assert interval_rate(1,0,0)=={'lower':None,'upper':None}
    assert interval_rate(1,10000,None)=={'lower':None,'upper':'0.100000'}


def test_group_rollup_preserves_legal_party_and_counts_only_cohort_members(ready):
    store, cohort, snap = ready
    add_publication(store,snap,final=True)
    add_publication(store,snap,index=1,reference='IMY-2025-101',final=True)
    first, second = 'se:orgnr:'+number(0), 'se:orgnr:'+number(1)
    snap['relationships']=[relation(first,second)]
    members=json.loads((cohort/'cohort.json').read_text())
    filters=normalized_filters(snap,{'as_of_date':'2026-10-16'},scope='corporate_group')
    data=analysis_rows(gold_rows(store),members,snap,filters)
    group=next(r for r in data['mart_compliance_company_summary'] if r['entity_id']==second)
    assert group['member_count']==2 and group['confirmed_administrative_sanctions']==2
    assert group['employees_lower_bound']==100 and group['employees_upper_bound']==198
    assert {r['company_id'] for r in data['fact_compliance_decisions']}=={first,second}
    assert len(data['mart_compliance_company_summary'])==49


def test_group_unknown_start_and_merger_are_not_inferred(ready):
    _, _, snap = ready
    first, second='se:orgnr:'+number(0),'se:orgnr:'+number(1)
    snap['relationships']=[relation(first,second,start=None)]
    with pytest.raises(ValueError,match='group_relationship_start_date_unknown'):
        from compliance_intelligence.analytics import legal_group
        legal_group(first,snap,'2026-10-16')
    snap['relationships']=[relation(first,second,kind='merged_into')]
    assert legal_group(first,snap,'2026-10-16')==first


def test_reconciliation_checks_actual_original_bytes_and_quotes(ready):
    store, _, snap = ready
    result=add_publication(store,snap,final=True)
    reports=reconciled_sources(store,gold_rows(store))
    assert len(reports)==1 and reports[0]['status']=='original_bytes_and_claim_excerpts_verified'
    doc=store.document(store.record(result['record_hash'])['document_id'])
    (store.root/doc['storage_ref']).write_bytes(b'altered original')
    with pytest.raises(ValueError,match='source_bytes_changed'):
        reconciled_sources(store,gold_rows(store))


def test_full_build_materializes_six_typed_tables_and_reproduces_data(ready,tmp_path):
    store, cohort, snap=ready
    add_publication(store,snap,final=True)
    release=tmp_path/'release'
    store.export_gold(release)
    root=store.root
    store.close()
    a=build(root,release,cohort,tmp_path/'analytics-a')
    b=build(root,release,cohort,tmp_path/'analytics-b')
    assert a['datasets']==b['datasets']
    assert a['cohort_size']==50 and a['membership_hash']==b['membership_hash']
    with duckdb.connect(str(tmp_path/'analytics-a/analytics.duckdb'),read_only=True) as con:
        assert con.execute("select count(*) from information_schema.tables where table_schema='gold'").fetchone()[0]==6
        assert con.execute('select sum(amount) from gold.fact_compliance_amounts where amount_kind=\'final_effective\'').fetchone()[0]==1800000
    assert all((tmp_path/'analytics-a'/(table+'.parquet')).is_file() for table in TABLES)
    assert validate_analytics(root,release,cohort,tmp_path/'analytics-a')['valid']


def test_unapproved_or_revoked_records_cannot_enter_analytics(ready,tmp_path):
    store, cohort, snap=ready
    result=add_publication(store,snap,final=True)
    release=tmp_path/'release'
    store.export_gold(release)
    store.review(request(store,result,'publication',actor='publisher-human',disposition='withdrawn'),ROSTER)
    with pytest.raises(ValueError,match='release_approval_expired_revoked_or_stale'):
        input_data(store,release,cohort)
    assert not (tmp_path/'should-not-exist').exists()


def test_empty_gold_means_unassessed_not_fifty_clean_companies(ready):
    data=transform(ready)
    assert not data['fact_compliance_decisions'] and not data['mart_compliance_rankings']
    assert len(data['mart_compliance_company_summary'])==50
    assert all(r['metric_status']=='not_assessed' and r['confirmed_administrative_sanctions'] is None for r in data['mart_compliance_company_summary'])


def test_input_order_is_not_an_analytical_variable(ready):
    store, cohort, snap=ready
    add_publication(store,snap,final=True)
    add_publication(store,snap,index=1,reference='IMY-2025-101',final=True)
    members=json.loads((cohort/'cohort.json').read_text())
    filters=normalized_filters(snap,{'as_of_date':'2026-10-16'})
    rows=gold_rows(store)
    assert analysis_rows(rows,members,snap,filters)==analysis_rows(list(reversed(rows)),list(reversed(members)),snap,filters)


def test_court_appeal_outside_date_window_does_not_resurrect_annulled_amount(ready):
    store, cohort, snap=ready
    first=add_publication(store,snap,date='2026-10-15',final=True)
    rows=gold_rows(store)
    origin=rows[0]
    # Approved-source projection scenario; real lifecycle approval path is exercised in Phase 3.
    origin['current_known_status']='annulled'
    origin['effective_monetary_sanction']=None
    origin['subsequent_decisions']=[{'record_id':'court','relation':'annuls','authority':'Förvaltningsrätten i Stockholm',
        'decision_date':'2026-10-16','source_url':'https://www.imy.se/globalassets/court.pdf','document_hash':'a'*64}]
    members=json.loads((cohort/'cohort.json').read_text())
    filters=normalized_filters(snap,{'as_of_date':'2026-10-16'},date_from='2026-10-15',date_to='2026-10-15')
    data=analysis_rows(rows,members,snap,filters)
    assert company(data)['confirmed_administrative_sanctions']==0
    assert company(data)['annulled_decisions']==1
    assert company(data)['final_monetary_sanctions_by_currency']=={}
    assert company(data)['reviewed_source_documents']==2
    assert any(r['authority']=='Förvaltningsrätten i Stockholm' and r['period_role']=='subsequent_context' for r in data['mart_compliance_source_coverage'])


def test_multiple_documents_in_same_sanction_lineage_do_not_multiply_amounts(ready):
    store, cohort, snap=ready
    add_publication(store,snap,final=True)
    rows=gold_rows(store)
    child=copy.deepcopy(rows[0])
    child['record_id']='court'
    child['case_id']='court-case'
    child['authority']='Förvaltningsrätten i Stockholm'
    child['original_outcome']='judgment'
    child['original_monetary_sanction']=None
    child['effective_monetary_sanction']=None
    child['subsequent_decisions']=[]
    rows[0]['subsequent_decisions']=[{'record_id':'court','relation':'upholds','authority':child['authority'],
        'decision_date':child['decision_date'],'source_url':child['source_url'],'document_hash':child['document_hash']}]
    rows.append(child)
    members=json.loads((cohort/'cohort.json').read_text())
    data=analysis_rows(rows,members,snap,normalized_filters(snap,{'as_of_date':'2026-10-16'}))
    assert company(data)['confirmed_administrative_sanctions']==1
    assert company(data)['observed_case_families']==1
    assert company(data)['final_monetary_sanctions_by_currency']=={'SEK':'1800000.00'}


@pytest.mark.parametrize('option', [{'status':['nonsense']},{'industry':['00000']},{'date_from':'2027-01-01','date_to':'2026-01-01'}, {'group_as_of':'2027-01-01'}])
def test_invalid_filters_fail_explicitly(ready,option):
    _, _, snap=ready
    with pytest.raises(ValueError):
        normalized_filters(snap,{'as_of_date':'2026-10-16'},**option)


def test_competition_sanctions_are_separate_from_gdpr(ready):
    store, _, snap=ready
    add_publication(store,snap,authority='kkv',reference='123/2025',law='konkurrenslagen (2008:579)',final=True)
    data=transform(ready,authority=['Konkurrensverket'],category=['competition'])
    assert company(data)['competition_law_sanctions']==1
    assert company(data)['gdpr_sanctions']==0
    assert data['fact_compliance_decisions'][0]['authority']=='Konkurrensverket'


@pytest.mark.parametrize('status',['alleged','investigation','unknown'])
def test_unconfirmed_states_cannot_enter_confirmed_totals(ready,status):
    store, cohort, snap=ready
    add_publication(store,snap)
    rows=gold_rows(store)
    rows[0]['original_status']=status
    rows[0]['current_known_status']=status
    rows[0]['original_outcome']='unknown'
    rows[0]['effective_monetary_sanction']=None
    members=json.loads((cohort/'cohort.json').read_text())
    data=analysis_rows(rows,members,snap,normalized_filters(snap,{'as_of_date':'2026-10-16'}))
    assert company(data)['confirmed_administrative_sanctions']==0
    assert company(data)['final_monetary_sanctions_by_currency']=={}


def test_modified_order_requires_a_separately_approved_replacement_amount(ready):
    store, cohort, snap=ready
    add_publication(store,snap,final=True,date='2026-10-15')
    add_publication(store,snap,reference='IMY-2025-101',final=True,amount='1 miljon kronor')
    rows=sorted(gold_rows(store),key=lambda r:r['decision_date'])
    rows[0]['current_known_status']='modified'
    rows[0]['effective_monetary_sanction']=None
    rows[0]['subsequent_decisions']=[{'record_id':rows[1]['record_id'],'relation':'modifies',
        'authority':rows[1]['authority'],'decision_date':rows[1]['decision_date'],
        'source_url':rows[1]['source_url'],'document_hash':rows[1]['document_hash']}]
    members=json.loads((cohort/'cohort.json').read_text())
    data=analysis_rows(rows,members,snap,normalized_filters(snap,{'as_of_date':'2026-10-16'}))
    assert company(data)['confirmed_administrative_sanctions']==1
    assert company(data)['modified_decisions']==1
    assert company(data)['final_monetary_sanctions_by_currency']=={'SEK':'1000000.00'}
    assert len(data['fact_compliance_cases'])==1


def test_appeal_links_cannot_transfer_liability_to_other_company(ready):
    store, _, snap=ready
    add_publication(store,snap,final=True)
    add_publication(store,snap,index=1,reference='IMY-2025-101',final=True)
    rows=gold_rows(store)
    rows[0]['subsequent_decisions']=[{'record_id':rows[1]['record_id'],'relation':'upholds'}]
    with pytest.raises(ValueError,match='lineage_cannot_transfer_company_liability'):
        roots_for(rows)


def test_resealed_metrics_and_methodology_cannot_bypass_live_gold(ready,tmp_path):
    store, cohort, snap=ready
    add_publication(store,snap,final=True)
    release=tmp_path/'release'
    store.export_gold(release)
    root=store.root
    store.close()
    bundle=tmp_path/'analytics'
    build(root,release,cohort,bundle)
    path=bundle/'mart_compliance_company_summary.json'
    original=path.read_bytes()
    rows=json.loads(original)
    next(r for r in rows if r['confirmed_administrative_sanctions'] is not None)['confirmed_administrative_sanctions']=99
    path.write_text(json.dumps(rows),encoding='utf-8')
    seal(bundle)
    with pytest.raises(ValueError,match='analytics_values_differ_from_approved_gold'):
        validate_analytics(root,release,cohort,bundle)
    path.write_bytes(original)
    context_path=bundle/'methodology.json'
    context=json.loads(context_path.read_text())
    context['cohort_size']=1
    context_path.write_text(json.dumps(context),encoding='utf-8')
    seal(bundle)
    with pytest.raises(ValueError,match='analytics_methodology_or_code_version_mismatch'):
        validate_analytics(root,release,cohort,bundle)


def test_existing_analytics_becomes_invalid_after_publication_withdrawal(ready,tmp_path):
    store, cohort, snap=ready
    result=add_publication(store,snap,final=True)
    release=tmp_path/'release'
    store.export_gold(release)
    root=store.root
    store.close()
    bundle=tmp_path/'analytics'
    build(root,release,cohort,bundle)
    current=ReviewStore(root)
    try:
        current.review(request(current,result,'publication',actor='publisher-human',disposition='withdrawn'),ROSTER)
    finally:
        current.close()
    with pytest.raises(ValueError,match='release_approval_expired_revoked_or_stale'):
        validate_analytics(root,release,cohort,bundle)
