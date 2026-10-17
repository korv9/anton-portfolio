"""Stage a public explorer projection; promote only after an exact-artifact human review."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from compliance_intelligence.analytics import (  # noqa: E402
    analysis_rows, input_data, normalized_filters, read_json, roots_for, validate_analytics,
)
from compliance_intelligence.legal_extraction import STATUSES  # noqa: E402
from compliance_intelligence.legal_review import ReviewStore  # noqa: E402
from compliance_intelligence.registry import encoded, utc_timestamp  # noqa: E402
from compliance_intelligence.sources import new_output, now, seal, verify, write_json  # noqa: E402
from lib.rawstore import sha256  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
TARGET = REPO/'frontend/public/data/compliance/release.json'
PRESENTATION_FILES = ['model.ts','exports.ts','ComplianceExplorer.tsx','compliance.css','progress.ts',
    '../companies/model.ts','../companies/CompanyIntelligence.tsx','../companies/companies.css',
    '../companies/CompanyDeepDive.tsx','../companies/CompanyEvidence.tsx','../companies/CompanyJobCard.tsx','../companies/CompanyCompliance.tsx','../job-intelligence/model.ts',
    '../job-intelligence/JobIntelligence.tsx','../job-intelligence/workspace.css',
    '../job-intelligence/JobResearch.tsx','../job-intelligence/Requirements.tsx',
    '../job-intelligence/CvMatch.tsx','../job-intelligence/JobFilters.tsx',
    '../job-intelligence/useWorkspace.ts','../job-intelligence/profile.ts','../job-intelligence/ranking.ts']
COMPANY_FIELDS = ('company_id','organization_number','registered_legal_name','country_code',
    'registry_authority','registry_number','primary_sni_code','employee_size_class','snapshot_date',
    'source_url','document_hash','last_verified_at')
RELATION_FIELDS = ('company_id','related_company_id','relationship_type','valid_from','valid_to','source_url','document_hash')


def public_deadline(store, rows):
    deadlines = [r['reverify_by'] for r in rows]
    for row in rows:
        for link in row['subsequent_decisions']:
            head = store.execute('select record_hash from review.current_record where record_id=?',[link['record_id']]).fetchone()
            due = store.actions(head[0]).get('legal',{}).get('reverify_by') if head else None
            if not due:
                raise ValueError('status_dependency_reverification_date_missing')
            deadlines.append(due)
    return min(deadlines)+'T00:00:00+00:00' if deadlines else None


def projection(root, release, cohort, analytics):
    validate_analytics(root,release,cohort,analytics)
    context = read_json(Path(analytics)/'methodology.json')
    filters = context['filters']
    if filters['scope'] != 'legal_entity' or any(filters[k] for k in ('authority','category','status','industry','size_class')):
        raise ValueError('explorer_requires_unfiltered_legal_entity_analytics')
    store = ReviewStore(root)
    try:
        rows,snapshot,members,_ = input_data(store,release,cohort)
        by_id,roots,_,_ = roots_for(rows)
        member_by_id = {m['company_id']:m for m in members}
        data = analysis_rows(rows,members,snapshot,filters)
        used = {r['decision_id'] for r in data['fact_compliance_decisions']}
        families = []
        for origin in sorted({roots[i] for i in used}):
            acts = [r for r in rows if r['record_id'] in used and roots[r['record_id']] == origin]
            member = member_by_id[by_id[origin]['company_id']]
            # Reuse Phase 4 arithmetic for each obligation, including appeals and changed orders.
            one = analysis_rows(acts,[member],snapshot,filters)
            summary = one['mart_compliance_company_summary'][0]
            status = next((s for s in sorted(STATUSES) if analysis_rows(acts,[member],snapshot,
                {**filters,'status':[s]})['fact_compliance_decisions']), 'unknown')
            family_acts = [{**d, **{k:by_id[d['decision_id']][k] for k in
                ('case_number','legal_entity','last_verified_at','reverify_by','subsequent_decisions')}}
                for d in one['fact_compliance_decisions']]
            documents = {d['document_hash']:{'document_hash':d['document_hash'],'source_url':d['source_url'],
                'authority':d['authority'],'decision_date':d['decision_date']} for d in family_acts}
            for d in family_acts:
                for link in d['subsequent_decisions']:
                    documents[link['document_hash']] = {k:link[k] for k in
                        ('document_hash','source_url','authority','decision_date')}
            families.append({'origin_decision_id':origin,'company_id':member['company_id'],
                'case_id':by_id[origin]['case_id'],'authority':by_id[origin]['authority'],
                'category':by_id[origin]['case_type'],'decision_date':by_id[origin]['decision_date'],
                'legal_status':status,'administrative_sanctions':summary['confirmed_administrative_sanctions'],
                'gdpr_sanctions':summary['gdpr_sanctions'],'competition_sanctions':summary['competition_law_sanctions'] or 0,
                'under_appeal':bool(summary['cases_under_appeal']),
                'modified_decisions':summary['modified_decisions'],'annulled_decisions':summary['annulled_decisions'],
                'final_amounts':summary['final_monetary_sanctions_by_currency'],
                'decisions':family_acts,'documents':sorted(documents.values(),key=lambda d:d['document_hash']),
                'amounts':one['fact_compliance_amounts']})
        ids = set(member_by_id)
        # Only relationships reached from cohort members; no unrelated registry dump.
        relations = []
        pending = list(sorted(ids))
        while pending:
            company_id = pending.pop()
            for rel in snapshot['relationships']:
                if rel['company_id'] != company_id:
                    continue
                public = {k:rel.get(k) for k in RELATION_FIELDS}
                if public not in relations:
                    relations.append(public)
                other = rel['related_company_id']
                if other not in ids:
                    ids.add(other)
                    pending.append(other)
        bounds = {s['entity_id']:(s['employees_lower_bound'],s['employees_upper_bound'])
            for s in data['mart_compliance_company_summary']}
        companies = []
        for company in sorted(snapshot['companies'],key=lambda c:c['company_id']):
            if company['company_id'] in ids:
                lower,upper = bounds.get(company['company_id'],(None,None))
                companies.append({**{k:company.get(k) for k in COMPANY_FIELDS},
                    'cohort_member':company['company_id'] in member_by_id,
                    'employees_lower_bound':lower,'employees_upper_bound':upper,
                    'financial_metadata':None})
        valid_until = public_deadline(store,[r for r in rows if r['record_id'] in used])
        return {'schema_version':1,'context':context,'companies':companies,
            'presentation_sha256':sha256(b''.join((REPO/'frontend/src/compliance'/f).read_text(encoding='utf-8').encode('utf-8') for f in PRESENTATION_FILES)),
            'relationships':sorted(relations,key=lambda r:encoded(r)), 'families':families,
            'coverage':data['mart_compliance_source_coverage'], 'evidence_valid_until':valid_until,
            'methodology_markdown':(REPO/'docs/compliance-intelligence/phase-4-methodology.md').read_text(encoding='utf-8')}
    finally:
        store.close()


def stage(root, release, cohort, analytics, output, prepared_by):
    if not prepared_by.strip():
        raise ValueError('preparer_required')
    payload = projection(root,release,cohort,analytics)
    with new_output(output) as directory:
        write_json(directory/'payload.json',payload)
        write_json(directory/'stage.json',{'prepared_by':prepared_by,'created_at':now(),
            'payload_sha256':sha256(encoded(payload)), 'review_status':'pending'})
        seal(directory)
    return {'review_status':'pending','stage_manifest_sha256':sha256((Path(output)/'artifact-manifest.json').read_bytes()),
        'payload_sha256':sha256(encoded(payload)), 'public_file_written':False}


def write_public(envelope, output):
    target = Path(output).resolve()
    if target != TARGET.resolve() and not target.is_relative_to((REPO/'tmp').resolve()):
        raise ValueError('public_output_must_be_compliance_release_or_workspace_tmp')
    target.parent.mkdir(parents=True,exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.release-',suffix='.tmp',dir=target.parent)
    try:
        with os.fdopen(descriptor,'wb') as stream:
            stream.write(encoded(envelope))
        os.replace(temporary,target)
    finally:
        if Path(temporary).exists():
            Path(temporary).unlink()


def withdraw(root, reason, output=TARGET):
    if reason not in ('review_withdrawn','evidence_changed','reverification_required'):
        raise ValueError('invalid_withdrawal_reason')
    store = ReviewStore(root)
    try:
        store.audit('explorer_publication_withdrawn',{'reason':reason,'withdrawn_at':now()})
    finally:
        store.close()
    write_public({'schema_version':1,'state':'unavailable','reason':reason},output)
    return {'state':'unavailable','reason':reason}


def promote(root, release, cohort, analytics, staged, approval, reviewers, output=TARGET):
    verify(staged)
    payload = projection(root,release,cohort,analytics)
    if payload != read_json(Path(staged)/'payload.json'):
        raise ValueError('staged_projection_changed')
    manifest = read_json(Path(staged)/'stage.json')
    digest = sha256(encoded(payload))
    actor = approval.get('reviewer_id')
    principal = reviewers.get(actor,{})
    if (principal.get('kind') != 'human' or 'publication' not in principal.get('roles',[])
            or actor == manifest['prepared_by']
            or any(approval.get(k) is not True for k in
                ('human_attestation','examined_evidence','privacy_cleared','reuse_cleared'))
            or approval.get('disposition') != 'approved' or not str(approval.get('rationale','')).strip()):
        raise ValueError('independent_final_human_publication_review_required')
    if (approval.get('stage_manifest_sha256') != sha256((Path(staged)/'artifact-manifest.json').read_bytes())
            or manifest['payload_sha256'] != digest):
        raise ValueError('final_review_artifact_mismatch')
    current = datetime.now(timezone.utc)
    reviewed_at = datetime.fromisoformat(utc_timestamp(approval['reviewed_at']))
    expires = datetime.fromisoformat(utc_timestamp(approval['valid_until']))
    if not datetime.fromisoformat(manifest['created_at']) <= reviewed_at <= current < expires:
        raise ValueError('final_review_expired_or_invalid')
    # A final layout/reuse review cannot extend underlying legal verification freshness.
    if ((expires-reviewed_at).total_seconds() > 30*86400
            or payload['evidence_valid_until'] and expires > datetime.fromisoformat(payload['evidence_valid_until'])):
        raise ValueError('publication_expiry_exceeds_evidence_or_policy')
    envelope = {'schema_version':1,'state':'approved','publication':{'review_status':'approved',
        'reviewed_at':approval['reviewed_at'],'valid_until':approval['valid_until'],
        'payload_sha256':digest}, 'payload_json':encoded(payload).decode('utf-8')}
    store = ReviewStore(root)
    try:
        store.audit('explorer_publication_approved',{'payload_sha256':digest,'approval':approval})
    finally:
        store.close()
    write_public(envelope,output)
    return {'state':'approved','payload_sha256':digest,'valid_until':approval['valid_until']}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command',required=True)
    revoke = sub.add_parser('withdraw')
    revoke.add_argument('--root',type=Path,required=True)
    revoke.add_argument('--reason',choices=('review_withdrawn','evidence_changed','reverification_required'),required=True)
    for name in ('stage','promote'):
        command = sub.add_parser(name)
        for flag in ('root','release','cohort','analytics'):
            command.add_argument('--'+flag,type=Path,required=True)
        if name == 'stage':
            command.add_argument('--output',type=Path,required=True)
            command.add_argument('--prepared-by',required=True)
        else:
            command.add_argument('--staged',type=Path,required=True)
            command.add_argument('--approval',type=Path,required=True)
            command.add_argument('--reviewers',type=Path,required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'withdraw':
            result = withdraw(args.root,args.reason)
        elif args.command == 'stage':
            result = stage(args.root,args.release,args.cohort,args.analytics,args.output,args.prepared_by)
        else:
            result = promote(args.root,args.release,args.cohort,args.analytics,args.staged,
                read_json(args.approval),read_json(args.reviewers))
        print(json.dumps(result,indent=2))
        return 0
    except (ValueError,OSError,KeyError,TypeError,duckdb.Error) as exc:
        message = str(exc) if type(exc) is ValueError else ''
        code = message if re.fullmatch(r'[a-z][a-z0-9_:,]{0,200}',message) else type(exc).__name__
        print('Explorer held: '+code,file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
