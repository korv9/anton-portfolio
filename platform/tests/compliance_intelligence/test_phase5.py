"""Public explorer approval gates. All business data and human-role fixtures are synthetic."""
import json
import hashlib
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock

import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))

from compliance_intelligence.analytics import build  # noqa: E402
from compliance_intelligence.explorer import projection, promote, stage, withdraw, public_deadline, REPO  # noqa: E402
from compliance_intelligence.legal_review import ReviewStore  # noqa: E402
from compliance_intelligence.sources import seal  # noqa: E402
from test_phase4 import ready, add_publication  # noqa: F401, E402
from test_phase3 import ROSTER, request  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_public_target(tmp_path, monkeypatch):
    monkeypatch.setattr('compliance_intelligence.explorer.TARGET', tmp_path/'release.json')


@pytest.fixture
def prepared(ready,tmp_path):
    store,cohort,snap=ready
    record=add_publication(store,snap,final=True)
    release=tmp_path/'gold'
    store.export_gold(release)
    root=store.root
    store.close()
    analytics=tmp_path/'analytics'
    build(root,release,cohort,analytics)
    staged=tmp_path/'stage'
    result=stage(root,release,cohort,analytics,staged,'test-preparer')
    current=datetime.now(timezone.utc)
    approval={'reviewer_id':'publisher-human','disposition':'approved','human_attestation':True,
        'examined_evidence':True,'privacy_cleared':True,'reuse_cleared':True,
        'rationale':'Synthetic fixture final projection and export review only',
        'reviewed_at':current.isoformat(),'valid_until':(current+timedelta(days=1)).isoformat(),
        'stage_manifest_sha256':result['stage_manifest_sha256']}
    return root,release,cohort,analytics,staged,approval,record


def test_staging_is_private_and_has_no_automatic_approval(prepared):
    _,_,_,_,directory,_,_=prepared
    metadata=json.loads((directory/'stage.json').read_text())
    payload=json.loads((directory/'payload.json').read_text())
    assert metadata['review_status']=='pending'
    assert sum(c['cohort_member'] for c in payload['companies'])==50
    assert len(payload['families'])==1
    f=payload['families'][0]
    assert f['administrative_sanctions']==1 and f['final_amounts']=={'SEK':'1800000.00'}
    assert f['legal_status']=='final'
    assert 'identity_review' not in str(payload)
    assert 'examined_evidence' not in str(payload)
    assert 'storage_ref' not in str(payload)


def test_final_review_promotion_and_cross_language_metric_reconciliation(prepared,tmp_path):
    root,release,cohort,analytics,directory,approval,_=prepared
    output=tmp_path/'release.json'
    promote(root,release,cohort,analytics,directory,approval,ROSTER,output)
    envelope=json.loads(output.read_text())
    assert envelope['state']=='approved' and 'reviewer_id' not in envelope['publication']
    # Browser arithmetic consumes the exact Python-reviewed projection, not a parallel fake dataset.
    script="""import fs from 'node:fs';
const m=await import(process.argv[1]);
const r=await m.parseRelease(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
const rows=m.summaries(r.payload,m.filtersOf(new URLSearchParams(),r.payload));
process.stdout.write(JSON.stringify(rows.map(r=>({id:r.id,sanctions:r.sanctions,amounts:r.finalAmounts}))));"""
    result=subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',script,
        (REPO/'frontend/src/compliance/model.ts').as_uri(),str(output)],capture_output=True,text=True,check=True)
    browser=json.loads(result.stdout)
    original=json.loads((analytics/'mart_compliance_company_summary.json').read_text())
    assert {r['id']:(r['sanctions'],r['amounts']) for r in browser} == {
        r['entity_id']:(r['confirmed_administrative_sanctions'],r['final_monetary_sanctions_by_currency']) for r in original}
    command=['node','--experimental-strip-types',str(REPO/'scripts/check_compliance_release.mjs'),str(output)]
    subprocess.run(command,capture_output=True,text=True,check=True)
    payload=json.loads(envelope['payload_json'])
    payload['presentation_sha256']='a'*64
    envelope['payload_json']=json.dumps(payload)
    envelope['publication']['payload_sha256']=hashlib.sha256(envelope['payload_json'].encode()).hexdigest()
    output.write_text(json.dumps(envelope),encoding='utf-8')
    rejected=subprocess.run(command,capture_output=True,text=True)
    assert rejected.returncode==1 and 'Presentation changed after final review' in rejected.stderr


@pytest.mark.parametrize('change',[
    {'reviewer_id':'service'}, {'reviewer_id':'test-preparer'}, {'privacy_cleared':False},
    {'reuse_cleared':False}, {'human_attestation':False}, {'disposition':'pending'},
    {'stage_manifest_sha256':'a'*64}, {'valid_until':'2020-01-01T00:00:00+00:00'},
    {'valid_until':'2099-01-01T00:00:00+00:00'},
])
def test_publication_fails_closed_without_exact_fresh_human_review(prepared,tmp_path,change):
    root,release,cohort,analytics,directory,approval,_=prepared
    roster={**ROSTER,'test-preparer':{'kind':'human','roles':['publication']}}
    with pytest.raises(ValueError):
        promote(root,release,cohort,analytics,directory,{**approval,**change},roster,tmp_path/'rejected.json')
    assert not (tmp_path/'rejected.json').exists()


def test_changed_staging_and_withdrawn_gold_block_publication(prepared,tmp_path):
    root,release,cohort,analytics,directory,approval,record=prepared
    path=directory/'payload.json'
    data=json.loads(path.read_text())
    data['families'][0]['administrative_sanctions']=99
    path.write_text(json.dumps(data),encoding='utf-8')
    seal(directory)
    with pytest.raises(ValueError,match='staged_projection_changed'):
        promote(root,release,cohort,analytics,directory,approval,ROSTER,tmp_path/'rejected.json')
    store=ReviewStore(root)
    try:
        store.review(request(store,record,'publication',actor='publisher-human',disposition='withdrawn'),ROSTER)
    finally:
        store.close()
    with pytest.raises(ValueError,match='release_approval_expired_revoked_or_stale'):
        projection(root,release,cohort,analytics)


def test_current_production_artifact_contains_no_mock_companies():
    data=json.loads((REPO/'frontend/public/data/compliance/release.json').read_text())
    assert data['schema_version']==1 and data['state'] in ('unavailable','approved')
    if data['state']=='unavailable':
        assert 'payload_json' not in data and 'companies' not in data
    else:
        assert data['publication']['review_status']=='approved'
        assert 'synthetic-phase' not in data['payload_json']
        assert 'Synthetic Fixture' not in data['payload_json']


def test_withdrawal_removes_the_public_projection(prepared,tmp_path):
    root,release,cohort,analytics,directory,approval,_=prepared
    output=tmp_path/'release.json'
    promote(root,release,cohort,analytics,directory,approval,ROSTER,output)
    withdraw(root,'review_withdrawn',output)
    assert json.loads(output.read_text())=={'schema_version':1,'state':'unavailable','reason':'review_withdrawn'}


def test_status_dependency_deadline_also_limits_publication():
    store=Mock()
    store.execute.return_value.fetchone.return_value=('court-record-hash',)
    store.actions.return_value={'legal':{'reverify_by':'2026-10-18'}}
    assert public_deadline(store,[{'reverify_by':'2026-12-01','subsequent_decisions':[{'record_id':'court'}]}])=='2026-10-18T00:00:00+00:00'
    store.actions.return_value={}
    with pytest.raises(ValueError,match='status_dependency_reverification_date_missing'):
        public_deadline(store,[{'reverify_by':'2026-12-01','subsequent_decisions':[{'record_id':'court'}]}])
