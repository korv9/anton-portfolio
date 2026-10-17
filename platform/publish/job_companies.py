"""Publish an allowlisted current-ad view joined to the existing canonical company registry."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ingest/jobtech'))

import duckdb
from compliance_intelligence.cohort import insert_rows, populate_database
from compliance_intelligence.job_resolution import apply_reviews, resolve_employer
from compliance_intelligence.registry import encoded, organization_number
from compliance_intelligence.sources import (ScbClient, load_snapshot, new_output, now,
    private_path, seal, verify, write_json)
from weekly_jobs import collect
from lib.common import load_env
from lib.rawstore import sha256

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'frontend/public/data/jobs/company-intelligence.json'
CONTEXT_KINDS = ('financial', 'employees', 'corporate_events', 'contracts', 'technology', 'github', 'stock')


def safe_url(value):
    url = urlparse(str(value or ''))
    return bool(url.scheme == 'https' and url.hostname and not url.username and not url.password)


def percentage(matched, total):
    return float((Decimal(100)*matched/total).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)) if total else None


def project(collection_dir, database, registry_dir, output, *, reviews=None, reviewers=(), context=None):
    verify(collection_dir)
    collection = json.loads((Path(collection_dir) / 'collection.json').read_text(encoding='utf-8'))
    snapshot = load_snapshot(registry_dir) if registry_dir else {'schema_version': 1,
        'metadata': {'as_of_date': collection['collected_at'][:10], 'source_id': 'not_available'},
        'companies': [], 'aliases': [], 'relationships': [], 'conflicts': [], 'documents': []}
    registry_hash = sha256(encoded(snapshot))
    ads = []
    source_kinds = set()
    with duckdb.connect(str(database), read_only=True) as con:
        for version in collection['versions']:
            found = con.execute('select payload, source_kind from raw.job_ads where job_id=? and payload_hash=? limit 1',
                [version['job_id'], version['payload_hash']]).fetchone()
            if not found:
                raise ValueError('Pinned advertisement version is absent from raw.job_ads')
            ads.append(json.loads(found[0]))
            source_kinds.add(found[1])
    links, cards, observations = [], [], []
    hashes = {r['job_id']: r['payload_hash'] for r in collection['versions']}
    for ad in sorted(ads, key=lambda a: str(a['id'])):
        job_id = str(ad['id'])
        employer = ad.get('employer') or {}
        result = resolve_employer(snapshot, employer, on_date=ad['publication_date'][:10])
        link = {**result, 'job_id': job_id, 'relationship_type': 'advertised_employer',
            'original_employer_name': employer.get('name'), 'original_organization_number': employer.get('organization_number'),
            'workplace_name': employer.get('workplace'), 'job_payload_hash': hashes[job_id], 'registry_hash': registry_hash}
        links.append(link)
        published = ad['publication_date']
        datetime.fromisoformat(published)
        observations.append({'job_id': job_id, 'publication_date': published, 'payload_hash': hashes[job_id]})
        address = ad.get('workplace_address') or {}
        skills = (ad.get('must_have') or {}).get('skills', []) + (ad.get('nice_to_have') or {}).get('skills', [])
        url = ad.get('webpage_url') or f'https://arbetsformedlingen.se/platsbanken/annonser/{job_id}'
        if not safe_url(url):
            raise ValueError('Advertisement URL is not safe HTTPS')
        # Numbers rejected by the legal-person validator stay private, including sole-trader identifiers.
        try:
            public_number = organization_number(employer.get('organization_number') or '')
        except ValueError:
            public_number = None
        cards.append({'job_id': job_id, 'title': str(ad['headline']), 'employer_name': employer.get('name'),
            'organization_number': public_number, 'workplace_name': employer.get('workplace'),
            'location': address.get('municipality') or address.get('city') or address.get('country') or None,
            'technologies': sorted({s['label'] for s in skills if isinstance(s, dict) and s.get('label')}),
            'publication_date': published, 'application_deadline': ad.get('application_deadline'),
            'source_url': url, 'document_hash': hashes[job_id]})
    reviews = reviews or []
    links = apply_reviews(links, reviews, snapshot, reviewers, registry_hash)
    used = {l['company_id'] for l in links if l['company_id']}
    verified_ids = {c['company_id'] for c in snapshot['companies'] if c['identity_status'] == 'verified'}
    reached = set(used)
    # Context is opt-in, exact-ID and independently reviewed; no name, issuer or group fallback.
    facts = []
    for fact in context or []:
        if (fact['kind'] not in CONTEXT_KINDS or fact['company_id'] not in verified_ids
            or fact.get('review_status') != 'approved' or fact.get('reviewer_id') not in reviewers
            or not safe_url(fact.get('source_url')) or not re.fullmatch('[a-f0-9]{64}', fact.get('document_hash', ''))
            or fact.get('entity_scope') != 'legal_entity' or not fact.get('source_locator')):
            raise ValueError('Company context needs reviewed, directly attributed source evidence')
        verified = datetime.fromisoformat(fact['verified_at'])
        if verified.tzinfo is None or verified > datetime.now(timezone.utc):
            raise ValueError('Invalid context verification date')
        if fact['kind'] == 'stock' and (not fact.get('issuer_id') or not fact.get('country_code')):
            raise ValueError('Stock context requires a separate issuer identity and country')
        if not all(isinstance(fact.get(k), str) and fact[k].strip() for k in ('period', 'label', 'value')):
            raise ValueError('Company context requires a period, measure and textual value with explicit unit')
        facts.append({k: fact.get(k) for k in ('company_id', 'kind', 'period', 'label', 'value', 'unit',
            'source_url', 'document_hash', 'source_locator', 'verified_at', 'review_status', 'entity_scope',
            'issuer_id', 'country_code')})
        reached.add(fact['company_id'])
    while True:
        prior = set(reached)
        for r in snapshot['relationships']:
            if (r['company_id'] in verified_ids and r['related_company_id'] in verified_ids
                and (r['company_id'] in reached or r['related_company_id'] in reached)):
                reached.update((r['company_id'], r['related_company_id']))
        if reached == prior:
            break
    counts = Counter(l['match_status'] for l in links if l['relationship_type'] == 'advertised_employer')
    financial = {f['company_id'] for f in facts if f['kind'] == 'financial'}
    public_companies = [{k: c.get(k) for k in ('company_id', 'organization_number', 'registered_legal_name',
        'country_code', 'registry_authority', 'registry_number', 'primary_sni_code', 'sni_version',
        'employee_size_class', 'snapshot_date', 'source_url', 'document_hash', 'last_verified_at')}
        for c in snapshot['companies'] if c['company_id'] in reached]
    public_links = [{k: l[k] for k in ('job_id', 'company_id', 'relationship_type', 'match_method',
        'match_status', 'match_confidence', 'verified_at', 'job_payload_hash', 'registry_hash', 'evidence')}
        for l in links]
    # Human names, rationale and candidate suggestions belong in the private review queue.
    for link in public_links:
        link['evidence'] = [{k: e[k] for k in ('source_url', 'evidence_url', 'document_hash',
            'source_document_id', 'source_locator') if k in e} for e in link['evidence']]
    until = (datetime.fromisoformat(collection['collected_at']) + timedelta(days=2)).isoformat()
    payload = {'schema_version': 1, 'state': 'available', 'generated_at': collection['collected_at'],
        'valid_until': until, 'registry_hash': registry_hash,
        'coverage': {k: collection[k] for k in ('source_url', 'license_url', 'occupation_field_id',
            'occupation_field', 'window_start', 'window_end', 'query_timezone', 'coverage_status', 'limitations')},
        'metrics': {'total_active_it_ads': len(cards), 'verified_company_links': counts['verified'],
            'match_coverage_percentage': percentage(counts['verified'],len(cards)),
            'ambiguous_matches': counts['ambiguous'], 'unresolved_matches': counts['unresolved'],
            'review_required_matches': counts['review_required'], 'rejected_matches': counts['rejected'],
            'companies_with_financial_data': len(financial), 'companies_with_reviewed_compliance_coverage': None},
        'jobs': cards, 'links': public_links, 'companies': public_companies, 'context': facts,
        'relationships': [{**{k:r.get(k) for k in ('company_id','related_company_id','relationship_type','valid_from','valid_to')},
            **{k:next(d for d in snapshot['documents'] if d['document_id']==r['source_document_id'])[k]
               for k in ('source_url','document_hash')}}
            for r in snapshot['relationships'] if r['company_id'] in reached and r['related_company_id'] in reached]}
    validate(payload)
    with new_output(output) as stage:
        populate_database(stage / 'registry.duckdb', snapshot)
        with duckdb.connect(str(stage / 'registry.duckdb')) as con:
            con.execute(Path(__file__).parents[1].joinpath('compliance_intelligence/job_links.sql').read_text(encoding='utf-8'))
            insert_rows(con, 'job_observation', ('job_id', 'publication_date', 'payload_hash'), observations)
            insert_rows(con, 'company_registry_observation', ('company_id','snapshot_date','employee_size_class',
                'primary_sni_code','source_url','document_hash'), public_companies)
            insert_rows(con, 'company_context_fact', ('company_id','kind','period','label','value','unit',
                'issuer_id','country_code','source_url','document_hash','verified_at'), facts)
            rows = [{**l, 'match_evidence': encoded(l['evidence']).decode()} for l in links]
            insert_rows(con, 'job_company_link', ('job_id', 'company_id', 'relationship_type', 'match_method',
                'match_status', 'match_confidence', 'verified_at', 'original_employer_name', 'original_organization_number',
                'workplace_name', 'job_payload_hash', 'registry_hash', 'match_evidence'), rows)
            insert_rows(con, 'company_resolution_review', ('review_id', 'job_id', 'relationship_type', 'company_id',
                'job_payload_hash', 'registry_hash', 'disposition', 'reviewer_id', 'reviewed_at', 'evidence_url',
                'document_hash', 'source_locator', 'rationale'), reviews)
            for table in ('job_company_link', 'company_resolution_review', 'mart_company_hiring_daily','mart_company_hiring_context'):
                con.execute(f"copy compliance_intelligence.{table} to '{(stage / (table + '.parquet')).as_posix()}' (format parquet)")
        write_json(stage / 'public.json', payload)
        write_json(stage / 'review-queue.json', [l for l in links if l['match_status'] not in ('verified', 'rejected')])
        write_json(stage / 'audit.json', {'registry_hash': registry_hash, 'reviews': reviews,
            'source_kinds':sorted(source_kinds), 'source_id':collection.get('source_id'), 'source_url':collection['source_url'],
            'collection_manifest_hash': sha256(encoded(collection)), 'metrics': payload['metrics'],
            'resolution_version':'job-company-v1',
            'implementation_files': {p.relative_to(ROOT).as_posix():sha256(p.read_text(encoding='utf-8').encode('utf-8'))
                for p in [Path(__file__), ROOT/'platform/compliance_intelligence/job_resolution.py',
                    ROOT/'platform/compliance_intelligence/registry.py', ROOT/'platform/compliance_intelligence/sources.py',
                    ROOT/'platform/compliance_intelligence/job_links.sql', ROOT/'platform/compliance_intelligence/schema.sql',
                    ROOT/'platform/compliance_intelligence/cohort.py', ROOT/'platform/compliance_intelligence/policy.json',
                    ROOT/'platform/ingest/jobtech/weekly_jobs.py', ROOT/'platform/ingest/jobtech/ingest_jobs.py']}})
        seal(stage)
    return payload


def validate(payload):
    if payload.get('schema_version') != 1:
        raise ValueError('Unsupported job/company schema')
    if payload.get('state') == 'unavailable':
        return
    if payload.get('state') != 'available':
        raise ValueError('Invalid job/company state')
    generated = datetime.fromisoformat(payload['generated_at'])
    until = datetime.fromisoformat(payload['valid_until'])
    if (generated.tzinfo is None or until.tzinfo is None or generated > datetime.now(timezone.utc)
        or not timedelta(0) < until-generated <= timedelta(days=2)):
        raise ValueError('Invalid job release observation/expiry dates')
    ids = {c['company_id'] for c in payload['companies']}
    if len(ids) != len(payload['companies']):
        raise ValueError('Duplicate company')
    for c in payload['companies']:
        expected = ('se:orgnr:' + organization_number(c['organization_number'])) if c['country_code'] == 'SE' else (
            c['country_code'].lower() + ':' + quote(c['registry_authority'],safe='') + ':' + quote(c['registry_number'],safe=''))
        if (c['company_id'] != expected or not safe_url(c['source_url'])
            or not re.fullmatch('[a-f0-9]{64}', c['document_hash'])):
            raise ValueError('Invalid company identity or source')
    jobs = {j['job_id']: j for j in payload['jobs']}
    if len(jobs) != len(payload['jobs']):
        raise ValueError('Duplicate job')
    for j in jobs.values():
        if not safe_url(j['source_url']) or not re.fullmatch('[a-f0-9]{64}', j['document_hash']):
            raise ValueError('Invalid advertisement source')
    seen = set()
    for l in payload['links']:
        key = l['job_id'], l['relationship_type']
        if key in seen or l['job_id'] not in jobs or l['job_payload_hash'] != jobs[l['job_id']]['document_hash']:
            raise ValueError('Duplicate, dangling or mismatched job link')
        seen.add(key)
        if (l['relationship_type'] not in ('advertised_employer','recruiter','actual_employer')
            or l['match_status'] not in ('verified','ambiguous','unresolved','review_required','rejected')
            or l['registry_hash'] != payload['registry_hash']
            or not isinstance(l['match_confidence'], (int,float)) or not 0 <= l['match_confidence'] <= 1):
            raise ValueError('Invalid relationship state, method or registry version')
        if l['match_status'] == 'verified':
            if l['company_id'] not in ids or not l['verified_at'] or not l['evidence']:
                raise ValueError('Verified link lacks identity evidence')
            if l['match_method'] == 'exact_organization_number' and l['company_id'] != 'se:orgnr:' + str(jobs[l['job_id']]['organization_number']):
                raise ValueError('Exact number link contradicts original employer identity')
            for evidence in l['evidence']:
                if (not safe_url(evidence.get('source_url') or evidence.get('evidence_url'))
                    or not re.fullmatch('[a-f0-9]{64}', evidence.get('document_hash',''))
                    or not evidence.get('source_locator')):
                    raise ValueError('Invalid match evidence')
        elif l['company_id'] is not None or l['verified_at'] is not None:
            raise ValueError('Unverified link must not expose company data')
    if {k[0] for k in seen if k[1] == 'advertised_employer'} != set(jobs):
        raise ValueError('Every ad requires an explicit resolution state')
    counts = Counter(l['match_status'] for l in payload['links'] if l['relationship_type'] == 'advertised_employer')
    m = payload['metrics']
    if m['total_active_it_ads'] != len(jobs) or m['verified_company_links'] != counts['verified']:
        raise ValueError('Coverage does not reconcile')
    for status in ('ambiguous','unresolved','review_required','rejected'):
        if m[status+'_matches'] != counts[status]:
            raise ValueError('Resolution states do not reconcile')
    expected = percentage(counts['verified'],len(jobs))
    if m['match_coverage_percentage'] != expected:
        raise ValueError('Match percentage does not reconcile')
    for fact in payload['context']:
        if (fact['kind'] not in CONTEXT_KINDS or fact['company_id'] not in ids
            or fact['review_status'] != 'approved' or fact['entity_scope'] != 'legal_entity'
            or not safe_url(fact['source_url']) or not re.fullmatch('[a-f0-9]{64}',fact['document_hash'])):
            raise ValueError('Invalid context provenance')


def publish(bundle, target=PUBLIC):
    verify(bundle)
    data = json.loads((Path(bundle) / 'public.json').read_text(encoding='utf-8'))
    validate(data)
    if datetime.fromisoformat(data['valid_until']) <= datetime.now(timezone.utc):
        raise ValueError('Job release expired; refresh before publication')
    target = Path(target).resolve()
    if target != PUBLIC.resolve() and not target.is_relative_to(ROOT / 'tmp'):
        raise ValueError('Public output must be the designated job dataset or a workspace test path')
    if target == PUBLIC.resolve():
        audit = json.loads((Path(bundle)/'audit.json').read_text(encoding='utf-8'))
        if (audit['source_kinds'] not in (['live'], []) or audit['source_id'] != 'jobtech_jobsearch'
            or audit['source_url'] != 'https://jobsearch.api.jobtechdev.se/search'):
            raise ValueError('Production jobs require the official live JobSearch source; fixture/historical batches are withheld')
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.pending')
    temporary.write_bytes(encoded(data))
    temporary.replace(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    refresh = commands.add_parser('refresh')
    refresh.add_argument('--output')
    refresh.add_argument('--registry')
    refresh.add_argument('--identities')
    refresh.add_argument('--reviews')
    refresh.add_argument('--reviewers', help='JSON list of authorized human reviewer IDs')
    refresh.add_argument('--context')
    refresh.add_argument('--days', type=int, default=7)
    refresh.add_argument('--publish', action='store_true')
    resolve = commands.add_parser('resolve', help='Rebuild from pinned private inputs, optionally applying human reviews')
    for name in ('collection', 'database', 'output'):
        resolve.add_argument('--'+name, required=True)
    for name in ('registry', 'reviews', 'reviewers', 'context'):
        resolve.add_argument('--'+name)
    resolve.add_argument('--publish', action='store_true')
    lookup = commands.add_parser('lookup', help='SCB lookup of legal organization numbers only')
    lookup.add_argument('--numbers', required=True, help='Private JSON array of organization numbers')
    lookup.add_argument('--output', required=True)
    lookup.add_argument('--identities')
    check = commands.add_parser('check')
    check.add_argument('--file', default=str(PUBLIC))
    args = parser.parse_args()
    load_env()
    read = lambda p: json.loads(Path(p).read_text(encoding='utf-8-sig')) if p else []
    if args.command == 'check':
        validate(json.loads(Path(args.file).read_text(encoding='utf-8')))
        print('Job/company contract valid')
        return
    if args.command == 'lookup':
        snapshot = ScbClient().lookup(read(args.numbers), args.output, identities_file=args.identities)
        print(json.dumps({'companies':len(snapshot['companies']), 'excluded':len(snapshot['exclusions']),
            'conflicts':len(snapshot['conflicts']), 'not_found':len(snapshot['metadata']['not_found'])}))
        return
    if args.command == 'resolve':
        data = project(args.collection, args.database, args.registry, args.output,
            reviews=read(args.reviews), reviewers=read(args.reviewers), context=read(args.context))
        if args.publish:
            publish(args.output)
        print(json.dumps(data['metrics'], indent=2))
        return
    output = private_path(args.output or ROOT / '.research/job-company' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    output.mkdir(parents=True, exist_ok=False)
    database = output / 'job-market.duckdb'
    collection = collect(output / 'collection', database, days=args.days)
    registry = args.registry
    if not registry and os.environ.get('SCB_API_KEY'):
        with duckdb.connect(str(database), read_only=True) as con:
            numbers = []
            for row in con.execute("select json_extract_string(payload,'$.employer.organization_number') from raw.job_ads").fetchall():
                try:
                    numbers.append(organization_number(row[0] or ''))
                except ValueError:
                    pass
        if numbers:
            registry = output / 'registry'
            ScbClient().lookup(numbers, registry, identities_file=args.identities)
    data = project(output / 'collection', database, registry, output / 'resolved',
        reviews=read(args.reviews), reviewers=read(args.reviewers), context=read(args.context))
    if args.publish:
        publish(output / 'resolved')
    print(json.dumps({'bundle': str(output / 'resolved'), 'metrics': data['metrics'],
        'window': [collection['window_start'], collection['window_end']]}, indent=2))


if __name__ == '__main__':
    main()
