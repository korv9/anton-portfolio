"""Operational handoffs must never manufacture a human approval or a public legal release."""
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from compliance_intelligence.completion import fenced, prepare, publish_progress
from compliance_intelligence.sources import seal, verify
from test_phase5 import prepared
from test_phase4 import ready


def test_real_pipeline_handoff_is_bound_to_artifacts_and_remains_pending(prepared,tmp_path):
    root,release,cohort,analytics,staged,approval,record=prepared
    destination=tmp_path/'handoff'
    result=prepare(root,cohort,destination)
    assert result['cohort_size']==50 and result['public_legal_release_written'] is False
    verify(destination)
    progress=json.loads((destination/'progress.json').read_text(encoding='utf-8'))
    assert progress['cohort']['selected_count']==50
    final=json.loads((destination/'final-review-template.json').read_text(encoding='utf-8'))
    assert final['stage_manifest_sha256']==result['stage_manifest_sha256']
    assert final['disposition']=='pending' and final['reviewer_id'] is None
    assert final['human_attestation'] is False and final['examined_evidence'] is False
    requests=json.loads((destination/'record-review-templates.json').read_text(encoding='utf-8'))
    assert requests and all(r['human_attestation'] is False and r['reviewer_id'] is None for r in requests)
    packet=(destination/'REVIEW.md').read_text(encoding='utf-8')
    assert 'not legal findings' in packet and 'Document SHA-256:' in packet


def test_progress_rejects_private_fields_even_in_a_resealed_bundle(prepared,tmp_path,monkeypatch):
    from compliance_intelligence import completion
    root,_,cohort,*_=prepared
    bundle=tmp_path/'handoff'
    prepare(root,cohort,bundle)
    monkeypatch.setattr(completion,'REPO',tmp_path)
    result=publish_progress(bundle)
    assert result['public_legal_release_written'] is False
    public=tmp_path/'frontend/public/data/compliance/progress.json'
    value=json.loads(public.read_text(encoding='utf-8'))
    assert 'companies' not in value and 'records' not in value
    source=bundle/'progress.json'
    value['private_quote']='Do not publish unreviewed document text'
    source.write_text(json.dumps(value),encoding='utf-8');seal(bundle)
    with pytest.raises(ValueError,match='invalid_public_progress'):
        publish_progress(bundle)


def test_document_markup_cannot_close_its_review_packet_fence():
    value='```\n# forged approval\n``````'
    rendered=fenced(value)
    assert rendered.startswith('```````text\n') and rendered.endswith('\n```````\n')
