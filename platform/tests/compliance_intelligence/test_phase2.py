"""Synthetic authority responses only; these tests never call public services."""
import io
import json
import sys
from pathlib import Path

import duckdb
import pytest
import requests
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from compliance_intelligence.authority_http import AccessFailure, AuthorityHttp, Robots  # noqa: E402
from compliance_intelligence.authority_sources import SOURCES, extract, observations, official_url  # noqa: E402
from compliance_intelligence.decision_ingest import Store, company_mentions, copy_permission, ingest  # noqa: E402
from compliance_intelligence.sources import ingest_local  # noqa: E402
from compliance_intelligence.cohort import build_cohort, verify_cohort  # noqa: E402
from lib.rawstore import sha256  # noqa: E402
from test_phase1 import REVIEW, alias, number, relation, rows, snapshot, write_local  # noqa: E402


def html(body, meta=""):
    return ("<html><head>" + meta + "</head><body><nav>Unrelated AB</nav><main>" + body + "</main></body></html>").encode()


def listing(source="imy", records=1, next_page=False):
    if source == "imy":
        links = ''.join(f'<p><a href="/tillsyner/record-{i}/">Synthetic Case {i} AB</a></p>' for i in range(records))
        return html('<h1>Index</h1><div class="imy-contentpage__main-content"><h2 id="2026">2026</h2>' + links + '</div>')
    return html('<h1>Competition cases</h1><a href="/konkurrens/tillsyn-arenden-och-beslut/arendelista/test/">Synthetic AB</a>'
                + ('<a rel="next" href="?page=1">2</a>' if next_page else '')
                + 'Visar sökresultat 1-1 av ' + ('2' if next_page else '1'))


def pdf_bytes(text="", encrypted=False):
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'),
                             NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
    content = DecodedStreamObject()
    content.set_data(('BT /F1 12 Tf 30 700 Td (' + text + ') Tj ET').encode())
    page[NameObject('/Contents')] = writer._add_object(content)
    if encrypted:
        writer.encrypt("not-for-access")
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


class Response:
    def __init__(self, status=200, body=b"", headers=None):
        self.status_code, self.body = status, body
        self.headers = headers or {"Content-Type": "text/html", "ETag": '"fixture"'}

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def iter_content(self, size):
        yield self.body


class Session:
    def __init__(self, responses):
        self.responses, self.calls, self.headers = list(responses), [], {}

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        assert kwargs['allow_redirects'] is False
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def close(self):
        pass


ROBOTS = Response(body=b"User-agent: *\nDisallow: /*?query=\nDisallow: /*&query=\n", headers={"Content-Type": "text/plain"})


def http_fixture(responses):
    sessions = []

    def factory(source, attempt, robots):
        session = Session(responses)
        sessions.append(session)
        return AuthorityHttp(source, attempt, robots, session=session, sleep=lambda _: None)
    return factory, sessions


@pytest.mark.parametrize("url,allowed", [
    ("https://www.imy.se/tillsyner/?page=2", True),
    ("https://www.imy.se/sok/?query=brand", False),
    ("https://www.imy.se/sok/?page=1&query=brand", False),
    ("https://www.imy.se/sok/?%71uery=brand", False),
])
def test_imy_robots_wildcards(url, allowed):
    assert Robots(ROBOTS.body.decode()).allowed(url) is allowed


def test_robots_specific_group_and_allow_precedence():
    rules = Robots("User-agent: *\nDisallow: /\nUser-agent: anton-portfolio-ingest\nDisallow: /private\nAllow: /private/public\nCrawl-delay: 4")
    assert rules.allowed('https://www.imy.se/public')
    assert not rules.allowed('https://www.imy.se/private/a')
    assert rules.allowed('https://www.imy.se/private/public/a')
    assert rules.delay == 4


@pytest.mark.parametrize("url", ["http://www.imy.se/", "https://evil.invalid/", "https://www.imy.se.evil.invalid/", "https://a:b@www.imy.se/", "https://www.imy.se:444/"])
def test_official_origin_only(url):
    with pytest.raises(ValueError):
        official_url("imy", url)


def test_retry_backoff_and_conditional_headers():
    events, sleeps = [], []
    session = Session([ROBOTS, Response(503), Response(429, headers={"Retry-After": "7"}), Response(body=b"ok")])
    client = AuthorityHttp("imy", lambda *e: events.append(e), lambda *e: None,
                           session=session, sleep=sleeps.append)
    assert client.get(SOURCES['imy']['seed'], {"If-None-Match": '"old"'})[-1] == b"ok"
    assert [e[1] for e in events] == [200, 503, 429, 200]
    assert 2 in sleeps and 7 in sleeps
    assert session.calls[-1][1]['headers']['If-None-Match'] == '"old"'


def test_retry_after_does_not_wait_past_operator_window():
    session = Session([ROBOTS, Response(429, headers={"Retry-After": "3600"})])
    client = AuthorityHttp("imy", lambda *e: None, lambda *e: None, session=session, sleep=lambda _: None)
    with pytest.raises(AccessFailure, match="retry_after_requires_later_run"):
        client.get(SOURCES['imy']['seed'])
    assert len(session.calls) == 2


@pytest.mark.parametrize("response", [Response(403), Response(404), Response(body=b"<html>challenge</html>")])
def test_robots_fails_closed(response):
    session = Session([response])
    client = AuthorityHttp("imy", lambda *e: None, lambda *e: None, session=session, sleep=lambda _: None)
    with pytest.raises(AccessFailure):
        client.get(SOURCES['imy']['seed'])
    assert len(session.calls) == 1


def test_redirect_checked_before_request():
    session = Session([ROBOTS, Response(302, headers={"Location": "/sok/?query=blocked"})])
    client = AuthorityHttp("imy", lambda *e: None, lambda *e: None, session=session, sleep=lambda _: None)
    with pytest.raises(AccessFailure, match="robots_disallowed"):
        client.get(SOURCES['imy']['seed'])
    assert len(session.calls) == 2


def test_network_retries_are_bounded_and_no_secret_error_text():
    events = []
    session = Session([requests.Timeout('sensitive body')] * 4)
    client = AuthorityHttp('imy', lambda *e: events.append(e), lambda *e: None, session=session, sleep=lambda _: None)
    with pytest.raises(AccessFailure, match='network_Timeout'):
        client.get(SOURCES['imy']['seed'])
    assert len(session.calls) == 4
    assert 'sensitive' not in str(events)


def test_list_adapters_pagination_dedup_and_layout_failure():
    imy = extract('imy', SOURCES['imy']['seed'], listing(records=2), 'text/html', 'listing')
    assert len(imy['links']) == 2
    kkv = extract('kkv', SOURCES['kkv']['seed'], listing('kkv', next_page=True), 'text/html', 'listing')
    assert {l['kind'] for l in kkv['links']} == {'listing', 'record'}
    body = html('<h1>Record</h1><a href="/a.pdf">a</a><a href="/a.pdf">again</a><a href="https://evil.invalid/b.pdf">external</a>')
    assert len(extract('kkv', SOURCES['kkv']['seed'] + '/test/', body, 'text/html', 'record')['links']) == 1
    with pytest.raises(ValueError, match='content missing'):
        extract('imy', SOURCES['imy']['seed'], b'<html>challenge</html>', 'text/html', 'listing')


def test_dates_evidence_multiple_cases_and_revision_candidates():
    p = observations([('page:1', 'Publicerad: 3 oktober 2026 Beslutsdatum: 2026-09-22 IMY-2025-1234 Synthetic Example AB rättelse')])
    assert p['publication_date'] == '2026-10-03'
    assert p['decision_date'] == '2026-09-22'
    assert p['case_reference'] == 'IMY-2025-1234'
    assert p['named_legal_entities'][0]['name'] == 'Synthetic Example AB'
    assert p['revision_markers'] and p['review_status'] == 'unreviewed'
    assert p['sanction_amount'] is None and p['appeal_status'] is None
    p = observations([('main', 'Publicerad: 2026-10-02 Publicerad: 2026-10-03 dnr 12/2025 dnr 13/2025 Senast uppdaterad: 2026-10-09')])
    assert p['publication_date'] is None and p['decision_date'] is None and p['case_reference'] is None
    assert len(p['case_references']) == 2


def test_unknown_dates_do_not_use_updated_date_or_url_year():
    p = extract('imy', 'https://www.imy.se/tillsyner/test/', html('<h1>Synthetic AB</h1>Senast uppdaterad: 2 oktober 2026'), 'text/html', 'record')
    assert p['decision_date'] is None and p['publication_date'] is None
    assert not any(m['name'] == 'Unrelated AB' for m in p['named_legal_entities'])


def test_pdf_text_scans_encryption_and_imy_decision_header():
    url = 'https://www.imy.se/globalassets/dokument/beslut/test.pdf'
    content = pdf_bytes('Integritetsskyddsmyndighetens beslut Diarienummer: IMY-2025-1234 Datum: 2026-09-22')
    p = extract('imy', url, content, 'application/pdf', 'document')
    assert p['decision_date'] == '2026-09-22' and p['publication_date'] is None
    assert p['field_evidence'][0]['locator'] == 'page:1; header:Datum'
    assert extract('imy', url, pdf_bytes(), 'application/pdf', 'document')['limitations'] == ['no_extractable_text_ocr_not_run']
    with pytest.raises(ValueError, match='Encrypted'):
        extract('imy', url, pdf_bytes(encrypted=True), 'application/pdf', 'document')


def test_revision_link_and_corrupt_document_are_reviewable_failures(tmp_path):
    record = html('<h1>Synthetic AB</h1><a href="/corrected.pdf">Rättat beslut ersätter tidigare dokument</a>')
    payload = extract('imy', 'https://www.imy.se/tillsyner/test/', record, 'text/html', 'record')
    assert payload['revision_link_candidates'][0]['relationship_status'] == 'candidate_requires_review'
    factory, _ = http_fixture([ROBOTS, Response(body=listing()), Response(body=record),
                              Response(body=b'%PDF-invalid', headers={'Content-Type': 'application/pdf'})])
    report = ingest(tmp_path / 'private', sources=('imy',), http_factory=factory)
    assert report['sources']['imy']['status'] == 'partial_failures'
    assert report['sources']['imy']['failures'][0]['error_code'].startswith('extraction_')
    assert report['sources']['imy']['failures'][0]['document_id'] is not None


def test_company_mentions_do_not_pair_names_numbers_or_follow_groups():
    data = rows(2)
    child, parent = ['se:orgnr:' + r['organization_number'] for r in data]
    snap = snapshot(data, aliases=[alias(child, 'Shared Brand AB'), alias(parent, 'Shared Brand AB')],
                    relationships=[relation(child, parent)])
    p = observations([('page:1', 'Beslutsdatum: 2026-10-16 ' + number(0) + ' Shared Brand AB')])
    mentions = company_mentions(p, snap)
    assert mentions[0]['company_id'] == child
    assert mentions[0]['candidate_ids'] == [child]
    assert mentions[1]['status'] == 'ambiguous'
    assert all(m['subject_role'] == 'contextual_mention' and m['attribution_scope'] == 'context_only' for m in mentions)
    p['decision_date'] = None
    assert company_mentions(p, snap)[0]['company_id'] is None


def test_idempotency_conditional_requests_versions_and_duplicate_blobs(tmp_path):
    root = tmp_path / 'private'
    body = html('<h1>Synthetic AB</h1><p>dnr 12/2025</p>')
    first, _ = http_fixture([ROBOTS, Response(body=listing()), Response(body=body)])
    a = ingest(root, sources=('imy',), http_factory=first)
    second, sessions = http_fixture([ROBOTS, Response(304), Response(304)])
    b = ingest(root, sources=('imy',), http_factory=second)
    assert b['sources']['imy']['unchanged'] == 2
    assert sessions[0].calls[-1][1]['headers']['If-None-Match'] == '"fixture"'
    third, _ = http_fixture([ROBOTS, Response(304), Response(body=html('<h1>Synthetic AB</h1>rättelse'))])
    c = ingest(root, sources=('imy',), http_factory=third)
    assert c['sources']['imy']['changed_versions'] == 1
    con = duckdb.connect(str(root / 'ingestion.duckdb'), read_only=True)
    assert con.execute('select count(*) from bronze.document_version').fetchone()[0] == 3
    assert con.execute('select count(*) from silver.document_extraction').fetchone()[0] == 3
    assert con.execute('select count(*) from bronze.document_version where storage_ref is not null').fetchone()[0] == 0
    assert con.execute('select count(*) from bronze.fetch where changed').fetchone()[0] == 1
    con.close()
    assert Path(a['report_path']).is_file() and Path(a['report_path']).with_name('coverage.parquet').is_file()
    assert a['cohort_size'] is None
    store = Store(tmp_path / 'copy-store')
    review = {**REVIEW, 'terms_url': SOURCES['imy']['terms'], 'rationale': 'Synthetic test review',
              'allowed_prefixes': ['https://www.imy.se/globalassets/']}
    store.accept('imy', 'https://www.imy.se/globalassets/a.pdf', {'content-type': 'application/pdf'}, b'fixture')
    doc1, _ = store.accept('imy', 'https://www.imy.se/globalassets/a.pdf', {'content-type': 'application/pdf'}, b'fixture', review)
    doc2, _ = store.accept('imy', 'https://www.imy.se/globalassets/b.pdf', {'content-type': 'application/pdf'}, b'fixture', review)
    assert doc1 != doc2
    assert len(list((store.root / 'bronze/blobs').iterdir())) == 1
    assert store.execute('select storage_ref from bronze.document_version where document_id=?', [doc1]).fetchone()[0] is not None
    store.close()


def test_403_halts_source_and_report_records_failure(tmp_path):
    factory, sessions = http_fixture([ROBOTS, Response(403)])
    report = ingest(tmp_path / 'private', sources=('kkv',), http_factory=factory)
    assert report['sources']['kkv']['status'] == 'blocked_access'
    assert report['sources']['kkv']['failures'][0]['error_code'] == 'http_403'
    assert len(sessions[0].calls) == 2


def test_batch_limits_and_silver_provenance(tmp_path):
    factory, sessions = http_fixture([ROBOTS, Response(body=listing(records=3)), Response(body=html('<h1>Synthetic AB</h1>'))])
    r = ingest(tmp_path / 'private', sources=('imy',), max_records=1, http_factory=factory)
    assert r['sources']['imy']['status'] == 'bounded_partial'
    assert r['sources']['imy']['discovery_counts']['deferred_batch_limit'] == 2
    assert len(sessions[0].calls) == 3


def test_pinned_batch_keeps_membership_and_compares_baseline_hashes(tmp_path):
    url = 'https://www.imy.se/tillsyner/record-1/'
    body = html('<h1>Synthetic AB</h1><a href="/unexpected.pdf">Another document</a>')
    manifest = tmp_path / 'batch.json'
    manifest.write_text(json.dumps({'schema_version': 1, 'resources': [
        {'source_id': 'imy', 'source_url': url, 'kind': 'record', 'document_hash': sha256(body)}]}))
    factory, sessions = http_fixture([ROBOTS, Response(body=body)])
    report = ingest(tmp_path / 'private', sources=('imy',), batch_manifest=manifest, http_factory=factory)
    result = report['sources']['imy']
    assert len(sessions[0].calls) == 2
    assert result['observations'][0]['source_url'] == url
    assert result['observations'][0]['baseline_hash_matches'] is True
    assert result['discovery_counts']['deferred_manifest_scope'] == 1
    assert report['configuration']['batch_manifest_sha256'] == sha256(manifest.read_bytes())


def test_cohort_scan_keeps_frozen_membership_and_zero_is_not_clearance(tmp_path):
    source, sidecar = write_local(tmp_path)
    registry = tmp_path / 'registry'
    ingest_local(source, sidecar, registry)
    cohort = tmp_path / 'cohort'
    before = build_cohort(registry, cohort, 'synthetic-v1')['membership_hash']
    factory, _ = http_fixture([ROBOTS, Response(body=listing()), Response(body=html('<h1>Synthetic AB</h1>'))])
    report = ingest(tmp_path / 'private', sources=('imy',), cohort=cohort, http_factory=factory)
    assert report['cohort_size'] == 50 and len(report['cohort_observations']) == 50
    assert all(r['search_status'] == 'partial_publication_scan' and r['coverage_fraction'] is None
               for r in report['cohort_observations'])
    assert verify_cohort(cohort)['membership_hash'] == before


def test_copy_permission_needs_scope_terms_and_review():
    entry = {**REVIEW, 'terms_url': SOURCES['imy']['terms'], 'rationale': 'Fixture review',
             'allowed_prefixes': ['https://www.imy.se/globalassets/']}
    assert copy_permission({'imy': entry}, 'imy', 'https://www.imy.se/globalassets/a.pdf') == entry
    assert copy_permission({'imy': entry}, 'imy', SOURCES['imy']['seed']) is None
    assert copy_permission(None, 'imy', SOURCES['imy']['seed']) is None
    with pytest.raises(ValueError):
        copy_permission({'imy': {**entry, 'terms_url': 'https://example.invalid/'}}, 'imy', SOURCES['imy']['seed'])


def test_private_boundary_and_invalid_bounds_fail_before_network(tmp_path):
    with pytest.raises(ValueError):
        ingest(tmp_path / 'unused', max_pages=0)
    with pytest.raises(ValueError, match='public'):
        Store(Path(__file__).resolve().parents[3] / 'warehouse' / 'compliance')
    assert not (tmp_path / 'unused').exists()
