// Private CLI. Candidate facts and recommendations never enter public dataset publication.
import { readFile, writeFile, realpath } from 'node:fs/promises'
import { resolve, sep, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { parseCompanyData } from '../frontend/src/companies/model.ts'
import { parseWorkspace } from '../frontend/src/job-intelligence/model.ts'
import { parseProfile } from '../frontend/src/job-intelligence/profile.ts'
import { rankCandidates } from '../frontend/src/job-intelligence/ranking.ts'
try {
  const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[2+i*2],process.argv[3+i*2]]))
  const root=await realpath('.research')
  const profilePath=await realpath(args['--profile'])
  const target=resolve(args['--output'])
  const parent=await realpath(dirname(target))
  if(!profilePath.startsWith(root+sep) || parent!==root && !parent.startsWith(root+sep) || !target.endsWith('.json')) throw new Error('Private .research paths required')
  const profile=parseProfile(JSON.parse(await readFile(profilePath,'utf8')))
  const asOf=args['--as-of'] ? Date.parse(args['--as-of']) : Date.now()
  if(!Number.isFinite(asOf) || asOf>Date.now()) throw new Error('Invalid observation time')
  const read=async name=>JSON.parse(await readFile('frontend/public/data/jobs/'+name,'utf8'))
  const data=parseCompanyData(await read('company-intelligence.json'))
  if(!data) throw new Error('Fresh job release required')
  if(asOf<Date.parse(data.generated_at) || asOf>=Date.parse(data.valid_until)) throw new Error('Observation outside source validity')
  const primary=parseWorkspace(await read('workspace.json'),data)
  const remaining=parseWorkspace(await read('workspace-remaining.json'),data,{remaining:true})
  // Use every unexpired ad, not latestJobs()'s public 50 cap.
  const {jobInstant}=await import('../frontend/src/job-intelligence/model.ts')
  const active=data.jobs.filter(j=>!j.application_deadline || jobInstant(j.application_deadline,true)>=asOf)
  const rankings=rankCandidates(active,[...primary.jobs,...remaining.jobs],profile)
  const selected=rankings.filter(r=>r.suitable).slice(0,50)
  const hash=value=>createHash('sha256').update(value).digest('hex')
  const input_hashes=Object.fromEntries(await Promise.all(['company-intelligence.json','workspace.json','workspace-remaining.json'].map(async n=>[n,hash(await readFile('frontend/public/data/jobs/'+n))])))
  const engine_files=['frontend/src/job-intelligence/ranking.ts','frontend/src/job-intelligence/profile.ts','frontend/src/job-intelligence/model.ts','frontend/src/companies/model.ts']
  const engine_hash=hash((await Promise.all(engine_files.map(p=>readFile(p,'utf8')))).map(s=>s.replace(/\r\n?/g,'\n')).join(''))
  await writeFile(target,JSON.stringify({schema_version:1,scope:'private_local_only',generated_at:new Date().toISOString(),as_of:new Date(asOf).toISOString(),source_generated_at:data.generated_at,
    registry_hash:data.registry_hash,profile_source_sha256:profile.source.sha256,profile_configuration_sha256:hash(JSON.stringify(profile)),engine_sha256:engine_hash,input_hashes,candidates:active.length,suitable:rankings.filter(r=>r.suitable).length,
    selected: selected.map(r=>({...r,publication_date:active.find(j=>j.job_id===r.job_id).publication_date,source_url:active.find(j=>j.job_id===r.job_id).source_url,document_hash:active.find(j=>j.job_id===r.job_id).document_hash,
      company_id:data.links.find(l=>l.job_id===r.job_id && l.relationship_type==='advertised_employer' && l.match_status==='verified')?.company_id || null,
      requirements:r.requirements.map(({requirement,state,evidence})=>({requirement,state,profile_source_ref:evidence?.source_ref || null}))}))},null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({candidates:active.length,suitable:rankings.filter(r=>r.suitable).length,selected:selected.length,scope:'private_local_only'}))
} catch { console.error('Local ranking failed. Check private paths, qualification schema and source freshness. No candidate text is logged.');process.exitCode=1 }
