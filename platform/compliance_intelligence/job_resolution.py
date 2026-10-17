"""Resolve advertised identities; a job advertiser is not necessarily the end employer."""
from difflib import SequenceMatcher

from compliance_intelligence.registry import interval_covers, name_key, organization_number
from lib.rawstore import sha256
from compliance_intelligence.registry import encoded


def resolve_employer(snapshot, employer, *, on_date=None):
    companies = {c['company_id']: c for c in snapshot['companies'] if c['identity_status'] == 'verified'}
    name = name_key(str(employer.get('name') or ''))
    number = employer.get('organization_number')
    aliases = [a for a in snapshot['aliases'] if a['review_status'] == 'approved'
        and name_key(a['alias']) == name and interval_covers(a, on_date or snapshot['metadata']['as_of_date'])]
    candidates = {c['company_id'] for c in companies.values() if name_key(c['registered_legal_name']) == name}
    candidates.update(a['company_id'] for a in aliases)
    result = {'company_id': None, 'match_status': 'unresolved', 'match_method': 'no_identity',
        'match_confidence': 0.0, 'verified_at': None, 'candidate_ids': [], 'evidence': []}
    def verified(c, method, confidence):
        docs = {d['document_id']:d for d in snapshot['documents']}
        return {**result, 'company_id': c['company_id'], 'match_status': 'verified',
            'match_method': method, 'match_confidence': confidence, 'verified_at': c['last_verified_at'],
            'candidate_ids': [c['company_id']], 'evidence': [{'source_url': c['source_url'],
                'document_hash': c['document_hash'], 'source_locator': c['source_locator']},
                *[{'source_document_id': a['source_document_id'],
                   'source_url':docs[a['source_document_id']]['source_url'],
                   'document_hash':docs[a['source_document_id']]['document_hash'], 'source_locator': a['source_locator'],
                   'review': a['review']} for a in aliases if a['company_id'] == c['company_id']]]}
    if number:
        try:
            company_id = 'se:orgnr:' + organization_number(number)
        except ValueError:
            return {**result, 'match_method': 'invalid_organization_number', 'match_status': 'review_required'}
        c = companies.get(company_id)
        if c:
            # Exact IDs with contradictory names are held for review, never silently repaired.
            if name and company_id not in candidates:
                return {**result, 'match_status': 'ambiguous', 'match_method': 'name_number_conflict',
                    'candidate_ids': sorted(candidates | {company_id})}
            return verified(c, 'exact_organization_number', 1.0)
        return {**result, 'match_method': 'organization_number_not_in_registry'}
    alias_ids = {a['company_id'] for a in aliases if a['company_id'] in companies}
    if len(alias_ids) == 1 and candidates == alias_ids:
        return verified(companies[next(iter(alias_ids))], 'reviewed_entity_alias', .99)
    if not candidates and name:
        candidates = {c['company_id'] for c in companies.values()
            if SequenceMatcher(None, name, name_key(c['registered_legal_name'])).ratio() >= .92}
    return {**result, 'candidate_ids': sorted(candidates),
        'match_method': 'name_candidate' if candidates else 'no_identity',
        'match_status': 'ambiguous' if len(candidates) > 1 else 'review_required' if candidates else 'unresolved',
        'match_confidence': .8 if candidates else 0.0}


def apply_reviews(links, reviews, snapshot, reviewers, registry_hash):
    """Explicit role evidence, bound to exact job and registry versions. No review by an LLM."""
    from datetime import datetime, timezone
    from compliance_intelligence.registry import https_url, utc_timestamp
    companies = {c['company_id']: c for c in snapshot['companies'] if c['identity_status'] == 'verified'}
    by_id = {r['job_id']: r for r in links}
    output = {(r['job_id'], r['relationship_type']): r for r in links}
    seen = set()
    for review in reviews:
        key = (review['job_id'], review['relationship_type'])
        original = by_id[review['job_id']]
        if key in seen or review['relationship_type'] not in ('advertised_employer', 'recruiter', 'actual_employer'):
            raise ValueError('Conflicting or invalid role reviews')
        seen.add(key)
        if (review['reviewer_id'] not in reviewers or review['registry_hash'] != registry_hash
            or review['job_payload_hash'] != original['job_payload_hash']):
            raise ValueError('Review is unauthorized or refers to a different input version')
        instant = datetime.fromisoformat(utc_timestamp(review['reviewed_at']))
        if instant > datetime.now(timezone.utc):
            raise ValueError('Review date is in the future')
        https_url(review['evidence_url'])
        if (len(review['document_hash']) != 64 or any(c not in '0123456789abcdef' for c in review['document_hash'])
            or not review['source_locator'].strip() or not review['rationale'].strip()):
            raise ValueError('Review requires precise source evidence')
        approved = review['disposition'] == 'approved'
        if review['disposition'] not in ('approved', 'rejected') or (approved and review['company_id'] not in companies):
            raise ValueError('Invalid review disposition or company')
        output[key] = {**original, 'relationship_type': key[1],
            'company_id': review['company_id'] if approved else None,
            'match_status': 'verified' if approved else 'rejected', 'match_method': 'human_review',
            'match_confidence': 1.0 if approved else 0.0,
            'verified_at': review['reviewed_at'] if approved else None, 'evidence': [review]}
        review['review_id'] = sha256(encoded({k:v for k,v in review.items() if k != 'review_id'}))
    return list(output.values())
