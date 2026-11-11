/**
 * The Worker with env.AI and env.ASSETS mocked: the text_hash folding, the passage check against
 * the verification lists, the quote check after generation, the length limit and the 503 path.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { type Env } from './index.ts'
import {
  ALLEGORY_SYSTEM,
  canonical,
  checkQuotes,
  fold,
  textHash,
} from './quotes.ts'

const LAW = {
  id: 'sfs-1982-80-1',
  text: 'Lagen gäller arbetstagare i allmän och enskild tjänst.',
}
// The longest passage the Worker accepts; one character more is refused before any AI call.
const LONG = { id: 'sfs-1962-700-1-1', text: 'a'.repeat(5000) }
const shardOf = async (id: string) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id))
  return [...new Uint8Array(d)]
    .slice(0, 1)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function env(
  reply: unknown | Error = {},
): Promise<Env & { calls: unknown[] }> {
  const lists: Record<string, Record<string, string>> = {
    [`/data/workers-ai/sfs/verify/${await shardOf(LAW.id)}.json`]: {
      [LAW.id]: await textHash(LAW.text),
    },
    [`/data/workers-ai/sfs/verify/${await shardOf(LONG.id)}.json`]: {
      [LONG.id]: await textHash(LONG.text),
    },
  }
  const calls: unknown[] = []
  return {
    calls,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    AI: {
      run: async (model, input) => {
        calls.push({ model, input })
        // A list answers each call in turn: the law answer, then its allegory.
        const next = Array.isArray(reply) ? reply[calls.length - 1] : reply
        if (next instanceof Error) throw next
        return next
      },
    },
    ASSETS: {
      fetch: async (r) => {
        const path = new URL(r.url).pathname
        if (path in lists) return Response.json(lists[path])
        return new Response(`asset ${path}`, {
          status: path === '/' ? 200 : 404,
        })
      },
    },
  }
}
const post = (path: string, body: unknown) =>
  new Request(`https://site.test${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
const ask = (passages = [LAW]) =>
  post('/api/answer', {
    question: 'Vem gäller lagen?',
    corpus: 'sfs',
    passages,
  })

test('fold matches platform/legal/parse.py text_hash', async () => {
  // python: parse.text_hash('Hej  “riksdagen” , x\nslut .')
  assert.equal(
    await textHash('Hej  \u201criksdagen\u201d ,\u00a0x\nslut .'),
    '61e20616ce7c7b829903641703d20460158617707d38749086d5cec4b3b3f2ee',
  )
  assert.equal(fold('\u2018a\u2019  \u201cb\u201d\u00a0\n c'), `'a' "b" c`)
})

test('quotes: verbatim after folding, missing, and under the wrong id', () => {
  const other = { id: 'sfs-1982-80-2', text: 'Annan text.' }
  const q = (answer: string) =>
    checkQuotes(answer, [LAW, other]).map((x) => x.verbatim)
  assert.deepEqual(
    q('Ja: [[sfs-1982-80-1]]\u201callmän  och enskild tjänst\u201d.'),
    [true],
  )
  assert.deepEqual(q('[[sfs-1982-80-1]]"privat tjänst"'), [false])
  assert.deepEqual(q('[[sfs-1982-80-2]]"allmän och enskild tjänst"'), [false])
  assert.deepEqual(q('[[sfs-9-9]]"Annan text."'), [false])
})

test('quotes: a quote written before its [[id]] is turned around and checked', () => {
  const other = { id: 'sfs-1982-80-2', text: 'Annan text.' }
  const q = (answer: string) =>
    checkQuotes(answer, [LAW, other]).map((x) => [x.id, x.verbatim])
  assert.equal(
    canonical('Den gäller "enskild tjänst" [[sfs-1982-80-1]].'),
    'Den gäller [[sfs-1982-80-1]]"enskild tjänst".',
  )
  assert.deepEqual(q('"enskild tjänst" [[sfs-1982-80-2]]'), [
    ['sfs-1982-80-2', false],
  ])
  // In the usual order the quote after an [[id]] stays with that id, not the next one.
  assert.deepEqual(
    q('[[sfs-1982-80-1]]"enskild tjänst" [[sfs-1982-80-2]]"Annan text."'),
    [
      ['sfs-1982-80-1', true],
      ['sfs-1982-80-2', true],
    ],
  )
  assert.deepEqual(
    q('Ord som "lagen" står [[sfs-1982-80-1]]"enskild tjänst"'),
    [['sfs-1982-80-1', true]],
  )
})

test('quotes: Markdown marks are ignored on both sides, the words are not', () => {
  const table = {
    id: 'docs/platform/taxes.md#checks',
    text: '| Part | Source |\n|---|---|\n| Tax on a **salary** | OECD `Taxing Wages` |',
  }
  const q = (quote: string) =>
    checkQuotes(`[[${table.id}]]"${quote}"`, [table]).map((x) => x.verbatim)
  assert.deepEqual(q('Tax on a salary OECD Taxing Wages'), [true])
  assert.deepEqual(q('Tax on a **salary** |'), [true])
  assert.deepEqual(q('Tax on a wage'), [false])
  assert.deepEqual(q('| **'), [false])
})

test('quotes: harmless format variants pass, a citation without a quote fails', () => {
  const q = (answer: string) =>
    checkQuotes(answer, [LAW]).map((x) => x.verbatim)
  assert.deepEqual(q('[[sfs-1982-80-1]]: "enskild tjänst"'), [true])
  assert.deepEqual(q('[[sfs-1982-80-1]] ”enskild tjänst”'), [true])
  assert.deepEqual(
    q('Ja [[sfs-1982-80-1]]. Och [[sfs-1982-80-1]]"enskild tjänst"'),
    [false, true],
  )
  assert.deepEqual(q('[[sfs-1982-80-1]]"Enskild tjänst"'), [false])
})

test('assets pass through untouched', async () => {
  const r = await worker.fetch(new Request('https://site.test/'), await env())
  assert.equal(await r.text(), 'asset /')
})

test('page addresses get the app shell; missing files and data 404', async () => {
  const e = await env()
  const get = (path: string) =>
    worker.fetch(new Request(`https://site.test${path}`), e)
  const page = await get('/companies/x')
  assert.equal(page.status, 200)
  assert.equal(await page.text(), 'asset /')
  for (const path of [
    '/data/missing.json',
    '/data/dir',
    '/assets/gone.js',
    '/x.png',
  ]) {
    const r = await get(path)
    assert.equal(r.status, 404, path)
    assert.equal(await r.text(), `asset ${path}`)
  }
})

test('embed: length limit, vector, and 503 on a spent quota', async () => {
  const e = await env({ data: [[0.1, 0.2]] })
  assert.equal(
    (await worker.fetch(post('/api/embed', { text: 'x'.repeat(501) }), e))
      .status,
    400,
  )
  assert.equal(
    (await worker.fetch(post('/api/embed', { text: ' ' }), e)).status,
    400,
  )
  const ok = await worker.fetch(
    post('/api/embed', { text: 'Hej riksdagen' }),
    e,
  )
  assert.deepEqual(await ok.json(), { vector: [0.1, 0.2] })
  assert.equal(ok.headers.get('Cache-Control'), 'no-store')
  const spent = await worker.fetch(
    post('/api/embed', { text: 'Hej' }),
    await env(
      new Error(
        '4006: you have used up your daily free allocation of 10,000 neurons',
      ),
    ),
  )
  assert.equal(spent.status, 503)
  assert.deepEqual(await spent.json(), { reason: 'quota' })
  const broken = await worker.fetch(
    post('/api/embed', { text: 'Hej' }),
    await env(new Error('boom')),
  )
  assert.deepEqual(await broken.json(), { reason: 'error' })
})

test('answer: passages must be published ids with verbatim text', async () => {
  const e = await env({ response: 'unused' })
  const edited = await worker.fetch(
    ask([{ ...LAW, text: 'Lagen gäller alla.' }]),
    e,
  )
  assert.equal(edited.status, 400)
  const unknown = await worker.fetch(ask([{ ...LAW, id: 'sfs-0-0' }]), e)
  assert.equal(unknown.status, 400)
  const retired = await worker.fetch(
    post('/api/answer', {
      question: 'Vem?',
      corpus: 'platform',
      passages: [LAW],
    }),
    e,
  )
  assert.equal(retired.status, 400)
  assert.equal((await worker.fetch(post('/api/answer', []), e)).status, 400)
  assert.equal(e.calls.length, 0)
  // Folded white space and quote styles still match the published hash.
  const spaced = await worker.fetch(
    ask([
      {
        ...LAW,
        text: ' Lagen gäller arbetstagare i  allmän och enskild\ntjänst. ',
      },
    ]),
    await env({ response: '[[sfs-1982-80-1]]"enskild tjänst"' }),
  )
  assert.equal(spaced.status, 200)
})

test('answer: verified, unverified, no answer and 503', async () => {
  const verified = await (
    await worker.fetch(
      ask(),
      await env({
        response:
          'Den gäller [[sfs-1982-80-1]]\u201dallmän och enskild tjänst\u201d.',
      }),
    )
  ).json()
  assert.equal(verified.status, 'verified')
  assert.deepEqual(verified.quotes, [
    { id: LAW.id, quote: 'allmän och enskild tjänst' },
  ])
  const invented = await (
    await worker.fetch(
      ask(),
      await env({ response: '[[sfs-1982-80-1]]"all tjänst"' }),
    )
  ).json()
  assert.deepEqual(invented, { status: 'unverified', passages: [LAW] })
  const uncited = await (
    await worker.fetch(ask(), await env({ response: 'Alla.' }))
  ).json()
  assert.equal(uncited.status, 'no_answer')
  const dotted = await (
    await worker.fetch(ask(), await env({ response: 'NO_ANSWER.' }))
  ).json()
  assert.equal(dotted.status, 'no_answer')
  const unknown = await (
    await worker.fetch(
      ask(),
      await env({ choices: [{ message: { content: 'NO_ANSWER' } }] }),
    )
  ).json()
  assert.equal(unknown.status, 'no_answer')
  const down = await worker.fetch(
    ask(),
    await env(new Error('Capacity temporarily exceeded')),
  )
  assert.equal(down.status, 503)
  assert.deepEqual(await down.json(), { reason: 'error' })
  const spent = await worker.fetch(
    ask(),
    await env(new Error('4006: daily free allocation of neurons used up')),
  )
  assert.equal(spent.status, 503)
  assert.deepEqual(await spent.json(), { reason: 'quota' })
})

test('answer: a passage may be up to MAX_PASSAGE characters', async () => {
  const e = await env({ response: '[[sfs-1962-700-1-1]]"aaa"' })
  assert.equal((await worker.fetch(ask([LONG]), e)).status, 200)
  const over = await env({ response: 'unused' })
  const r = await worker.fetch(ask([{ ...LONG, text: LONG.text + 'a' }]), over)
  assert.equal(r.status, 400)
  assert.equal(over.calls.length, 0)
})

test('rate limit and methods', async () => {
  const e = await env({ data: [[1]] })
  e.RATE_LIMITER = { limit: async () => ({ success: false }) }
  assert.equal(
    (await worker.fetch(post('/api/embed', { text: 'Hej' }), e)).status,
    429,
  )
  const get = await worker.fetch(
    new Request('https://site.test/api/embed'),
    await env(),
  )
  assert.equal(get.status, 405)
  const none = await worker.fetch(post('/api/nothing', {}), await env())
  assert.equal(none.status, 404)
})

test('answer: the checked law answer is retold as a moral allegory, and the answer stays', async () => {
  const law = {
    response: 'Den gäller [[sfs-1982-80-1]]"allmän och enskild tjänst".',
  }
  const fable =
    'En räv och en hare arbetade i samma verkstad. Sensmoral: regeln gäller alla.'
  const e = await env([law, { response: fable }])
  const told = await (await worker.fetch(ask(), e)).json()
  assert.equal(told.status, 'verified')
  assert.equal(told.allegory, fable)
  assert.equal(told.answer, law.response)
  // The allegory is told from the checked answer, not from the passages.
  const [, second] = e.calls as { input: { messages: { content: string }[] } }[]
  assert.equal(second.input.messages[0].content, ALLEGORY_SYSTEM)
  assert.match(
    second.input.messages[1].content,
    /Checked answer: Den gäller "allmän och enskild tjänst"/,
  )
  assert.doesNotMatch(second.input.messages[1].content, /arbetstagare/)
  // A retelling that fails or cites leaves the checked answer without an allegory.
  for (const story of [new Error('busy'), { response: 'Som [[x]] säger.' }]) {
    const plain = await (
      await worker.fetch(ask(), await env([law, story]))
    ).json()
    assert.equal(plain.status, 'verified')
    assert.equal(plain.allegory, undefined)
  }
  // Nothing checked, nothing retold.
  const none = await env([{ response: 'NO_ANSWER' }])
  await worker.fetch(ask(), none)
  assert.equal(none.calls.length, 1)
})

test('AI routes refuse foreign origins and fail closed without the limiter', async () => {
  const e = await env({ data: [[0.1]] })
  const from = (origin?: string) =>
    new Request('https://site.test/api/embed', {
      method: 'POST',
      headers: origin ? { Origin: origin } : {},
      body: JSON.stringify({ text: 'hej' }),
    })
  const foreign = await worker.fetch(from('https://evil.test'), e)
  assert.equal(foreign.status, 403)
  assert.equal(e.calls.length, 0)
  assert.equal((await worker.fetch(from('https://site.test'), e)).status, 200)
  assert.equal((await worker.fetch(from(), e)).status, 200)
  const { RATE_LIMITER: _, ...unbound } = e
  assert.equal(
    (await worker.fetch(from('https://site.test'), unbound)).status,
    503,
  )
  assert.equal(e.calls.length, 2)
})

test('answer: sfs-all takes its passages from the search service, unchecked against lists', async () => {
  const e = await env({ response: `Ja [[${LAW.id}]]"${LAW.text}"` })
  const sent: { url: string; key: string | null; body: unknown }[] = []
  const real = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({
      url,
      key: new Headers(init.headers).get('X-Allegora-Key'),
      body: JSON.parse(String(init.body)),
    })
    return Response.json({
      hits: [
        {
          ...LAW,
          title: 'LAS 1 §',
          url: 'https://x.test',
          law: '1982:80',
          kind: 'lag',
          score: 0.8,
        },
      ],
    })
  }) as typeof fetch
  try {
    const off = await worker.fetch(
      post('/api/answer', { question: 'Vem gäller lagen?', corpus: 'sfs-all' }),
      e,
    )
    assert.equal(off.status, 503, 'no service configured')
    const kv = new Map<string, string>()
    Object.assign(e, {
      QUOTA: {
        get: async (k: string) => kv.get(k) ?? null,
        put: async (k: string, v: string) => void kv.set(k, v),
      },
      ALLEGORA_SEARCH_URL: 'https://search.test',
      ALLEGORA_SEARCH_KEY: 'k',
    })
    const r = await worker.fetch(
      post('/api/answer', {
        question: 'Vem gäller lagen?',
        corpus: 'sfs-all',
        passages: [{ id: 'x', text: 'forged' }],
      }),
      e,
    )
    const body = (await r.json()) as {
      status: string
      hits: { id: string; title: string }[]
    }
    assert.equal(body.status, 'verified')
    assert.deepEqual(
      body.hits.map((h) => [h.id, h.title]),
      [[LAW.id, 'LAS 1 §']],
    )
    assert.deepEqual(sent, [
      {
        url: 'https://search.test/search',
        key: 'k',
        body: { question: 'Vem gäller lagen?', k: 8 },
      },
    ])
  } finally {
    globalThis.fetch = real
  }
})

test('quota: PER_VISITOR questions a visitor a day, then 429; a new day starts over', async () => {
  const { take, PER_VISITOR } = await import('./quota.ts')
  const kv = new Map<string, string>()
  const store = {
    get: async (k: string) => kv.get(k) ?? null,
    put: async (k: string, v: string) => void kv.set(k, v),
  }
  const day = new Date('2026-11-02T12:00:00Z')
  for (let i = 0; i < PER_VISITOR; i++)
    assert.equal((await take(store, '1.2.3.4', day)).ok, true)
  assert.deepEqual(await take(store, '1.2.3.4', day), {
    ok: false,
    reason: 'limit',
  })
  assert.equal((await take(store, '5.6.7.8', day)).ok, true)
  assert.equal(
    (await take(store, '1.2.3.4', new Date('2026-11-03T00:00:01Z'))).ok,
    true,
  )
  assert.ok(
    ![...kv.keys()].some((k) => k.includes('1.2.3.4')),
    'IPs are hashed',
  )
})
