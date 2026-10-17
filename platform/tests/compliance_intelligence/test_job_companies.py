"""Synthetic identity and publication contracts; no network or real employment data."""
import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import duckdb
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from compliance_intelligence.job_resolution import apply_reviews, resolve_employer
from compliance_intelligence.sources import ScbClient, ingest_local, load_snapshot, seal, write_json
from compliance_intelligence.registry import encoded
from ingest_jobs import fetch_search, ingest
from weekly_jobs import IT_FIELD, collect
from publish.job_companies import project, publish, validate
from publish.job_companies import percentage
from test_phase1 import alias, number, relation, snapshot, rows, write_local
from lib.rawstore import sha256


def test_exact_wrong_similar_and_unresolved_names():
    s = snapshot(rows(3))
    assert resolve_employer(s, {'name':'Synthetic company 0 AB','organization_number':number(0)})['company_id'] == 'se:orgnr:'+number(0)
    assert resolve_employer(s, {'name':'Synthetic company 1 AB','organization_number':number(0)})['match_status'] == 'ambiguous'
    assert resolve_employer(s, {'name':'Synthetic company 0 AB'})['company_id'] is None
    assert resolve_employer(s, {'name':'Synthetic company 0 AB','organization_number':'bad'})['company_id'] is None
    assert resolve_employer(s, {'name':'Completely unrelated name'})['match_status'] == 'unresolved'
    assert percentage(1,32)==3.13  # Same explicit half-up rounding as the browser.


def test_reviewed_brand_historic_name_and_group_do_not_merge():
    a = alias('se:orgnr:'+number(0), 'Documented brand')
    old = alias('se:orgnr:'+number(1),'Former name',kind='historic_legal_name',end='2026-10-15')
    s = snapshot(rows(3), aliases=[a,old], relationships=[relation('se:orgnr:'+number(0),'se:orgnr:'+number(2))])
    assert resolve_employer(s, {'name':'Documented brand'})['company_id'] == 'se:orgnr:'+number(0)
    assert resolve_employer(s, {'name':'Former name'},on_date='2026-10-14')['company_id'] == 'se:orgnr:'+number(1)
    assert resolve_employer(s, {'name':'Former name'},on_date='2026-10-16')['company_id'] is None
    assert resolve_employer(s, {'name':'Synthetic company 0 AB','organization_number':number(0)})['company_id'] != 'se:orgnr:'+number(2)
    ambiguous = snapshot(rows(3), aliases=[a,{**a,'company_id':'se:orgnr:'+number(1)}])
    assert resolve_employer(ambiguous, {'name':'Documented brand'})['match_status'] == 'ambiguous'


class Response:
    def __init__(self, body, code=200):
        self.content = encoded(body)
        self.status_code = code
        self.body = body
    def json(self): return self.body
    def raise_for_status(self):
        if self.status_code != 200: raise ValueError('HTTP failure')


class HTTP:
    def __init__(self, bodies): self.bodies, self.calls = list(bodies), []
    def get(self, url, **kwargs):
        self.calls.append((url,kwargs))
        return self.bodies.pop(0)


def test_lookup_uses_12digit_deduplicates_and_preserves_missing(tmp_path):
    http = HTTP([Response({'orgNr':number(0),'namn':'Synthetic company 0 AB','ftgStat':'1','anstKl':'6','jurform':'49',
        'primarNaringsgren':{'naringsgren':'62100'}}), Response({'message':'not found'},404)])
    s = ScbClient('synthetic-key',http=http,sleep=lambda _:None).lookup([number(0),number(0),number(1)],tmp_path/'registry')
    assert len(http.calls) == 2
    assert http.calls[0][0].endswith('/16'+number(0))
    assert len(s['companies']) == 1 and len(s['metadata']['not_found']) == 1
    assert not s['metadata']['population_complete']
    assert 'synthetic-key' not in (tmp_path/'registry'/'snapshot.json').read_text()


def ad(index=0):
    return {'id':str(index),'headline':'Synthetic developer','publication_date':'2026-10-16T12:00:00',
        'employer':{'name':'Synthetic company 0 AB','organization_number':number(0),'workplace':'Synthetic workplace',
                    'email':'private@example.invalid'},
        'occupation_field':{'concept_id':IT_FIELD},'must_have':{'skills':[{'label':'Python'}]},
        'webpage_url':'https://example.invalid/ad/'+str(index),'workplace_address':{'municipality':'Synthetic city'}}


def test_pagination_completeness_and_changing_totals():
    first = [ad(i) for i in range(100)]
    http=HTTP([Response({'hits':first,'total':{'value':101}}),Response({'hits':[ad(100)],'total':{'value':101}})])
    found,c = fetch_search(http,{},20,sleep=lambda _:None)
    assert c['complete'] and len(found)==101 and http.calls[1][1]['params']['offset']==100
    http=HTTP([Response({'hits':first,'total':{'value':101}}),Response({'hits':[ad(100)],'total':{'value':102}})])
    assert not fetch_search(http,{},20,sleep=lambda _:None)[1]['complete']
    http=HTTP([Response({'hits':first,'total':{'value':3000}})])
    assert fetch_search(http,{},20,sleep=lambda _:None,allow_window_split=True)[1]['requires_window_split']


def test_collect_deduplicates_boundary_split_and_reuses_raw_writer(tmp_path):
    http=HTTP([Response({'hits':[],'total':{'value':3000}}),
        Response({'hits':[ad()],'total':{'value':1}}),Response({'hits':[ad()],'total':{'value':1}})])
    manifest=collect(tmp_path/'collection',tmp_path/'jobs.duckdb',http=http,
        as_of=datetime(2026,10,17,12,tzinfo=timezone.utc))
    assert manifest['duplicate_observations']==1 and manifest['observed_active_ads']==1
    with duckdb.connect(str(tmp_path/'jobs.duckdb')) as con:
        assert con.execute('select count(*) from raw.job_ads').fetchone()[0]==1


def bundle(tmp_path, registry=True):
    source,meta=write_local(tmp_path, rows(2))
    if registry: ingest_local(source,meta,tmp_path/'registry')
    current=datetime.now(timezone.utc).isoformat()
    a=ad()
    a['publication_date']=current[:19]
    db=tmp_path/'jobs.duckdb'
    ingest([a,a],db,'fixture')
    digest=sha256(json.dumps(a,sort_keys=True,ensure_ascii=False).encode('utf-8'))
    d=tmp_path/'collection';d.mkdir()
    write_json(d/'collection.json',{'versions':[{'job_id':'0','payload_hash':digest}],
        'collected_at':current,'source_url':'https://example.invalid/search',
        'license_url':'https://example.invalid/license','occupation_field_id':IT_FIELD,'occupation_field':'Data/IT',
        'window_start':'2026-10-10T00:00:00','window_end':current[:19],'query_timezone':'Europe/Stockholm',
        'coverage_status':'complete_search_at_observation','limitations':['Synthetic test only']})
    seal(d)
    return d,db,tmp_path/'registry' if registry else None


def test_projection_duckdb_parquet_source_privacy_and_recruiter_role(tmp_path):
    data=project(*bundle(tmp_path),tmp_path/'resolved')
    assert len(data['jobs'])==1 and data['metrics']['verified_company_links']==1
    assert data['links'][0]['relationship_type']=='advertised_employer'
    assert all(l['relationship_type']!='actual_employer' for l in data['links'])
    assert data['context']==[] and data['metrics']['companies_with_financial_data']==0
    assert data['metrics']['companies_with_reviewed_compliance_coverage'] is None
    text=(tmp_path/'resolved/public.json').read_text(encoding='utf-8')
    assert 'private@example.invalid' not in text and 'candidate_ids' not in text
    assert data['jobs'][0]['document_hash']==data['links'][0]['job_payload_hash']
    with duckdb.connect(str(tmp_path/'resolved/registry.duckdb')) as con:
        assert con.execute('select observed_advertisements from compliance_intelligence.mart_company_hiring_daily').fetchone()[0]==1
        assert con.execute('select financial_value from compliance_intelligence.mart_company_hiring_context').fetchone()[0] is None
    assert (tmp_path/'resolved/job_company_link.parquet').exists()
    # Corrupting public identity evidence fails the semantic gate.
    bad=copy.deepcopy(data);bad['links'][0]['match_status']='ambiguous'
    with pytest.raises(ValueError,match='Unverified'): validate(bad)


def test_missing_key_registry_and_context_are_explicit(tmp_path):
    data=project(*bundle(tmp_path,registry=False),tmp_path/'resolved')
    assert data['companies']==[] and data['links'][0]['company_id'] is None
    assert data['metrics']['unresolved_matches']==1


def test_reviewed_financial_context_connects_an_exact_entity_without_current_ads(tmp_path):
    fact={'company_id':'se:orgnr:'+number(1),'kind':'financial','period':'2025','label':'Revenue',
        'value':'100.00','unit':'SEK','source_url':'https://example.invalid/report','document_hash':'c'*64,
        'source_locator':'page 1','verified_at':datetime.now(timezone.utc).isoformat(),
        'review_status':'approved','reviewer_id':'human','entity_scope':'legal_entity','private_contact':'never publish'}
    data=project(*bundle(tmp_path),tmp_path/'resolved',context=[fact],reviewers=['human'])
    assert len(data['companies'])==2 and data['metrics']['companies_with_financial_data']==1
    assert data['context'][0]['company_id']=='se:orgnr:'+number(1)
    assert 'private_contact' not in data['context'][0] and 'reviewer_id' not in data['context'][0]
    assert all(l['company_id'] != data['context'][0]['company_id'] for l in data['links'])


def test_fixture_bundle_cannot_replace_designated_production_payload(tmp_path,monkeypatch):
    import publish.job_companies as producer
    project(*bundle(tmp_path),tmp_path/'resolved')
    monkeypatch.setattr(producer,'PUBLIC',tmp_path/'designated-public.json')
    with pytest.raises(ValueError,match='official live JobSearch'):
        producer.publish(tmp_path/'resolved',producer.PUBLIC)
    assert not producer.PUBLIC.exists()


def test_human_role_review_is_bound_to_inputs_and_evidence():
    s=snapshot(rows(2));rh=sha256(encoded(s))
    link={'job_id':'a','relationship_type':'advertised_employer','job_payload_hash':'b'*64,'registry_hash':rh,
        **resolve_employer(s,{'name':'Synthetic company 0 AB','organization_number':number(0)})}
    review={'job_id':'a','relationship_type':'actual_employer','job_payload_hash':'b'*64,'registry_hash':rh,
        'company_id':'se:orgnr:'+number(1),'reviewer_id':'human','reviewed_at':'2026-10-16T12:00:00+00:00',
        'disposition':'approved','evidence_url':'https://example.invalid/contract','document_hash':'c'*64,
        'source_locator':'section 2','rationale':'Explicit end employer identity'}
    links=apply_reviews([link],[copy.deepcopy(review)],s,['human'],rh)
    assert len(links)==2 and links[0]['company_id']!=links[1]['company_id']
    for change in ({'job_payload_hash':'d'*64},{'registry_hash':'e'*64},{'reviewer_id':'machine'},{'document_hash':'bad'}):
        with pytest.raises(ValueError): apply_reviews([link],[{**review,**change}],s,['human'],rh)
