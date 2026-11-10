/**
 * POST /api/ask with the search service and the Anthropic API mocked on fetch: the order of the
 * events, the draft that is only a draft, the threshold that spares Claude, the follow-up query,
 * and the failures that answer JSON before the stream begins.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { type Env } from './index.ts'

const LAW = {
  id: 'sfs-1970-994-12-26',
  text: 'Hyresvärden har rätt att få tillträde.\n\nBesöket ska meddelas i förväg.',
}
const HIT = {
  ...LAW,
  title: 'JB 12 kap. 26 §',
  url: 'https://x.test',
  law: '1970:994',
  kind: 'lag',
}
const ANSWER = ['Ja, men ', `[[${LAW.id}]]"Besöket ska meddelas`, ' i förväg".']
const FABLE =
  'Grävlingen knackade först.\nSensmoral: Den som knackar får komma in.'

const sse = (events: object[]) =>
  new Response(
    events
      .map(
        (e) =>
          `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`,
      )
      .join(''),
    { headers: { 'Content-Type': 'text/event-stream' } },
  )

/** Claude's streamed answer, written in the given pieces. */
const streamed = (pieces: string[]) =>
  sse([
    {
      type: 'message_start',
      message: {
        id: 'm',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5-5',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 900, output_tokens: 1 },
      },
    },
    {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    },
    ...pieces.map((text) => ({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    })),
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 40 },
    },
    { type: 'message_stop' },
  ])

const message = (text: string) =>
  Response.json({
    id: 'f',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 200, output_tokens: 80 },
  })

type Sent = { url: string; body: Record<string, unknown> }

/** fetch mocked for one test: the search answers hits, Claude answers each call in turn. */
async function withFetch(
  claude: (() => Response)[],
  run: (sent: Sent[]) => Promise<void>,
  hits: object[] = [{ ...HIT, score: 0.81 }],
) {
  const sent: Sent[] = []
  const real = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const body = JSON.parse(await request.text())
    sent.push({ url: request.url, body })
    if (request.url.startsWith('https://search.test'))
      return Response.json({ hits })
    const next = claude.shift()
    if (!next) throw new Error('unexpected Claude call')
    return next()
  }) as typeof fetch
  try {
    await run(sent)
  } finally {
    globalThis.fetch = real
  }
}

function env(spent = false): Env {
  return {
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    QUOTA: { get: async () => (spent ? '999' : null), put: async () => {} },
    ALLEGORA_SEARCH_URL: 'https://search.test',
    ALLEGORA_SEARCH_KEY: 'k',
    ANTHROPIC_API_KEY: 'a',
  } as unknown as Env
}

const ask = (body: unknown, e = env()) =>
  worker.fetch(
    new Request('https://antonernstsson.com/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    e,
  )

/** The event names, a run of draft pieces counted once. */
const order = (got: { name: string }[]) =>
  got
    .map((e) => e.name)
    .filter((n, i, all) => n !== 'delta' || all[i - 1] !== 'delta')

async function events(response: Response) {
  assert.match(response.headers.get('Content-Type') ?? '', /text\/event-stream/)
  return (await response.text())
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const [, name] = block.match(/^event: (.+)$/m)!
      const [, data] = block.match(/^data: (.+)$/m)!
      return { name, data: JSON.parse(data) }
    })
}

test('ask: hits, the draft, the checked result, then the fable told from it', async () => {
  await withFetch(
    [() => streamed(ANSWER), () => message(FABLE)],
    async (sent) => {
      const got = await events(
        await ask({ question: 'Får hyresvärden gå in?' }),
      )
      assert.deepEqual(order(got), ['hits', 'delta', 'result', 'fable', 'done'])
      assert.equal(got[0].data.hits[0].id, LAW.id)
      const draft = got
        .filter((e) => e.name === 'delta')
        .map((e) => e.data.text)
        .join('')
      assert.equal(draft, ANSWER.join(''))
      const result = got.find((e) => e.name === 'result')!.data
      assert.equal(result.status, 'verified')
      assert.deepEqual(result.quotes, [
        { id: LAW.id, quote: 'Besöket ska meddelas i förväg' },
      ])
      assert.equal(got.find((e) => e.name === 'fable')!.data.allegory, FABLE)
      // The fable is told from the checked answer, its quotes as plain text, never the passages.
      const fableAsk = JSON.stringify(sent[2].body.messages)
      assert.ok(fableAsk.includes('\\"Besöket ska meddelas i förväg\\"'))
      assert.ok(!fableAsk.includes('[['))
      assert.ok(!fableAsk.includes('tillträde'))
    },
  )
})

test('ask: a quote that is not in its passage drops the draft and tells no fable', async () => {
  const forged = ['Nej ', `[[${LAW.id}]]"Hyresvärden får alltid gå in"`]
  await withFetch([() => streamed(forged)], async () => {
    const got = await events(await ask({ question: 'Får hyresvärden gå in?' }))
    assert.deepEqual(order(got), ['hits', 'delta', 'result', 'done'])
    const result = got.find((e) => e.name === 'result')!.data
    assert.equal(result.status, 'unverified')
    assert.equal(result.answer, undefined)
  })
})

test('ask: below MIN_SCORE the answer is no_answer and Claude is not called', async () => {
  await withFetch(
    [],
    async (sent) => {
      const got = await events(await ask({ question: 'Hur bakar man bröd?' }))
      assert.deepEqual(
        got.map((e) => e.name),
        ['hits', 'result', 'done'],
      )
      assert.deepEqual(got[1].data, {
        status: 'no_answer',
        reason: 'threshold',
      })
      assert.equal(sent.length, 1)
    },
    [{ ...HIT, score: 0.68 }],
  )
})

test('ask: a follow-up searches with the previous question and shows the thread', async () => {
  await withFetch(
    [() => streamed(ANSWER), () => message(FABLE)],
    async (sent) => {
      const history = [
        { question: 'Bad', answer: 'x'.repeat(2000) },
        {
          question: 'Får hyresvärden gå in?',
          answer: `Ja [[${LAW.id}]]"Hyresvärden har rätt"`,
        },
      ]
      await events(await ask({ question: 'Och om jag är bortrest?', history }))
      assert.equal(
        sent[0].body.question,
        'Får hyresvärden gå in? Och om jag är bortrest?',
      )
      const user = JSON.stringify(sent[1].body.messages)
      assert.ok(user.includes('Earlier in this conversation'))
      assert.ok(user.includes('Answer: Ja \\"Hyresvärden har rätt\\"'))
      // A turn with an answer longer than the limit is left out.
      assert.ok(!user.includes('Question: Bad'))
    },
  )
})

test('ask: Claude failing mid-stream ends with an error event', async () => {
  await withFetch([() => new Response('{}', { status: 500 })], async () => {
    const got = await events(await ask({ question: 'Får hyresvärden gå in?' }))
    assert.deepEqual(
      got.map((e) => e.name),
      ['hits', 'error', 'done'],
    )
  })
})

test('ask: input, allowance, configuration and search fail as JSON before the stream', async () => {
  assert.equal((await ask({ question: '' })).status, 400)
  assert.equal((await ask({ question: 'x'.repeat(501) })).status, 400)
  const spent = await ask({ question: 'Får hyresvärden gå in?' }, env(true))
  assert.equal(spent.status, 429)
  assert.deepEqual(await spent.json(), { reason: 'limit' })
  const bare = { ...env(), QUOTA: undefined } as unknown as Env
  assert.equal(
    (await ask({ question: 'Får hyresvärden gå in?' }, bare)).status,
    503,
  )
  const real = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response('', { status: 500 })) as typeof fetch
  try {
    const down = await ask({ question: 'Får hyresvärden gå in?' })
    assert.equal(down.status, 503)
    assert.deepEqual(await down.json(), { reason: 'error' })
  } finally {
    globalThis.fetch = real
  }
})

test('warm: wakes the search service at /health and answers 204', async () => {
  const real = globalThis.fetch
  const woken: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    woken.push(String(input))
    return Response.json({ n: 1 })
  }) as typeof fetch
  try {
    const response = await worker.fetch(
      new Request('https://antonernstsson.com/api/warm', { method: 'POST' }),
      env(),
    )
    assert.equal(response.status, 204)
    assert.deepEqual(woken, ['https://search.test/health'])
  } finally {
    globalThis.fetch = real
  }
})
