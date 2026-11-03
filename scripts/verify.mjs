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
const quick = ['check', 'format:check', 'test:unit', 'knip']
const plans = {
  quick,
  // Everything here but knip also runs in ci.yml; none of these steps needs a secret.
  full: [
    ...quick,
    'build',
    'wrangler-dry-run',
    'lint-imports',
    'python-tests',
    'dbt-compile',
    'test:security:built',
    'test:e2e',
  ],
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
  const { chromium } = await import('@playwright/test')
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
  const command = {
    'python-tests': [
      python,
      [
        '-m',
        'pytest',
        'platform/tests',
        '-q',
        `--basetemp=${join(logs, 'pytest')}`,
      ],
    ],
    'pipeline-dry-run': [
      python,
      ['platform/pipeline.py', 'run', '--all', '--dry-run'],
    ],
    'wrangler-dry-run': [
      process.execPath,
      ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run'],
    ],
    'lint-imports': ['lint-imports', []],
    'dbt-compile': ['dbt', ['compile', '--profiles-dir', '.']],
  }[step] ?? [process.execPath, [npmCli, 'run', step]]
  // As in CI, dbt compiles against an empty warehouse of its own, not the local one.
  const dbt = step === 'dbt-compile'
  if (dbt) mkdirSync(join(logs, 'raw'))
  const file = join(logs, `${step.replaceAll(':', '-')}.log`)
  const descriptor = openSync(file, 'w')
  const started = Date.now()
  const result = spawnSync(command[0], command[1], {
    cwd: dbt ? join(root, 'platform') : root,
    env: dbt
      ? {
          ...process.env,
          DBT_SEND_ANONYMOUS_USAGE_STATS: 'false',
          PORTFOLIO_DB: join(logs, 'ci.duckdb'),
          PORTFOLIO_RAW: join(logs, 'raw'),
        }
      : process.env,
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
