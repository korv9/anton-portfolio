import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
const quick = ['check', 'format:check', 'test:unit']
const plans = {
  quick,
  full: [...quick, 'build', 'python-tests', 'test:security:built', 'test:e2e'],
  delivery: ['data:check', 'pipeline-dry-run', 'politics:check'],
}
if (!(mode in plans)) {
  process.stderr.write(
    'Usage: npm run verify:{quick|full|delivery} [-- --plan]\n',
  )
  process.exit(2)
}
if (process.argv.includes('--plan')) {
  process.stdout.write(JSON.stringify(plans[mode]) + '\n')
  process.exit(0)
}

const python = process.env.PYTHON ?? 'python'
const preflight = spawnSync(python, ['scripts/preflight.py', '--level', mode], {
  cwd: root,
  stdio: 'inherit',
})
if (preflight.error) throw preflight.error
if (preflight.status !== 0) process.exit(preflight.status ?? 1)

if (mode === 'full') {
  const { chromium } = await import('playwright')
  const executable =
    process.env.PLAYWRIGHT_CHROMIUM_PATH ?? chromium.executablePath()
  if (!existsSync(executable)) {
    process.stderr.write(
      'Chromium is missing. Set PLAYWRIGHT_CHROMIUM_PATH to an existing browser or request installation.\n',
    )
    process.exit(1)
  }
}

const npmCli = [
  process.env.npm_execpath,
  join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
].find((path) => path && existsSync(path))
if (!npmCli)
  throw new Error('npm CLI unavailable; run through npm run verify:<level>')
const logs = join(root, 'tmp/checks', `${Date.now()}-${process.pid}`)
mkdirSync(logs, { recursive: true })
for (const step of plans[mode]) {
  const command =
    step === 'python-tests'
      ? [
          python,
          [
            '-m',
            'pytest',
            'platform/tests',
            '-q',
            `--basetemp=${join(logs, 'pytest')}`,
          ],
        ]
      : step === 'pipeline-dry-run'
        ? [python, ['platform/pipeline.py', 'run', '--all', '--dry-run']]
        : [process.execPath, [npmCli, 'run', step]]
  const file = join(logs, `${step.replaceAll(':', '-')}.log`)
  const descriptor = openSync(file, 'w')
  const started = Date.now()
  const result = spawnSync(command[0], command[1], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', descriptor, descriptor],
  })
  closeSync(descriptor)
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  process.stdout.write(
    `${step}: ${result.status === 0 ? 'PASS' : 'FAIL'} (${seconds}s) ${file}\n`,
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stderr.write(
      readFileSync(file, 'utf8').split('\n').slice(-18).join('\n').slice(-4000),
    )
    process.exit(result.status ?? 1)
  }
  if (step === 'python-tests') {
    const temporary = join(logs, 'pytest')
    if (dirname(temporary) !== logs)
      throw new Error('Invalid test cleanup path')
    rmSync(temporary, { recursive: true })
  }
}
