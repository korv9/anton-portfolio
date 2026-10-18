import { readFileSync, realpathSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { parseProfile } from './src/job-intelligence/profile.ts'

export const PROFILE_PATH = '/__local/job-intelligence-profile'
export function localProfileAllowed(
  host: string,
  remote: string,
  origin: string | undefined,
) {
  try {
    const url = new URL('http://' + host)
    return (
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) &&
      (!origin || origin === url.origin)
    )
  } catch {
    return false
  }
}
export function jobProfilePlugin(): Plugin {
  const repo = fileURLToPath(new URL('../', import.meta.url))
  return {
    name: 'local-job-profile',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== PROFILE_PATH) return next()
        res.setHeader('Cache-Control', 'no-store, private')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        if (
          req.method !== 'GET' ||
          !localProfileAllowed(
            req.headers.host || '',
            req.socket.remoteAddress || '',
            req.headers.origin,
          ) ||
          req.headers['sec-fetch-site'] === 'cross-site'
        ) {
          res.statusCode = 403
          res.end('{"state":"forbidden"}')
          return
        }
        const configured = process.env.JOB_INTELLIGENCE_PRIVATE_PROFILE
        if (!configured) {
          res.statusCode = 404
          res.end('{"state":"disabled"}')
          return
        }
        try {
          const path = realpathSync(resolve(repo, configured))
          const privateRoot = realpathSync(resolve(repo, '.research')) + sep
          if (!path.startsWith(privateRoot) || !path.endsWith('.json'))
            throw new Error('Private path required')
          const raw = readFileSync(path, 'utf8')
          if (raw.length > 40000) throw new Error('Profile too large')
          const profile = parseProfile(JSON.parse(raw))
          res.end(JSON.stringify({ state: 'local', profile }))
        } catch {
          res.statusCode = 422
          res.end('{"state":"invalid_profile"}')
        }
      })
    },
  }
}
