// CI/build gate for the local static projection. Human approval is performed by explorer.py promote.
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseRelease } from '../frontend/src/compliance/model.ts'
import { parseProgress } from '../frontend/src/compliance/progress.ts'

const path = process.argv[2] || new URL('../frontend/public/data/compliance/release.json', import.meta.url)
try {
  const release = await parseRelease(JSON.parse(await readFile(path, 'utf8')))
  if (!process.argv[2]) {
    try {
      parseProgress(JSON.parse(await readFile(new URL('../frontend/public/data/compliance/progress.json', import.meta.url), 'utf8')))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  if (release) {
    const hash=createHash('sha256')
    for (const name of ['model.ts','exports.ts','ComplianceExplorer.tsx','compliance.css','progress.ts','../companies/model.ts','../companies/CompanyIntelligence.tsx','../companies/companies.css']) hash.update((await readFile(new URL('../frontend/src/compliance/'+name,import.meta.url),'utf8')).replace(/\r\n?/g,'\n'))
    if (hash.digest('hex') !== release.payload.presentation_sha256) throw new Error('Presentation changed after final review; stage and review again')
  }
  console.log(release ? `Compliance release verified: ${release.publication.payload_sha256}` : 'Compliance release held: no public company data')
} catch (error) {
  console.error('Compliance public release rejected:', error.message)
  process.exitCode = 1
}
