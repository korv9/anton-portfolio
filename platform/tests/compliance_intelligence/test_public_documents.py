"""Owned synthetic documents only. Collection never approves a legal finding."""
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from compliance_intelligence.authority_http import AccessFailure, AuthorityHttp
from compliance_intelligence.public_documents import collect, document_url, search_coverage, search_plan
from compliance_intelligence.legal_review import ReviewStore
from compliance_intelligence.legal_extraction import document_pages, extract_candidate
from compliance_intelligence.cohort import verify_cohort
from lib.rawstore import sha256
from test_phase4 import ready, pdf
from test_phase1 import number
from test_phase2 import Response, Session


def manifest(tmp_path,body,**extra):
    original=tmp_path/'original.pdf';original.write_bytes(body)
    path=tmp_path/'manual.json'
    entry={'source_id':'kkv','source_url':'https://www.konkurrensverket.se/globalassets/synthetic-decision.pdf',
        'expected_sha256':sha256(body),'local_file':'original.pdf','acquired_at':'2026-01-01T00:00:00Z',
        'acquired_by':'synthetic-operator','public_download_without_bypass':True,**extra}
    path.write_text(json.dumps({'schema_version':1,'documents':[entry]}),encoding='utf-8')
    return path


def test_manual_import_is_idempotent_and_preserves_review_and_cohort_gates(ready,tmp_path):
    _,cohort,_=ready
    before=verify_cohort(cohort)['membership_hash']
    body=pdf('Konkurrensverkets beslut. Diarienummer: 123/2025. Datum: 2025-01-01. '
        'Marknadsbeskrivning: Synthetic Example AB ('+number(0)+'). Konkurrenslagen (2008:579).')
    path=manifest(tmp_path,body)
    root=tmp_path/'supplement'
    one=collect(root,cohort,path,local=True)
    two=collect(root,cohort,path,local=True)
    assert one['documents'][0]['new_byte_version'] is True
    assert two['documents'][0]['new_byte_version'] is False
    assert two['documents'][0]['candidate']['inserted'] is False
    store=ReviewStore(root)
    try:
        assert store.execute('select count(*) from bronze.document_version').fetchone()[0]==1
        assert len(store.current_records())==1
        assert store.summary()['publication_eligible']==0
        assert store.summary()['human_review_actions']==0
        assert store.current_records()[0]['identity']['company_id'] is None
        assert store.execute('select storage_ref,reuse_status from bronze.document_version').fetchone()==(None,'reference_only_unverified')
        assert store.verify_audit()['entries']>0
    finally:store.close()
    assert verify_cohort(cohort)['membership_hash']==before
    assert not (root/'bronze/blobs').exists()


def test_import_rejects_bad_hash_unreviewed_access_and_path_escape(ready,tmp_path):
    _,cohort,_=ready;body=pdf('Synthetic fixture')
    path=manifest(tmp_path,body,public_download_without_bypass=False)
    with pytest.raises(ValueError,match='local_public_access_provenance_required'):
        collect(tmp_path/'held',cohort,path,local=True)
    path=manifest(tmp_path,body,local_file='../private.pdf')
    with pytest.raises(ValueError):collect(tmp_path/'held',cohort,path,local=True)
    path=manifest(tmp_path,body,expected_sha256='0'*64)
    report=collect(tmp_path/'hash-held',cohort,path,local=True)
    assert report['documents'][0]['error_code']=='document_hash_changed_requires_review'


def test_automatic_collection_rejects_kkv_mirrors_and_unlisted_hosts():
    for url in ('https://www.konkurrensverket.se/decision.pdf','https://information.konkurrensverket.se/beslut/test.pdf'):
        with pytest.raises(ValueError,match='independent_court'):
            document_url('kkv',url)
    for url in ('https://www.domstol.se.evil.invalid/a.pdf','https://user@www.domstol.se/a.pdf','http://www.domstol.se/a.pdf'):
        with pytest.raises(ValueError):document_url('court_publications',url)
    assert document_url('court_publications','https://www.domstol.se/globalassets/fixture.pdf').endswith('fixture.pdf')


@pytest.mark.parametrize('issuer,heading',[
    ('Högsta förvaltningsdomstolen','HÖGSTA FÖRVALTNINGSDOMSTOLENS DOM'),
    ('Regeringsrätten','REGERINGSRÄTTENS DOM'),
])
def test_historic_and_current_court_issuers_are_not_replaced_with_kkv(issuer,heading):
    pages=document_pages(pdf(heading+'. Mål nr 123-20. Konkurrensverket nämns i handlingen.'),'application/pdf')
    candidate=extract_candidate({'document_id':'synthetic-document'},pages)
    assert candidate['claims']['authority']['value']==issuer
    assert candidate['claims']['legal_entity']['value'] is None
    assert candidate['claims']['monetary_sanction']['value'] is None
    assert candidate['claims']['status']['value']=='unknown'


def test_independent_court_client_stops_at_403_without_retrying_or_reading_document():
    session=Session([Response(403)])
    client=AuthorityHttp('court_publications',lambda *a:None,lambda *a:None,session=session,sleep=lambda _:None)
    with pytest.raises(AccessFailure):client.get('https://www.domstol.se/synthetic.pdf')
    assert len(session.calls)==1 and session.calls[0][0].endswith('/robots.txt')


def test_source_halt_defers_later_documents(ready,tmp_path):
    _,cohort,_=ready
    path=tmp_path/'fetch.json'
    path.write_text(json.dumps({'schema_version':1,'documents':[
        {'source_id':'court_publications','source_url':'https://www.domstol.se/'+str(i)+'.pdf','expected_sha256':None} for i in (1,2)]}))
    calls=[]
    class Blocked:
        def __init__(self,*args):pass
        def get(self,url):calls.append(url);raise AccessFailure('http_403',halt=True)
        def close(self):pass
    report=collect(tmp_path/'blocked',cohort,path,http_factory=Blocked)
    assert len(calls)==1
    assert report['documents'][1]['status']=='deferred_source_halted'
    assert report['kkv_rankings_enabled'] is False


def test_changed_live_pinned_bytes_invalidate_old_review_context_without_new_claims(ready,tmp_path):
    _,cohort,_=ready
    old=pdf('Konkurrensverkets beslut. Diarienummer: 123/2025. Datum: 2025-01-01.')
    url='https://www.domstol.se/synthetic.pdf'
    path=manifest(tmp_path,old,source_id='court_publications',source_url=url)
    root=tmp_path/'changing'
    first=collect(root,cohort,path,local=True)['documents'][0]
    store=ReviewStore(root)
    before=store.context(first['candidate']['record_hash']);store.close()
    new=pdf('Corrected document bytes. No interpretation or finality is established.')
    fetch=tmp_path/'pinned.json'
    fetch.write_text(json.dumps({'schema_version':1,'documents':[{
        'source_id':'court_publications','source_url':url,'expected_sha256':sha256(old)}]}))
    class Changed:
        def __init__(self,source,attempt,robots):self.attempt=attempt
        def get(self,target):
            self.attempt(target,200,1,{'content-type':'application/pdf'},None)
            return target,200,{'content-type':'application/pdf'},new
        def close(self):pass
    report=collect(root,cohort,fetch,http_factory=Changed)
    assert report['documents'][0]['error_code']=='document_hash_changed_requires_review'
    store=ReviewStore(root)
    try:
        assert store.current('court_publications',url)[3]==sha256(new)
        assert store.context(first['candidate']['record_hash'])!=before
        assert len(store.current_records())==1
        assert store.summary()['publication_eligible']==0
    finally:store.close()


def test_search_receipts_keep_candidate_discovery_separate_from_verified_matches(ready,tmp_path):
    _,cohort,_=ready
    plan=search_plan(cohort)
    assert len({q['company_id'] for q in plan['queries']})==50
    assert len(plan['queries'])==100
    research=tmp_path/'research';research.mkdir()
    body=('BESLUT (https://www.konkurrensverket.se/synthetic.pdf)\nDnr 123/2025. '
        'Synthetic Example AB mentioned as a competitor, not a sanctioned party.')
    (research/'batch.txt').write_text(body)
    (research/'batch.json').write_text(json.dumps({'engine':'web.search','executed_at':'2026-01-01T00:00:00Z',
        'queries':plan['queries'][:2],'response_file':'batch.txt',
        'hits':[{'url':'https://www.konkurrensverket.se/synthetic.pdf'}]}))
    report=search_coverage(cohort,research,tmp_path/'empty-evidence')
    assert report['companies_searched']==1 and report['queries_executed']==2
    assert report['identified_candidate_cases']==1
    assert report['verified_entity_matches']==0 and report['accessible_pdf_documents']==0
    assert report['index_case_candidates'][0]['legal_status'] is None
    assert report['kkv_rankings_enabled'] is False
