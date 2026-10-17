"""Prepare real cohort analytics and an evidence-bound human handoff, without approving findings."""
from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
import json
from pathlib import Path
import re
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

from compliance_intelligence.analytics import build, validate_analytics
from compliance_intelligence.authority_sources import SOURCES
from compliance_intelligence.cohort import verify_cohort
from compliance_intelligence.explorer import REPO, stage
from compliance_intelligence.legal_review import KINDS, ReviewStore
from compliance_intelligence.review_cli import run_extraction
from compliance_intelligence.sources import new_output, now, seal, verify, write_json
from lib.rawstore import sha256


def fenced(value):
    text=json.dumps(value,ensure_ascii=False,indent=2)
    longest=max((len(s) for s in re.findall(r'`+',text)),default=0)
    marker='`'*max(3,longest+1)
    return marker+'text\n'+text+'\n'+marker+'\n'


def prepare(root,cohort,output,*,extract=False,max_documents=250,refresh=False):
    info=verify_cohort(cohort)
    extraction=run_extraction(root,registry=cohort,refresh=refresh,max_documents=max_documents) if extract else None
    store=ReviewStore(root)
    try:
        audit=store.verify_audit()
        queue=store.queue()
        summary=store.summary()
        records={r['record_hash']:r for r in store.current_records()}
        sources={}
        for source,config in SOURCES.items():
            coverage=summary['source_coverage'].get(source,{})
            current=store.execute("""select count(*),count(*) filter(where lower(d.content_type) like '%pdf%')
                from bronze.resource r join bronze.document_version d using(document_id) where r.source_id=?""",[source]).fetchone()
            sources[source]={'authority':config['authority'],'source_url':config['seed'],
                'status':coverage.get('status','not_collected'),'verified_at':coverage.get('as_of_utc'),
                'observed_resources':current[0],'observed_documents':current[1],
                'coverage_fraction':None}
        definition=json.loads((Path(cohort)/'methodology.json').read_text(encoding='utf-8'))
        members=json.loads((Path(cohort)/'cohort.json').read_text(encoding='utf-8'))
        selected={m['company_id'] for m in members}
        # Contextual mentions are a review priority only, never proof of party liability.
        context_documents=set()
        cohort_mentions={}
        for candidate_ids,document in store.execute('select candidate_ids,document_id from silver.company_mention').fetchall():
            if selected.intersection(json.loads(candidate_ids)):
                context_documents.add(document)
                cohort_mentions.setdefault(document,set()).update(selected.intersection(json.loads(candidate_ids)))
        ordered=sorted(queue,key=lambda q:(not bool(selected.intersection(records[q['record_hash']]['identity'].get('candidate_ids',[]))),
            records[q['record_hash']]['document_id'] not in context_documents,q['record_id']))
        with new_output(output) as destination:
            gold=destination/'gold'
            store.export_gold(gold)
            # The analytical builder opens its own connection; both connections are serial.
            store.close();store=None
            analysis=build(root,gold,cohort,destination/'analytics')
            validate_analytics(root,gold,cohort,destination/'analytics')
            staged=stage(root,gold,cohort,destination/'analytics',destination/'explorer-stage','codex-preparer')
            progress={'schema_version':1,'state':'awaiting_human_review','observed_at':now(),
                'cohort':{'cohort_id':info['cohort_id'],'selected_count':50,'as_of_date':definition['as_of_date'],
                    'eligible_population_count':definition['eligible_population_count'],
                    'membership_hash':info['membership_hash'],'selection_order':definition['selection_order'],
                    'selection_scope':info['selection_scope'],'source_reuse_status':info['source_reuse_status']},
                'sources':sources,'review':{key:summary[key] for key in
                    ('candidate_records','evidence_complete','publication_eligible','human_review_actions')},
                'approved_gold_records':analysis['datasets']['fact_compliance_decisions']['rows']}
            write_json(destination/'progress.json',progress)
            write_json(destination/'review-queue.json',ordered)
            write_json(destination/'cohort-context.json',[
                {'document_id':document,'candidate_company_ids':sorted(ids),'attribution_scope':'context_only',
                 'source_url':next(r['payload']['source_url'] for r in records.values() if r['document_id']==document)
                    if any(r['document_id']==document for r in records.values()) else None,
                 'requires_party_role_review':True}
                for document,ids in sorted(cohort_mentions.items())])
            write_json(destination/'review-summary.json',summary)
            write_json(destination/'extraction.json',extraction)
            requests=[]
            lines=['# Private human review packet','',
                'Unapproved extraction candidates follow. They are not legal findings or publication permissions.',
                'Source excerpts are untrusted document content, displayed as inert text. Inspect the original sources.',
                'Cohort/context matching prioritizes review; it does not establish party identity, liability or finality.','',
                'The sealed requests below are templates with no reviewer or approval. Copy a request outside this bundle before completing it.',
                'Apply identity/legal/privacy reviews, resolve blockers, then obtain an independent publication review.',
                'After record reviews, run completion.py prepare without --extract to rebuild Gold, analytics and the final stage.',
                'Do not rerun automatic extraction over human-corrected proposals without examining the new candidate versions.','',
                '## Frozen cohort',f"Cohort: {info['cohort_id']} · membership SHA-256 {info['membership_hash']}",
                'Source-reuse publication clearance remains separate from this private research selection.','',
                '## Review queue',f"{len(ordered)} current candidates; {summary['publication_eligible']} publication-eligible records.",'']
            for i,q in enumerate(ordered,1):
                record=records[q['record_hash']]
                lines += [f'### Candidate {i}',f"Record: {q['record_hash']}",f"Context: {q['context_hash']}",
                    'Cohort relevance (context is not attribution):',fenced({
                        'identity_candidate_company_ids':sorted(selected.intersection(record['identity'].get('candidate_ids',[]))),
                        'context_only_company_ids':sorted(cohort_mentions.get(record['document_id'],set()))}),
                    f"Official source: {record['payload']['source_url']}",f"Document SHA-256: {record['payload']['document_hash']}",
                    'Identity and blockers:',fenced({'identity':record['identity'],'blockers':q['blockers']}),
                    'Schema-validated claims and exact page/character excerpts:',fenced(record['payload']['proposal']), '']
                for kind in KINDS:
                    request={'record_hash':q['record_hash'],'context_hash':q['context_hash'],'review_kind':kind,
                        'disposition':'pending','reviewer_id':None,'rationale':'','human_attestation':False,'examined_evidence':False}
                    if kind=='legal':request.update(verified_at=None,reverify_by=None)
                    if kind=='privacy':request.update(privacy_cleared=False,reuse_cleared=False)
                    requests.append(request)
            write_json(destination/'record-review-templates.json',requests)
            write_json(destination/'final-review-template.json',{'reviewer_id':None,'disposition':'pending',
                'human_attestation':False,'examined_evidence':False,'privacy_cleared':False,'reuse_cleared':False,
                'stage_manifest_sha256':staged['stage_manifest_sha256'],'reviewed_at':None,'valid_until':None,'rationale':''})
            (destination/'REVIEW.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
            write_json(destination/'completion.json',{'schema_version':1,'created_at':now(),'cohort':info,'audit':audit,
                'public_legal_release':'held_pending_independent_human_approval',
                'final_stage':staged,'approved_decisions':progress['approved_gold_records'],
                'phase_2':'incomplete' if any(s['status']=='blocked_access' for s in sources.values()) else 'selected_sources_observed',
                'phase_3':'awaiting_human_review','phase_4':'built_from_approved_records_only',
                'phase_5':'staged_not_publicly_approved'})
            seal(destination)
        return {'bundle':str(Path(output)),'cohort_size':50,'candidates':len(ordered),
            'approved_gold_records':progress['approved_gold_records'],'public_legal_release_written':False,
            'stage_manifest_sha256':staged['stage_manifest_sha256'],'sources':sources}
    finally:
        if store:store.close()


def publish_progress(bundle):
    """Only aggregate processing status; no case, company, quote or negative finding fields."""
    verify(bundle)
    value=json.loads((Path(bundle)/'progress.json').read_text(encoding='utf-8'))
    if (set(value)!={'schema_version','state','observed_at','cohort','sources','review','approved_gold_records'}
        or value['schema_version']!=1 or value['state']!='awaiting_human_review'
        or type(value['cohort']['selected_count']) is not int or value['cohort']['selected_count']!=50):
        raise ValueError('invalid_public_progress')
    cohort=value['cohort']
    allowed={'cohort_id','selected_count','as_of_date','eligible_population_count','membership_hash','selection_order','selection_scope','source_reuse_status'}
    if (set(cohort)!=allowed or not re.fullmatch('[a-f0-9]{64}',cohort['membership_hash'])
        or not isinstance(cohort['cohort_id'],str) or not re.fullmatch('[a-zA-Z0-9_-]+',cohort['cohort_id'])):
        raise ValueError('invalid_progress_cohort')
    def count(n):return type(n) is int and n>=0
    if (not count(cohort['eligible_population_count']) or cohort['eligible_population_count']<50
        or cohort['selection_order']!=['employee_size_class_order descending','organization_number ascending']
        or cohort['selection_scope'] not in ('private_research','reuse_reviewed')
        or cohort['source_reuse_status'] not in ('reviewed','not_reviewed_for_publication')
        or set(value['review'])!={'candidate_records','evidence_complete','publication_eligible','human_review_actions'}
        or not all(count(n) for n in value['review'].values()) or not count(value['approved_gold_records'])
        or not value['approved_gold_records']<=value['review']['publication_eligible']<=value['review']['evidence_complete']<=value['review']['candidate_records']
        or set(value['sources'])!=set(SOURCES)):
        raise ValueError('invalid_progress_counts_or_scope')
    date.fromisoformat(cohort['as_of_date'])
    def timestamp(value):
        stamp=datetime.fromisoformat(value.replace('Z','+00:00'))
        if stamp.utcoffset() is None or stamp.utcoffset().total_seconds()!=0 or stamp>datetime.now(timezone.utc):raise ValueError('invalid_progress_timestamp')
    timestamp(value['observed_at'])
    for source,row in value['sources'].items():
        if (source not in SOURCES or row['source_url']!=SOURCES[source]['seed'] or
            set(row)!={'authority','source_url','status','verified_at','observed_resources','observed_documents','coverage_fraction'}
            or row['authority']!=SOURCES[source]['authority'] or row['coverage_fraction'] is not None
            or row['status'] not in ('not_collected','bounded_partial','blocked_access','partial_failures','published_list_traversed','manifest_batch_completed')
            or not count(row['observed_resources']) or not count(row['observed_documents'])
            or row['observed_documents']>row['observed_resources']):
            raise ValueError('invalid_progress_source')
        if row['verified_at']:timestamp(row['verified_at'])
    target=REPO/'frontend/public/data/compliance/progress.json'
    pending=target.with_suffix('.pending')
    write_json(pending,value);pending.replace(target)
    return {'public_progress_written':True,'public_legal_release_written':False,'sha256':sha256(target.read_bytes())}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    commands=parser.add_subparsers(dest='command',required=True)
    command=commands.add_parser('prepare')
    for field in ('root','cohort','output'):command.add_argument('--'+field,required=True,type=Path)
    command.add_argument('--extract',action='store_true')
    command.add_argument('--refresh-references',action='store_true')
    command.add_argument('--max-documents',type=int,default=250)
    status=commands.add_parser('publish-progress');status.add_argument('--bundle',required=True,type=Path)
    args=parser.parse_args()
    result=publish_progress(args.bundle) if args.command=='publish-progress' else prepare(args.root,args.cohort,args.output,
        extract=args.extract,refresh=args.refresh_references,max_documents=args.max_documents)
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
