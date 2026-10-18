"""Job text is evidence, never executable markup or a suitability judgement."""
from datetime import datetime, timezone
import copy
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from publish.job_content import active, detail, instant, package, public_text, public_url, requirements
from publish.job_companies import project, publish, validate_workspace
from compliance_intelligence.explorer import PRESENTATION_FILES
from compliance_intelligence.sources import new_output
from test_job_companies import ad, bundle


def test_original_text_fidelity_and_separate_interpretation():
    a = ad()
    original = 'Arbetsuppgifter\nDu kommer att utveckla system.\nKrav:\nPython och SQL\nMeriterande:\nAzure\n\nErfarenhet av React nämns här.'
    a['description'] = {'text': original, 'text_formatted': '<script>untrusted()</script>'}
    text, origin, count = public_text(a)
    assert text == original and origin == 'description.text' and count == 0
    rows = requirements(text, a)['requirements']
    assert any(r['label'] == 'SQL' and r['strength'] == 'required' for r in rows)
    assert any(r['label'] == 'Azure' and r['strength'] == 'preferred' for r in rows)
    assert all(r['quote'] in original.splitlines()[r['line']-1] for r in rows if r['line'])


def test_publication_review_fingerprint_covers_new_company_surfaces():
    expected = ['../companies/CompanyDeepDive.tsx', '../job-intelligence/JobIntelligence.tsx',
                '../job-intelligence/model.ts', '../job-intelligence/workspace.css']
    gate = Path(__file__).resolve().parents[3] / 'scripts/check_compliance_release.mjs'
    assert set(expected).issubset(PRESENTATION_FILES)
    assert all(name in gate.read_text(encoding='utf-8') for name in PRESENTATION_FILES)


def test_private_staging_retries_only_bounded_windows_handle_locks(tmp_path,monkeypatch):
    import compliance_intelligence.sources as sources
    original=Path.rename
    attempts=[]
    pauses=[]
    def transient(path,target):
        attempts.append(target)
        if len(attempts)<3:
            error=PermissionError('Synthetic Windows sharing lock');error.winerror=32
            raise error
        return original(path,target)
    monkeypatch.setattr(Path,'rename',transient)
    monkeypatch.setattr(sources.time,'sleep',pauses.append)
    with new_output(tmp_path/'complete') as stage:
        (stage/'evidence.txt').write_text('Synthetic source evidence')
    assert (tmp_path/'complete/evidence.txt').read_text()=='Synthetic source evidence'
    assert len(attempts)==3 and pauses==[.1,.2]
    with pytest.raises(ValueError,match='cannot be replaced'):
        with new_output(tmp_path/'complete'): pass
    assert len(attempts)==3


def test_private_staging_does_not_suppress_permanent_access_failure(tmp_path,monkeypatch):
    import compliance_intelligence.sources as sources
    attempts=[]
    def denied(path,target):
        attempts.append(target)
        error=PermissionError('Synthetic permanent Windows denial');error.winerror=5
        raise error
    monkeypatch.setattr(Path,'rename',denied)
    monkeypatch.setattr(sources.time,'sleep',lambda _:None)
    with pytest.raises(PermissionError):
        with new_output(tmp_path/'denied') as stage:
            (stage/'evidence.txt').write_text('Synthetic source evidence')
    assert len(attempts)==4 and not (tmp_path/'denied').exists()


@pytest.mark.parametrize('text', ['Python nämns här.', 'Python är inget krav.', 'Python is not required.'])
def test_unqualified_or_negated_mentions_are_not_requirements(text):
    rows = requirements(text, {})['requirements']
    assert rows and all(r['strength'] == 'ambiguous' for r in rows)


def test_explicit_experience_degree_and_management_are_extracted_with_original_evidence():
    text='Minst fem års erfarenhet krävs.\nPhD required.\nDu har personalansvar.'
    rows=requirements(text,{})['requirements']
    for category,quote in [('experience','Minst fem års erfarenhet krävs.'),('education','PhD required.'),('conditions','Du har personalansvar.')]:
        assert any(r['category']==category and r['strength']=='required' and r['quote']==quote for r in rows)


def test_data_platform_vocabulary_and_plus_years_keep_exact_requirement_evidence():
    labels=['PySpark','Delta Lake','dbt','DuckDB','Parquet','ETL/ELT','REST API','Databricks Workflows','data modeling','NLP','UMAP','HDBSCAN','sentence-transformers','MLflow','DAX','Microsoft Fabric','Cloudflare','GitHub Actions']
    text='Krav:\n'+', '.join(labels)+'\nAt least 5+ years experience.'
    rows=requirements(text,{})['requirements']
    assert set(labels).issubset({r['label'] for r in rows if r['strength']=='required'})
    assert any(r['category']=='experience' and r['strength']=='required' and r['quote']=='At least 5+ years experience.' for r in rows)


def test_contact_redactions_are_disclosed_and_html_is_never_executable():
    a = ad()
    a['description'] = {'text_formatted': '<p>Krav: Python</p><img src=x onerror=alert(1)><script>secret()</script><iframe>hidden</iframe><p>Skriv till private@example.invalid eller +46 70 123 45 67. Anna Test hjälper dig.</p>'}
    a['application_contacts'] = [{'name':'Anna Test'}]
    text, origin, count = public_text(a)
    assert origin.endswith('as_text') and count == 3
    assert all(x not in text for x in ('private@', 'Anna Test', '<img', 'secret()', 'hidden', 'onerror'))
    assert 'Krav: Python' in text


def test_contact_names_do_not_remove_parts_of_ordinary_words():
    a=ad();a['description']={'text':'Annan utbildning är också relevant. Kontakta Anna för frågor.'}
    a['application_contacts']=[{'name':'Anna'}]
    text,_,count=public_text(a)
    assert text.startswith('Annan utbildning är också relevant.') and count==1


@pytest.mark.parametrize('url', ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com',
    'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a', 'https://example.com\\@localhost', 'https://example.com:444/a'])
def test_application_links_reject_unsafe_urls(url):
    assert public_url(url) is None


def test_active_sweden_legacy_taxonomy_expiry_and_missing_fields():
    at = datetime(2026,10,17,12,tzinfo=timezone.utc)
    assert active(ad(), at)
    assert active({**ad(), 'workplace_address':{'country_code':'199'}}, at)
    assert not active({**ad(), 'workplace_address':{'country_code':'185'}}, at)
    assert not active({**ad(), 'removed':True}, at)
    assert not active({**ad(), 'application_deadline':'2026-10-16'}, at)
    assert active({**ad(), 'application_deadline':'2026-10-17'}, at)
    assert instant('2026-10-17T14:00:00') == at
    d = detail(ad(), {'job_id':'0','document_hash':'a'*64,'source_url':'https://example.invalid/ad'})
    assert d['salary'] is None and d['application_url'] is None and d['description_text'] == ''


def test_latest_50_stable_order_bound_hash_and_lazy_publication(tmp_path,monkeypatch):
    collection, database, registry = bundle(tmp_path)
    data = project(collection, database, registry, tmp_path/'resolved')
    content = json.loads((tmp_path/'resolved/workspace.json').read_text())
    validate_workspace(content, data)
    cards = [{**data['jobs'][0], 'job_id':f'{i:03}', 'publication_date':'2026-10-17T12:00:00'} for i in range(60)]
    ads = [{**ad(i), 'id':c['job_id']} for i,c in enumerate(cards)]
    result = package(ads, list(reversed(cards)), data['generated_at'], data['valid_until'], data['registry_hash'])
    assert [r['job_id'] for r in result['jobs']] == [f'{i:03}' for i in range(50)]
    rest = package(ads, list(reversed(cards)), data['generated_at'], data['valid_until'], data['registry_hash'], remaining=True)
    assert [r['job_id'] for r in rest['jobs']] == [f'{i:03}' for i in range(50,60)]
    bad = copy.deepcopy(content); bad['jobs'][0]['document_hash'] = 'f'*64
    with pytest.raises(ValueError, match='provenance'): validate_workspace(bad, data)
    bad = copy.deepcopy(content); bad['generated_at'] = '2020-01-01'
    with pytest.raises(ValueError, match='bound'): validate_workspace(bad, data)
    monkeypatch.setattr('publish.job_companies.ROOT',tmp_path)
    with pytest.raises(ValueError,match='workspace test path'):
        publish(tmp_path/'resolved',tmp_path/'outside/company-intelligence.json')
    destination=tmp_path/'tmp/published'
    publish(tmp_path/'resolved',destination/'company-intelligence.json')
    assert (destination/'workspace.json').exists()
    assert (destination/'workspace-remaining.json').exists()
