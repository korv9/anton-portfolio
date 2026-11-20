/**
 * CPU time of one POST /api/ask in the Worker's own code (docs/products/allegora/allegora-gcp.md), measured in Node
 * with the network mocked, since the Free plan allows 10 ms of CPU per request.
 *
 *   node --experimental-strip-types platform/publish/allegora/cpu_ask.ts [--deltas 150] [--runs 50]
 *
 * The search answers eight paragraphs of 2,000 characters; Claude streams the answer in --deltas
 * pieces and then the fable. process.cpuUsage() counts user and system CPU of the whole process
 * from the request to the last event read, so it includes the test's own reading of the stream:
 * an upper bound. Waiting on the mocked network costs no CPU, as in a Worker. Windows counts CPU
 * in 15.6 ms ticks, so the mean over --runs requests is reported, after one warm-up request.
 */
import worker, { type Env } from '../../../worker/index.ts'

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? Number(process.argv[i + 1]) : fallback
}
const DELTAS = arg('deltas', 150)
const RUNS = arg('runs', 50)

const passage = 'Hyresvärden har rätt att få tillträde till lägenheten. '.repeat(36)
const hits = Array.from({ length: 8 }, (_, n) => ({
  id: `sfs-1970-994-12-${n + 20}`, title: `Jordabalk 12 kap. ${n + 20} §`, url: 'https://x.test',
  text: passage, law: '1970:994', kind: 'lag', score: 0.8 - n / 100,
}))
const quote = 'Hyresvärden har rätt att få tillträde till lägenheten'
const pieces = [
  `Ja [[${hits[0].id}]]"${quote}". `,
  ...Array.from({ length: DELTAS - 1 }, () => 'och så vidare '),
]
const events = [
  { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant',
    model: 'claude-sonnet-5-5', content: [], stop_reason: null,
    usage: { input_tokens: 2000, output_tokens: 1 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  ...pieces.map((text) => ({ type: 'content_block_delta', index: 0,
    delta: { type: 'text_delta', text } })),
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 380 } },
  { type: 'message_stop' },
]
const stream = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
const fable = {
  id: 'f', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
  content: [{ type: 'text', text: 'En grävling knackade. Sensmoral: Knacka först.' }],
  stop_reason: 'end_turn', usage: { input_tokens: 300, output_tokens: 120 },
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url.startsWith('https://search.test')) return Response.json({ hits })
  const body = JSON.parse(String(init?.body ?? (await (input as Request).text())))
  // The stream arrives in many small chunks, as it does from the API.
  if (!body.stream) return Response.json(fable)
  const bytes = new TextEncoder().encode(stream)
  return new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 256) controller.enqueue(bytes.slice(i, i + 256))
      controller.close()
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } })
}) as typeof fetch
console.log = () => {}

const env = {
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  QUOTA: { get: async () => null, put: async () => {} },
  ALLEGORA_SEARCH_URL: 'https://search.test', ALLEGORA_SEARCH_KEY: 'k', ANTHROPIC_API_KEY: 'a',
} as unknown as Env

const ask = async () => {
  const response = await worker.fetch(new Request('https://antonernstsson.com/api/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Får hyresvärden gå in i lägenheten?' }),
  }), env)
  const text = await response.text()
  if (!text.includes('"status":"verified"')) throw new Error('the mocked answer did not verify')
}

const cpu = (since: NodeJS.CpuUsage) => {
  const used = process.cpuUsage(since)
  return (used.user + used.system) / 1000
}
let since = process.cpuUsage()
await ask()
const first = cpu(since)
since = process.cpuUsage()
for (let i = 0; i < RUNS; i++) await ask()
process.stdout.write(JSON.stringify({
  deltas: DELTAS, runs: RUNS, first_ms: +first.toFixed(1), mean_ms: +(cpu(since) / RUNS).toFixed(2),
}) + '\n')
