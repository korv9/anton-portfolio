import type { CompanyData } from '../../src/companies/model.ts'
import type { WorkspaceContent } from '../../src/job-intelligence/model.ts'

export function fixtureWorkspace(data: CompanyData): WorkspaceContent {
  return { schema_version:1, state:'available', generated_at:data.generated_at, valid_until:data.valid_until, registry_hash:data.registry_hash,
    selection:'Synthetic test only', jobs:data.jobs.slice(0,50).map(j => ({job_id:j.job_id, document_hash:j.document_hash, source_url:j.source_url,
      description_text:'Du har Python.\nSQL är meriterande.\nArbetet omfattar systemutveckling.', text_origin:'description.text', contact_redactions:0,
      application_url:'https://example.invalid/apply/'+j.job_id, employment_type:'Tillsvidare', working_hours:'Heltid', duration:null,salary:null,salary_type:null,remote_evidence:[],
      analysis:{version:'synthetic-v1',limitations:'Synthetic fixtures only.',requirements:[{label:'Python',category:'language',strength:'required',source_field:'description',line:1,quote:'Du har Python.'}, {label:'SQL',category:'database',strength:'preferred',source_field:'description',line:2,quote:'SQL är meriterande.'}]}})) }
}
