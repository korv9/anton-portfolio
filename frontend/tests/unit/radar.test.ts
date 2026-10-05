/**
 * The eclipse radar's axes: a skill counts once for itself and once per job or project that
 * names it, by its own name or an alias, as a whole word.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matches, skillAxes } from '../../src/home/radar.ts'

test('a skill matches whole words and its aliases, not parts of other words', () => {
  assert.ok(matches('SQL', 'Python, Spark SQL and dbt'))
  assert.ok(matches('dbt Core', 'tested dbt models'))
  assert.ok(!matches('Git', 'GitHub Actions'))
  assert.ok(matches('Klustring', 'embeddings and clustering'))
})

test('an axis is one for the skill plus one per use', () => {
  const axes = skillAxes(
    [{ group: 'Data', skills: ['Python', 'Git'] }],
    [
      { name: 'Fora', text: 'Python · PySpark' },
      { name: 'Politics', text: 'Python, dbt' },
    ],
  )
  assert.deepEqual(axes, [
    { skill: 'Python', group: 'Data', uses: ['Fora', 'Politics'], value: 3 },
    { skill: 'Git', group: 'Data', uses: [], value: 1 },
  ])
})
