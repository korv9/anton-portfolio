/** Synthetic identities live in tests only. */
import type { CompanyData } from '../../src/companies/model.ts'
export function fixtureCompanies(): CompanyData {
  const stamp=new Date().toISOString()
  const number='9990000003'
  const id='se:orgnr:'+number
  const jobs=Array.from({length:3},(_,i) => ({job_id:String(i),title:`Synthetic developer ${i}`,employer_name:i===2?'Unresolved Example':'Synthetic Company AB',
    organization_number:i===2?null:number,workplace_name:'Synthetic workplace',location:'Synthetic city',technologies:['Python'],publication_date:stamp,
    application_deadline:null,source_url:`https://example.invalid/ad/${i}`,document_hash:'a'.repeat(64)}))
  return {schema_version:1,state:'available',generated_at:stamp,valid_until:new Date(Date.now()+86400000).toISOString(),registry_hash:'b'.repeat(64),
    coverage:{source_url:'https://example.invalid/search',license_url:'https://example.invalid/license',occupation_field:'Data/IT',occupation_field_id:'apaJ_2ja_LuF',window_start:stamp.slice(0,19),window_end:stamp.slice(0,19),query_timezone:'Europe/Stockholm',coverage_status:'synthetic-test',limitations:['Synthetic tests only.']},
    metrics:{total_active_it_ads:3,verified_company_links:2,match_coverage_percentage:66.67,ambiguous_matches:1,unresolved_matches:0,review_required_matches:0,rejected_matches:0,companies_with_financial_data:0,companies_with_reviewed_compliance_coverage:null},
    companies:[{company_id:id,organization_number:number,registered_legal_name:'Synthetic Company AB',country_code:'SE',registry_authority:'synthetic',registry_number:number,primary_sni_code:'62100',sni_version:'2025',employee_size_class:'6',snapshot_date:stamp.slice(0,10),source_url:'https://example.invalid/register',document_hash:'c'.repeat(64),last_verified_at:stamp}],
    jobs,links:jobs.map((j,i) => ({job_id:j.job_id,company_id:i===2?null:id,relationship_type:'advertised_employer',match_method:i===2?'name_candidate':'exact_organization_number',match_status:i===2?'ambiguous':'verified',match_confidence:i===2?.8:1,verified_at:i===2?null:stamp,job_payload_hash:j.document_hash,registry_hash:'b'.repeat(64),evidence:i===2?[]:[{source_url:'https://example.invalid/register',document_hash:'c'.repeat(64),source_locator:'$'}]})),context:[],relationships:[]}
}
