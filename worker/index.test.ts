/**
 * The Worker with env.AI and env.ASSETS mocked: the text_hash folding, the passage check against
 * the verification lists, the quote check after generation, the length limit and the 503 path.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, {
  canonical,
  checkQuotes,
  fold,
  PLATFORM_SYSTEM,
  textHash,
  type Env,
} from './index.ts'

const LAW = {
  id: 'sfs-1982-80-1',
  text: 'Lagen gäller arbetstagare i allmän och enskild tjänst.',
}
const DOC = {
  id: 'docs/pipeline.md#subjects',
  text: 'Times are UTC. "Weekly" is `build-warehouse.yml`, Saturday 21:13.',
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
    [`/data/workers-ai/platform/verify/${await shardOf(DOC.id)}.json`]: {
      [DOC.id]: await textHash(DOC.text),
    },
  }
  const calls: unknown[] = []
  return {
    calls,
    AI: {
      run: async (model, input) => {
        calls.push({ model, input })
        if (reply instanceof Error) throw reply
        return reply
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
  assert.equal(uncited.status, 'unverified')
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
})

test('answer: the platform corpus has its own prompt, quote check and 503 on a spent quota', async () => {
  const asked = (passages = [DOC]) =>
    post('/api/answer', {
      question: 'When does the weekly build run?',
      corpus: 'platform',
      passages,
    })
  const e = await env({
    response: 'On Saturdays [[docs/pipeline.md#subjects]]"Saturday 21:13".',
  })
  const verified = await (await worker.fetch(asked(), e)).json()
  assert.equal(verified.status, 'verified')
  const [{ input }] = e.calls as {
    input: { messages: { content: string }[] }
  }[]
  assert.equal(input.messages[0].content, PLATFORM_SYSTEM)
  // A law passage is not a platform passage.
  assert.equal((await worker.fetch(asked([LAW]), await env())).status, 400)
  const spent = await worker.fetch(
    asked(),
    await env(
      new Error(
        '4006: you have used up your daily free allocation of 10,000 neurons',
      ),
    ),
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
