/** Synthetic, test-only public projection; never copied into frontend/public. */
import { createHash } from 'node:crypto'
import type { Family, Payload } from '../../src/compliance/model.ts'

export function fixturePayload(): Payload {
  const stamp = new Date().toISOString()
  const due = new Date(Date.now()+2*86400000).toISOString()
  const companies=Array.from({length:50},(_,i) => ({
    company_id:`synthetic:${i}`, organization_number:`559999${String(i).padStart(4,'0')}`,
    registered_legal_name:`Synthetic Fixture ${i} AB`,country_code:'SE',registry_authority:'synthetic',registry_number:`fixture-${i}`,
    primary_sni_code:'62100',employee_size_class:'6',snapshot_date:'2026-10-16',
    source_url:'https://example.invalid/synthetic-register',document_hash:'b'.repeat(64),last_verified_at:stamp,
    cohort_member:true,employees_lower_bound:50,employees_upper_bound:99,financial_metadata:null,
  }))
  const makeFamily=(i:number,company:number,amount:string,currency:'SEK'|'EUR',status='final'):Family => {
    const id=`synthetic-order-${i}`
    const source={source_url:`https://www.imy.se/globalassets/synthetic-test-only-${i}.pdf`,document_hash:String(i+1).repeat(64).slice(0,64),authority:'Integritetsskyddsmyndigheten',decision_date:'2025-03-01'}
    const final=status === 'final'
    return {origin_decision_id:id,company_id:`synthetic:${company}`,case_id:`synthetic-case-${i}`,authority:source.authority,category:'data_protection',decision_date:source.decision_date,legal_status:status,
      administrative_sanctions:status === 'annulled' ? 0 : 1,gdpr_sanctions:status === 'annulled' ? 0 : 1,competition_sanctions:0,under_appeal:status === 'appealed',modified_decisions:0,annulled_decisions:status === 'annulled' ? 1 : 0,
      final_amounts:final ? {[currency]:amount} : {}, documents:[source],
      decisions:[{...source,decision_id:id,company_id:`synthetic:${company}`,case_number:`SYNTHETIC-${i}`,legal_entity:companies[company].registered_legal_name,original_outcome:'administrative_sanction',legal_status:status,finality_status:final ? 'final':'unknown',publication_date:'2025-03-05',legal_basis:['GDPR'],last_verified_at:stamp,reverify_by:due,subsequent_decisions:[]}],
      amounts:[{amount_id:id+'-original',amount,currency,amount_kind:'original',decision_id:id,document_hash:source.document_hash,source_url:source.source_url},...(final ? [{amount_id:id+'-final',amount,currency,amount_kind:'final_effective' as const,decision_id:id,document_hash:source.document_hash,source_url:source.source_url}] : [])]}
  }
  return {schema_version:1,presentation_sha256:'c'.repeat(64),context:{cohort_id:'synthetic-phase5-never-publish',cohort_size:50,cohort_as_of_date:'2026-10-16',membership_hash:'a'.repeat(64),status_snapshot_at:stamp,warnings:['Synthetic tests only. Source population coverage is unknown.'],selection_order:['employee size class descending','organization number'],selection_limitations:['Employee intervals are not exact headcounts.'],filters:{date_from:'2018-05-25',date_to:'2026-10-16',group_as_of:'2026-10-16'}},
    companies,relationships:[],families:[makeFamily(0,0,'1800000.00','SEK'),makeFamily(1,1,'35000.00','EUR'),makeFamily(2,1,'100000.00','SEK','appealed')],
    coverage:[{authority:'Integritetsskyddsmyndigheten',period_start:'2025-01-01',period_end:'2025-12-31',period_role:'requested_window',approved_decision_records:3,reviewed_source_documents:3,approved_record_field_completeness:8/9,source_population_coverage_fraction:null,search_execution_coverage_fraction:null,coverage_status:'selected_approved_documents_population_unknown'}],
    evidence_valid_until:due,methodology_markdown:'# Synthetic methodology\n\nFixtures only; never publish company observations from tests.\n'}
}
export function envelope(payload=fixturePayload(),expires=Date.now()+86400000) {
  const payload_json=JSON.stringify(payload)
  return {schema_version:1,state:'approved',publication:{review_status:'approved',reviewed_at:new Date(Date.now()-60000).toISOString(),valid_until:new Date(expires).toISOString(),payload_sha256:createHash('sha256').update(payload_json).digest('hex')},payload_json}
}
export function progressFixture() {
  return {
    schema_version: 1,
    state: 'awaiting_human_review',
    observed_at: '2026-01-01T00:00:00Z',
    cohort: {
      cohort_id: 'synthetic-progress-only', selected_count: 50,
      as_of_date: '2026-01-01', eligible_population_count: 100,
      membership_hash: 'a'.repeat(64),
      selection_order: ['employee_size_class_order descending', 'organization_number ascending'],
      selection_scope: 'private_research', source_reuse_status: 'not_reviewed_for_publication',
    },
    sources: {
      imy: {
        authority: 'Integritetsskyddsmyndigheten',
        source_url: 'https://www.imy.se/om-oss/beslut-publikationer-och-remisser/beslut-om-sanktionsavgift/',
        status: 'bounded_partial', verified_at: '2026-01-01T00:00:00Z',
        observed_resources: 3, observed_documents: 2, coverage_fraction: null,
      },
      kkv: {
        authority: 'Konkurrensverket',
        source_url: 'https://www.konkurrensverket.se/konkurrens/tillsyn-arenden-och-beslut/arendelista',
        status: 'blocked_access', verified_at: '2026-01-01T00:00:00Z',
        observed_resources: 0, observed_documents: 0, coverage_fraction: null,
      },
    },
    review: { candidate_records: 2, evidence_complete: 0, publication_eligible: 0, human_review_actions: 0 },
    approved_gold_records: 0,
  }
}
