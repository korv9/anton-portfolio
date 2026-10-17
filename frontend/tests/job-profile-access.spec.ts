import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { test, expect } from './test'

test('local qualification service rejects cross-origin requests and Vite denies private filesystem artifacts', async ({
  page,
}) => {
  const path = resolve('.research', `job-profile-probe-${randomUUID()}.json`)
  const marker = 'PRIVATE_TEST_MARKER_' + randomUUID()
  await writeFile(path, JSON.stringify({ marker }), { flag: 'wx' })
  try {
    const raw = await page.request.get('/@fs/' + path.replaceAll('\\', '/'))
    expect(raw.status()).toBe(403)
    expect((await raw.text()).includes(marker)).toBe(false)
    const cross = await page.request.get('/__local/job-intelligence-profile', {
      headers: {
        Origin: 'https://example.com',
        'Sec-Fetch-Site': 'cross-site',
      },
    })
    expect(cross.status()).toBe(403)
    expect((await cross.text()).includes('profile_source')).toBe(false)
  } finally {
    await unlink(path)
  }
})
