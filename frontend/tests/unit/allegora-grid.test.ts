import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allegoryPrompt,
  answerPrompt,
  batchLine,
  inLaw,
  judge,
  parseOutputs,
  usableAllegory,
} from '../../../platform/publish/allegora/grid.ts'

const passage = {
  id: 'sfs-1982-80-11',
  title: 'LAS 11 §',
  url: 'https://example.test',
  text: 'Minsta uppsägningstid är en månad.',
}

test('a law takes its own passages, not those of a law with a similar number', () => {
  assert.ok(inLaw('sfs-1982-80-11', '1982:80'))
  assert.ok(!inLaw('sfs-1982-800-1', '1982:80'))
  assert.ok(!inLaw('sfs-1982-8-1', '1982:80'))
})

test('only verbatim quotes pass; a refusal and a failed line never do', () => {
  const quoted =
    'Tiden är [[sfs-1982-80-11]]"Minsta uppsägningstid är en månad".'
  const made = 'Tiden är [[sfs-1982-80-11]]"Minsta uppsägningstid är ett år".'
  const verdict = judge(quoted, [passage])
  assert.equal(verdict.status, 'verified')
  assert.equal(judge(made, [passage]).status, 'unverified')
  assert.equal(
    judge('[[other]]"Minsta uppsägningstid är en månad"', [passage]).status,
    'unverified',
  )
  assert.equal(judge('NO_ANSWER', [passage]).status, 'no_answer')
  assert.equal(judge('Inget citat alls.', [passage]).status, 'no_answer')
  assert.equal(judge(null, [passage]).status, 'failed')
})

test('outputs are matched by the prompt they echo, whatever their order', () => {
  const prompt = answerPrompt('Fråga?', [passage])
  const echo = JSON.parse(batchLine(prompt))
  const lines = [
    JSON.stringify({ ...echo, status: 'error' }).replace(
      prompt.user.slice(0, 5),
      'Annan',
    ),
    JSON.stringify({
      ...echo,
      response: {
        candidates: [{ content: { parts: [{ text: 'NO_ANSWER' }] } }],
        usageMetadata: {
          promptTokenCount: 7,
          candidatesTokenCount: 2,
          thoughtsTokenCount: 1,
        },
      },
    }),
  ].join('\n')
  const output = parseOutputs(lines).get(prompt.user)
  assert.deepEqual(output, {
    text: 'NO_ANSWER',
    usage: { tokens_in: 7, tokens_out: 3 },
  })
})

test('the allegory never sees a citation mark and may not write one', () => {
  const { user } = allegoryPrompt(
    'Fråga?',
    'Tiden är [[sfs-1982-80-11]]"en månad".',
  )
  assert.ok(!user.includes('[['))
  assert.ok(user.includes('"en månad"'))
  assert.equal(usableAllegory('En räv [[x]] sa.'), null)
  assert.equal(usableAllegory('En räv sa.'), 'En räv sa.')
})
