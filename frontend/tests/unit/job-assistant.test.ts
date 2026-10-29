/** The job assistant's desk: rows and marks, list tabs, filters, sorting and the ad lead. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  https,
  keptNote,
  recordsNote,
  rows,
  unmatchedNote,
  type Ad,
  type Delivered,
  type Match,
} from '../../src/job-assistant/model.ts'
import {
  DEFAULT_QUERY,
  daysBetween,
  facetCounts,
  isFiltered,
  listCounts,
  parseQuery,
  queryParams,
  search,
  splitLead,
  syncAge,
} from '../../src/job-assistant/query.ts'
import { merge } from '../../src/job-assistant/mine.ts'
import { parseHash } from '../../src/router.ts'

const ad = (id: string, extra: Partial<Ad> = {}): Ad => ({
  id,
  headline: `Data Engineer ${id}`,
  employer: 'Exempel AB',
  municipality: 'Stockholm',
  region: 'Stockholms län',
  occupation: null,
  employment_type: null,
  working_hours: null,
  published: `2026-10-2${id}T08:00:00`,
  changed: null,
  first_seen: '2026-10-23T10:00:00+00:00',
  application_deadline: null,
  removed_at: null,
  duplicate_of: null,
  source_url: `https://arbetsformedlingen.se/platsbanken/annonser/${id}`,
  application_url: null,
  expired: false,
  ...extra,
})
const match = (
  id: string,
  rank: number,
  cls: Match['class'],
  extra: Partial<Match> = {},
): Match => ({
  id,
  rank,
  class: cls,
  role: 'data_engineering',
  role_from_title: true,
  reasons: ['r'],
  similarity: null,
  sample: false,
  detailed: true,
  ...extra,
})
const delivered = (ads: Ad[], matches: Match[]) =>
  ({
    ads: { ads },
    matches: { profile: null, matches },
  }) as unknown as Delivered

test('the route has its own page and the withdrawn job addresses still redirect', () => {
  assert.equal(parseHash('#jobs').page, 'jobs')
  assert.equal(parseHash('#jobs?ad=1&list=saved').page, 'jobs')
  assert.notEqual(parseHash('#jobb-it').page, 'jobs')
})

const DAY = '2026-10-23'
const board = (mine = {}) => {
  const d = delivered(
    [
      ad('1', { application_deadline: '2026-11-30T23:59:59' }),
      ad('2', {
        application_deadline: '2026-10-30T23:59:59',
        municipality: 'Solna',
      }),
      ad('3'),
      ad('4'),
      ad('5', { removed_at: '2026-10-22T10:00:00' }),
      ad('6', { duplicate_of: '1' }),
      ad('7', { expired: true }),
    ],
    [
      match('2', 3, 'possible', {
        remote: 'Du kan jobba på distans',
        seniority: { title: null, years: null, junior: 'junior' },
        skills: [
          {
            skill: 'dbt',
            strength: 'required',
            cv_level: 'practical',
            ad_quotes: [],
            cv_quotes: [],
          },
        ],
      }),
      match('1', 2, 'strong', { role: 'bi' }),
      match('3', 1, 'stretch'),
    ],
  )
  return rows(d, mine)
}
const ids = (xs: { ad: Ad }[]) => xs.map((r) => r.ad.id)
const q = (extra: Partial<typeof DEFAULT_QUERY>) => ({
  ...DEFAULT_QUERY,
  ...extra,
})

test('the board lists open ads with their match, and any ad the reader marked', () => {
  assert.deepEqual(ids(board()).sort(), ['1', '2', '3', '4'])
  const marked = board({ '5': 'applied', '7': 'saved' })
  assert.deepEqual(ids(marked).sort(), ['1', '2', '3', '4', '5', '7'])
  assert.equal(marked.find((r) => r.ad.id === '4')?.match, undefined)
})

test('good fit is strong and possible, sorted by fit and then the nearest deadline', () => {
  const all = board()
  assert.deepEqual(ids(search(all, DEFAULT_QUERY)), ['1', '2'])
  // All: strong, possible, stretch, then the unmatched ad.
  assert.deepEqual(ids(search(all, q({ list: 'all' }))), ['1', '2', '3', '4'])
})

test('the saved, applied and closed tabs hold the marks, and the counts follow the search', () => {
  const all = board({ '1': 'saved', '3': 'applied', '4': 'closed' })
  assert.deepEqual(ids(search(all, q({ list: 'saved' }))), ['1'])
  assert.deepEqual(ids(search(all, q({ list: 'applied' }))), ['3'])
  assert.deepEqual(listCounts(all, DEFAULT_QUERY), {
    good: 2,
    saved: 1,
    applied: 1,
    closed: 1,
    all: 4,
  })
  assert.equal(listCounts(all, q({ q: 'dbt' })).all, 1)
})

test('free text searches the title, the employer and the named skills', () => {
  const all = board()
  assert.deepEqual(ids(search(all, q({ q: 'DBT', list: 'all' }))), ['2'])
  assert.deepEqual(
    ids(search(all, q({ q: 'exempel engineer 3', list: 'all' }))),
    ['3'],
  )
})

test('place, role and seniority narrow the list and count their options', () => {
  const all = board()
  const inAll = (extra: Partial<typeof DEFAULT_QUERY>) =>
    ids(search(all, q({ list: 'all', ...extra })))
  assert.deepEqual(inAll({ place: 'Solna' }), ['2'])
  assert.deepEqual(inAll({ place: 'remote' }), ['2'])
  assert.deepEqual(inAll({ role: 'bi' }), ['1'])
  assert.deepEqual(inAll({ level: 'junior' }), ['2'])
  assert.deepEqual(inAll({ level: 'not_senior' }), [])
  const c = facetCounts(all, q({ list: 'all', place: 'Stockholm' }))
  assert.equal(c.place.get('Stockholm'), 3)
  assert.equal(c.place.get('Solna'), 1)
  assert.equal(c.role.get('bi'), 1, 'the place filter is kept')
})

test('the query round-trips through the address and drops defaults and junk', () => {
  const base = new URLSearchParams('ad=7&lang=sv')
  const query = q({ q: 'dbt', place: 'Solna', list: 'saved' })
  const params = queryParams(base, query)
  assert.equal(params.toString(), 'ad=7&lang=sv&q=dbt&list=saved&place=Solna')
  assert.deepEqual(parseQuery(params), query)
  assert.deepEqual(
    parseQuery(new URLSearchParams('list=everything&level=2&sort=x')),
    DEFAULT_QUERY,
  )
  assert.deepEqual(
    parseQuery(new URLSearchParams('place=Atlantis&role=bi'), board()),
    q({ role: 'bi' }),
    'a place or role no loaded ad has falls back to the default',
  )
  // Without a profile the default tab is all, and the address leaves it out.
  assert.equal(parseQuery(new URLSearchParams(), [], 'all').list, 'all')
  assert.equal(
    queryParams(new URLSearchParams(), q({ list: 'all' }), 'all').toString(),
    '',
  )
  assert.equal(queryParams(new URLSearchParams(), DEFAULT_QUERY).toString(), '')
  assert.equal(isFiltered(q({ list: 'saved' })), false)
  assert.equal(isFiltered(q({ level: 'junior' })), true)
})

test('the owner store wins over the device, and older statuses read as a mark', () => {
  const merged = merge(
    { a: 'saved', b: 'applied', c: 'closed' },
    {
      a: { status: 'interview', note: '' },
      b: { status: 'new', note: '' },
      d: { status: 'interesting', note: '' },
      e: { status: 'rejected', note: '' },
    },
  )
  assert.deepEqual(merged, {
    a: 'applied',
    c: 'closed',
    d: 'saved',
    e: 'closed',
  })
})

test('the lead is the first lines, never past a blank line', () => {
  assert.deepEqual(splitLead('Kort intro.\n\nResten av annonsen.'), [
    'Kort intro.',
    'Resten av annonsen.',
  ])
  const long = Array.from({ length: 10 }, (_, i) => `Rad ${i} `.repeat(10))
  const [lead, rest] = splitLead(long.join('\n'))
  assert.ok(lead.length >= 250 && lead.length < 400, String(lead.length))
  assert.ok(rest.startsWith('Rad 5'))
  assert.deepEqual(splitLead('Bara en rad.'), ['Bara en rad.', ''])
})

test('days are whole calendar days and the sync age is in hours', () => {
  assert.equal(daysBetween('2026-10-21T23:59:00', DAY), 2)
  assert.equal(daysBetween(DAY, '2026-10-23T23:59:59'), 0)
  assert.equal(daysBetween(null, DAY), null)
  const now = new Date('2026-10-23T12:00:00Z')
  assert.equal(syncAge('2026-10-23T08:30:00+00:00', now), 3.5)
  assert.equal(syncAge(undefined, now), null)
})

test('the unmatched note says approval only when the Worker answered without a profile, and a calm pause otherwise', () => {
  const at = '2026-10-25T11:13:24+00:00'
  const [none] = unmatchedNote({
    reason: 'no approved profile',
    status: 200,
    at,
  })
  assert.match(none, /starts when the CV profile is approved/)
  for (const status of [403, 500, null, 503]) {
    const [en, sv] = unmatchedNote({ reason: 'x', status, at })
    assert.doesNotMatch(en, /starts when/, `status ${status}`)
    assert.ok(sv.length > 0)
  }
  // Public copy reads as a pause: no HTTP status, no time, no "could not".
  for (const status of [403, 500, null, 503]) {
    const [en] = unmatchedNote({ reason: 'x', status, at })
    assert.match(en, /paused/)
    assert.doesNotMatch(en, /\d{3}|UTC|could not/)
  }
  assert.doesNotMatch(unmatchedNote()[0], /starts when/)
  assert.match(
    keptNote({ reason: 'x', status: 500, at })[0],
    /answered 500 at 2026-10-25 11:13 UTC/,
  )
})

test('the owner note tells a refused token, missing storage and an unreachable Worker apart', () => {
  assert.match(recordsNote('token')[0], /token was not accepted/)
  assert.match(recordsNote('storage')[0], /store is not set up/)
  assert.match(recordsNote('offline')[0], /could not be reached/)
  for (const p of ['token', 'storage', 'offline'] as const) {
    const [en, sv] = recordsNote(p)
    // Calm copy: no HTTP codes, and both languages present.
    assert.doesNotMatch(en, /\d{3}/)
    assert.ok(sv.length > 0 && sv !== en)
  }
})

test('only absolute https links from the source data are linked', () => {
  const ok = 'https://arbetsformedlingen.se/platsbanken/annonser/1'
  assert.equal(https(ok), ok)
  for (const bad of [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,x',
    'http://example.se/ad',
    '//example.se/ad',
    '/platsbanken/1',
    'not a url',
    '',
    null,
    undefined,
  ])
    assert.equal(https(bad), undefined, String(bad))
})
