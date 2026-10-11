import { createReadStream, existsSync } from 'node:fs'
import { resolve, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/** Dev-only access to the local lightweight gallery; raw data and matrices stay private. */
export function clusterLabPlugin(): Plugin {
  const root = resolve(
    fileURLToPath(new URL('../', import.meta.url)),
    process.env.CLUSTER_LAB_OUTPUT || 'warehouse/cluster_lab',
  )
  return {
    name: 'local-cluster-lab',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__cluster_lab', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end()
          return
        }
        let relative: string
        try {
          relative = decodeURIComponent((req.url || '/').split('?')[0])
        } catch {
          res.statusCode = 400
          res.end()
          return
        }
        const path = resolve(root, `gallery/${relative.replace(/^\/+/, '')}`)
        const galleryRoot = resolve(root, 'gallery')
        if (
          !path.startsWith(galleryRoot + sep) ||
          !['.json', '.png'].includes(extname(path))
        ) {
          res.statusCode = 403
          res.end()
          return
        }
        if (!existsSync(path)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end('{"error":"No local export yet"}')
          return
        }
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader(
          'Content-Type',
          extname(path) === '.png'
            ? 'image/png'
            : 'application/json; charset=utf-8',
        )
        createReadStream(path)
          .on('error', () => res.destroy())
          .pipe(res)
      })
    },
  }
}
