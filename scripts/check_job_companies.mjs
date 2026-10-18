import { readFile } from 'node:fs/promises'
import { parseCompanyData } from '../frontend/src/companies/model.ts'
import { parseWorkspace } from '../frontend/src/job-intelligence/model.ts'
try {
  const data=parseCompanyData(JSON.parse(await readFile(new URL('../frontend/public/data/jobs/company-intelligence.json',import.meta.url),'utf8')),{allowExpired:true})
  console.log(data ? `Job/company contract valid: ${data.jobs.length} observed ads; ${Date.parse(data.valid_until)>Date.now()?'current':'expired, browser withholds records'}` : 'Job/company release unavailable')
  const workspace = JSON.parse(await readFile(new URL('../frontend/public/data/jobs/workspace.json',import.meta.url),'utf8'))
  if (data && workspace.state === 'available') {
    // Build validates the contract even after the observation window expires; browsers enforce freshness.
    parseWorkspace(workspace,data,{allowExpired:true})
    const remaining = JSON.parse(await readFile(new URL('../frontend/public/data/jobs/workspace-remaining.json',import.meta.url),'utf8'))
    parseWorkspace(remaining,data,{allowExpired:true,remaining:true})
    console.log(`Job fulltext contract valid: ${workspace.jobs.length} pinned source versions`)
  } else if (workspace.schema_version !== 1 || workspace.state !== 'unavailable') throw new Error('Invalid job fulltext availability state')
} catch(error) {
  console.error('Job/company release rejected:',error.message)
  process.exitCode=1
}
