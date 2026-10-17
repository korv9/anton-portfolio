import { readFile } from 'node:fs/promises'
import { parseCompanyData } from '../frontend/src/companies/model.ts'
try {
  const data=parseCompanyData(JSON.parse(await readFile(new URL('../frontend/public/data/jobs/company-intelligence.json',import.meta.url),'utf8')),{allowExpired:true})
  console.log(data ? `Job/company contract valid: ${data.jobs.length} observed ads; ${Date.parse(data.valid_until)>Date.now()?'current':'expired, browser withholds records'}` : 'Job/company release unavailable')
} catch(error) {
  console.error('Job/company release rejected:',error.message)
  process.exitCode=1
}
