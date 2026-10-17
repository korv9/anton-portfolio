"""Private, explicitly listed public-document supplements; never fetch a blocked KKV host."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit
import uuid

from jsonschema import ValidationError
from pypdf.errors import PyPdfError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from compliance_intelligence.authority_http import AccessFailure, AuthorityHttp, MAX_BYTES
from compliance_intelligence.authority_sources import EXTRACTION_VERSION, observations, official_url, source_spec
from compliance_intelligence.cohort import verify_cohort
from compliance_intelligence.decision_ingest import company_mentions
from compliance_intelligence.legal_extraction import VERSION as LEGAL_VERSION, document_pages, extract_candidate
from compliance_intelligence.legal_review import ReviewStore, values
from compliance_intelligence.registry import name_key, relative_file
from compliance_intelligence.sources import load_snapshot, now, private_path, write_json
from lib.rawstore import sha256

LOG = logging.getLogger(__name__)
KKV_HOSTS = {'www.konkurrensverket.se', 'information.konkurrensverket.se', 'prod.konkurrensverket.se'}
VERSION = 'public-documents-v1:' + sha256(Path(__file__).read_bytes()+EXTRACTION_VERSION.encode()+LEGAL_VERSION.encode())[:20]


def stamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.utcoffset() is None or result.utcoffset().total_seconds() != 0 or result > datetime.now(timezone.utc):
        raise ValueError('invalid_utc_observation_time')
    return value


def document_url(source, url, *, local=False):
    parsed = urlsplit(url)
    if source == 'kkv' and local:
        if (parsed.scheme != 'https' or parsed.hostname not in KKV_HOSTS or parsed.username or parsed.password
                or parsed.port not in (None, 443) or parsed.fragment or any(c in url for c in '\r\n\\')):
            raise ValueError('invalid_official_document_reference')
        return url
    if source != 'court_publications':
        raise ValueError('automatic_collection_only_from_independent_court_publications')
    url = official_url(source, url)
    if not urlsplit(url).path.lower().endswith('.pdf'):
        raise ValueError('explicit_published_pdf_required')
    return url


def collect(root, cohort, manifest, *, local=False, max_documents=10, http_factory=AuthorityHttp):
    """Default retention is a stable reference/hash and excerpts, never an original copy."""
    if type(max_documents) is not int or not 1 <= max_documents <= 250:
        raise ValueError('invalid_document_bound')
    cohort_info = verify_cohort(cohort)
    snapshot = load_snapshot(cohort)
    manifest = Path(manifest)
    spec = json.loads(manifest.read_text(encoding='utf-8'))
    if set(spec) != {'schema_version', 'documents'} or spec['schema_version'] != 1 or not isinstance(spec['documents'], list):
        raise ValueError('invalid_public_document_manifest')
    if not spec['documents'] or len(spec['documents']) > max_documents:
        raise ValueError('manifest_exceeds_explicit_batch_bound')
    # Validate the whole manifest before any network call or database mutation.
    entries = []
    for entry in spec['documents']:
        required = {'source_id', 'source_url', 'expected_sha256'}
        if local: required |= {'local_file', 'acquired_at', 'acquired_by', 'public_download_without_bypass'}
        if set(entry) != required:
            raise ValueError('invalid_public_document_entry')
        url = document_url(entry['source_id'], entry['source_url'], local=local)
        digest = entry['expected_sha256']
        if digest is not None and not re.fullmatch('[a-f0-9]{64}', digest):
            raise ValueError('invalid_expected_document_hash')
        if local:
            if digest is None or entry['public_download_without_bypass'] is not True or not entry['acquired_by'].strip():
                raise ValueError('local_public_access_provenance_required')
            stamp(entry['acquired_at'])
            path = relative_file(manifest.parent, entry['local_file'])
            if not path.is_file() or path.stat().st_size > MAX_BYTES:
                raise ValueError('missing_or_oversized_local_document')
        entries.append({**entry, 'source_url': url})
    store = ReviewStore(root)
    run_id = str(uuid.uuid4())
    config = {'mode': 'local_public_import' if local else 'independent_court_documents', 'cohort': cohort_info,
        'manifest_sha256': sha256(manifest.read_bytes()), 'bounded_documents': len(entries), 'extraction_version': VERSION}
    store.execute('insert into bronze.ingestion_run values (?,?,null,?,null)', [run_id, now(), json.dumps(config)])
    clients, halted, results = {}, set(), []
    selected = {r['company_id'] for r in json.loads((Path(cohort)/'cohort.json').read_text(encoding='utf-8'))}
    last_attempt = {}
    def attempt(source, url, status, number, metadata, error):
        fetch_id = str(uuid.uuid4()); last_attempt[source] = fetch_id
        store.execute('insert into bronze.fetch values (?,?,?,?,?,?,?,?,null,null,null,?)',
            [fetch_id, run_id, source, url, now(), status, number, json.dumps(metadata), error])
    def robots(source, url, status, digest, rules):
        store.execute('insert into bronze.robots_observation values (?,?,?,?,?,?,?)',
            [run_id, source, url, now(), digest, status, json.dumps(rules)])
    try:
        for entry in entries:
            source, url = entry['source_id'], entry['source_url']
            if source in halted:
                results.append({'source_url': url, 'status': 'deferred_source_halted'}); continue
            try:
                if local:
                    body = relative_file(manifest.parent, entry['local_file']).read_bytes()
                    headers = {'content-type': 'application/pdf'}
                    access = {k: entry[k] for k in ('acquired_at', 'acquired_by', 'public_download_without_bypass')}
                else:
                    if source not in clients:
                        clients[source] = http_factory(source,
                            lambda *args, s=source: attempt(s, *args), lambda *args, s=source: robots(s, *args))
                    url, status, headers, body = clients[source].get(url)
                    document_url(source, url)
                    if status != 200: raise ValueError('document_not_returned')
                    access = {'method': 'robots_checked_public_http'}
                if len(body) > MAX_BYTES or not body.startswith(b'%PDF-'):
                    raise ValueError('original_pdf_required')
                mismatch = entry['expected_sha256'] and entry['expected_sha256'] != sha256(body)
                if mismatch and local:
                    raise ValueError('document_hash_changed_requires_review')
                # No private-copy approval is inferred from a download or an import attestation.
                document_id, previous = store.accept(source, url, headers, body)
                if not local:
                    store.execute('update bronze.fetch set document_id=?,previous_document_id=?,changed=? where fetch_id=?',
                        [document_id, previous, previous is not None and previous != document_id, last_attempt.get(source)])
                if mismatch:
                    # Verified live bytes supersede the old source version, but never its legal interpretation.
                    store.audit('pinned_document_bytes_changed', {'run_id':run_id,'document_id':document_id,
                        'previous_document_id':previous,'expected_sha256':entry['expected_sha256']})
                    raise ValueError('document_hash_changed_requires_review')
                pages = document_pages(body, 'application/pdf')
                if len(pages) > 250: raise ValueError('document_page_bound')
                payload = {**observations([('page:'+str(p), text) for p, text in pages.items()]),
                    'source_metadata': {'publication_host': source_spec(source)['authority'], 'access': access,
                        'supplement_extraction_version': VERSION},
                    'kind': 'document', 'links': [], 'revision_link_candidates': [],
                    'limitations': ['selected_document_supplement_not_a_complete_kkv_search']}
                store.save_extraction(document_id, payload, VERSION)
                mentions = company_mentions(payload, snapshot)
                for index, mention in enumerate(mentions):
                    store.execute('insert into silver.company_mention values (?,?,?,?,?,?,?) on conflict do nothing',
                        [run_id, document_id, index, mention['company_id'], json.dumps(mention['candidate_ids']),
                         json.dumps(mention, ensure_ascii=False), 'unreviewed'])
                matched = sorted(selected.intersection(i for m in mentions for i in m['candidate_ids']))
                candidate = None
                if any(text.strip() for text in pages.values()):
                    proposal = extract_candidate(store.document(document_id), pages)
                    candidate = store.add_candidate(proposal, pages, snapshot=snapshot, prepared_by='public-document-pipeline')
                store.audit('public_document_supplement', {'run_id': run_id, 'document_id': document_id,
                    'access': access, 'manifest_sha256': config['manifest_sha256'], 'extraction_version': VERSION})
                results.append({'source_url': url, 'document_id': document_id, 'document_hash': sha256(body),
                    'status': 'candidate' if candidate else 'held_no_text_ocr_not_run', 'candidate': candidate,
                    'candidate_cohort_company_ids': matched, 'attribution_scope': 'context_only',
                    'new_byte_version': previous != document_id})
            except (ValueError, OSError, PyPdfError, ValidationError) as exc:
                code = exc.code if isinstance(exc, AccessFailure) else str(exc)
                code = code if re.fullmatch('[a-z][a-z0-9_]{0,160}', code) else type(exc).__name__
                if isinstance(exc, AccessFailure) and exc.halt: halted.add(source)
                LOG.warning('document collection held source=%s code=%s', source, code)
                results.append({'source_url': url, 'status': 'held', 'error_code': code})
        report = {'schema_version': 1, 'run_id': run_id, 'finished_at': now(), **config, 'documents': results,
            'kkv_collection_status': 'unavailable_direct_access_blocked', 'kkv_rankings_enabled': False,
            'publication_approved': False, 'source_population_coverage_fraction': None}
        store.execute('update bronze.ingestion_run set finished_at=?,report=? where run_id=?',
            [report['finished_at'], json.dumps(report, ensure_ascii=False), run_id])
        target = relative_file(store.root, 'gold/runs/'+run_id+'/supplement-coverage.json')
        write_json(target, report)
        return report
    finally:
        for client in clients.values(): client.close()
        store.close()


def search_plan(cohort):
    info = verify_cohort(cohort)
    members = json.loads((Path(cohort)/'cohort.json').read_text(encoding='utf-8'))
    snapshot = load_snapshot(cohort)
    queries = []
    for c in members:
        aliases = [a['alias'] for a in snapshot['aliases'] if a['company_id'] == c['company_id'] and a['review_status'] == 'approved']
        n = c['organization_number']
        for value in dict.fromkeys([c['registered_legal_name'], n[:6]+'-'+n[6:], *aliases]):
            query = '"'+value.replace('"', ' ')+'" Konkurrensverket'
            queries.append({'company_id': c['company_id'], 'query': query})
    return {'schema_version': 1, 'cohort': info, 'queries': queries,
        'verified_historic_aliases': sum(a['alias_type']=='historic_name' and a['review_status']=='approved'
            and a['company_id'] in {c['company_id'] for c in members} for a in snapshot['aliases']),
        'limitations': ['Bounded public index discovery; no negative search or legal finding is implied.']}


def search_coverage(cohort, research, root):
    """Verify recorded search queries against the frozen plan, keeping discovery separate from evidence."""
    plan = search_plan(cohort)
    expected = {(q['company_id'], q['query']) for q in plan['queries']}
    executed, urls, receipts = set(), set(), []
    members = json.loads((Path(cohort)/'cohort.json').read_text(encoding='utf-8'))
    cases = {}
    for file in sorted(Path(research).glob('*.json')):
        batch = json.loads(file.read_text(encoding='utf-8'))
        if batch.get('engine') != 'web.search': continue
        stamp(batch['executed_at'])
        response = relative_file(file.parent, batch['response_file']).read_bytes()
        used = {(q['company_id'], q['query']) for q in batch['queries']}
        if not used <= expected: continue  # Earlier experimental queries are not counted as planned coverage.
        executed |= used
        receipts.append({'receipt': file.name, 'response_sha256': sha256(response), 'executed_at': batch['executed_at']})
        for hit in batch['hits']:
            url = hit['url']; p = urlsplit(url)
            if p.scheme == 'https' and (p.hostname in KKV_HOSTS or p.hostname in ('www.domstol.se', 'lagen.nu')):
                urls.add(url)
        # Index text establishes discovery only. It never supplies a reviewed legal claim.
        for block in response.decode('utf-8').split('--------------------------------------------------------------------------------'):
            lines = block.splitlines()
            if not lines: continue
            first = re.search(r'\((https://[^)]+)\)', lines[0])
            if not first: continue
            url = first[1]; parsed = urlsplit(url)
            if parsed.hostname not in KKV_HOSTS or '/rapporter' in parsed.path or 'rapportserie' in parsed.path:
                continue
            refs = sorted(set(re.findall(r'\b(?:Dnr|Diarienummer)\s*:?\s*(\d{1,6}/\d{4})', block, re.I)))
            candidates = [c['company_id'] for c in members if name_key(c['registered_legal_name']) in name_key(block)
                or c['organization_number'] in re.sub(r'(?<=\d)[- ](?=\d)', '', block)]
            for ref in refs:
                if candidates:
                    item = cases.setdefault(ref, {'case_reference': ref, 'source_urls': set(), 'candidate_company_ids': set(),
                        'attribution_scope': 'index_context_only', 'review_status': 'unreviewed', 'legal_status': None, 'sanction_amount': None})
                    item['source_urls'].add(url); item['candidate_company_ids'].update(candidates)
    store = ReviewStore(root)
    try:
        records = [r for r in store.current_records() if r['payload']['source_id'] in ('kkv','court_publications')]
        selected = {q['company_id'] for q in plan['queries']}
        matched = [r for r in records if r['identity']['status']=='verified' and r['identity']['company_id'] in selected]
        return {'schema_version': 1, 'observed_at': now(), 'cohort': plan['cohort'],
            'companies_searched': len({c for c, _ in executed}), 'queries_executed': len(executed),
            'queries_planned': len(expected), 'verified_historic_aliases': plan['verified_historic_aliases'],
            'discovered_urls': sorted(urls), 'search_receipts': receipts,
            'identified_candidate_cases': len(cases),
            'index_case_candidates': [{**c,'source_urls':sorted(c['source_urls']),'candidate_company_ids':sorted(c['candidate_company_ids'])} for c in cases.values()],
            'accessible_pdf_documents': store.execute("select count(distinct d.document_hash) from bronze.document_version d join silver.document_extraction e using(document_id) where lower(d.content_type) like '%pdf%' and d.source_id in ('kkv','court_publications')").fetchone()[0],
            'verified_entity_matches': len({r['identity']['company_id'] for r in matched}),
            'extraction_candidates': len(records), 'approved_for_publication': sum(not store.blockers(r['record_hash']) for r in records),
            'kkv_status': 'unavailable_direct_access_blocked', 'kkv_rankings_enabled': False,
            'source_population_coverage_fraction': None,
            'limitations': plan['limitations']+['Index snippets and number mentions are not reviewed party attribution.',
                'No verified historic alias supplement is currently available.', 'Court supplements do not replace the KKV diary.']}
    finally: store.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('fetch', 'import-local', 'plan', 'coverage'):
        cmd = sub.add_parser(name); cmd.add_argument('--cohort', type=Path, required=True)
        if name in ('fetch', 'import-local', 'coverage'): cmd.add_argument('--root', type=Path, required=True)
        if name in ('fetch', 'import-local'):
            cmd.add_argument('--manifest', type=Path, required=True); cmd.add_argument('--max-documents', type=int, default=10)
        if name in ('plan', 'coverage'): cmd.add_argument('--output', type=Path, required=True)
        if name=='coverage': cmd.add_argument('--research', type=Path, required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    if args.command in ('fetch', 'import-local'):
        result = collect(args.root, args.cohort, args.manifest, local=args.command=='import-local', max_documents=args.max_documents)
    else:
        result = search_plan(args.cohort) if args.command=='plan' else search_coverage(args.cohort,args.research,args.root)
        output = private_path(args.output)
        if output.exists(): raise ValueError('refuse_report_overwrite')
        write_json(output,result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if any(d['status'] != 'candidate' for d in result.get('documents',[])) else 0


if __name__ == '__main__':
    try: sys.exit(main())
    except (ValueError, OSError, TypeError, KeyError) as exc:
        code = str(exc) if type(exc) is ValueError else type(exc).__name__
        if not re.fullmatch('[a-zA-Z][a-zA-Z0-9_]{0,160}',code): code=type(exc).__name__
        LOG.error('Public document collection held: %s',code)
        sys.exit(2)
