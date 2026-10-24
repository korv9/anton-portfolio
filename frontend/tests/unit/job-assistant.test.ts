/** The job assistant's review list: derived status, filters and sorting, and the label metric. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluation,
  rows,
  statusOf,
  type Ad,
  type Delivered,
  type Match,
} from '../../src/job-assistant/model.ts'
import {
  DEFAULT_QUERY,
  daysBetween,
  facetCounts,
  isFiltered,
  parseQuery,
  queryParams,
  pipelineColumns,
  search,
  syncAge,
} from '../../src/job-assistant/query.ts'
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
  assert.equal(parseHash('#jobs?ad=1&view=sample').page, 'jobs')
  assert.notEqual(parseHash('#jobb-it').page, 'jobs')
})

test('a removed or expired ad is closed unless the owner set something else', () => {
  assert.equal(statusOf(ad('1')), 'new')
  assert.equal(
    statusOf(ad('1', { removed_at: '2026-10-23T10:00:00' })),
    'closed',
  )
  assert.equal(statusOf(ad('1', { expired: true })), 'closed')
  assert.equal(
    statusOf(ad('1', { removed_at: '2026-10-23' }), {
      status: 'applied',
      note: '',
    }),
    'applied',
  )
})

const DAY = '2026-10-23'
const board = () => {
  const d = delivered(
    [
      ad('1', { employment_type: 'Vanlig anställning' }),
      ad('2', {
        application_deadline: '2026-10-30T23:59:59',
        municipality: 'Solna',
      }),
      ad('3', { published: '2026-09-01T08:00:00' }),
      ad('4'),
    ],
    [
      match('2', 1, 'strong', {
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
      match('1', 2, 'possible', {
        role: 'bi',
        seniority: { title: 'Senior', years: 5, junior: null },
      }),
      match('3', 3, 'strong'),
      match('4', 4, 'outside', { sample: true }),
    ],
  )
  return rows(d, {
    reviews: { '1': { status: 'interesting', note: '' } },
    labels: {},
    available: true,
  })
}
const ids = (xs: { ad: Ad }[]) => xs.map((r) => r.ad.id)

test('the default query lists strong and possible ads in rank order', () => {
  const all = board()
  assert.deepEqual(ids(search(all, DEFAULT_QUERY, DAY)), ['2', '1', '3'])
  assert.deepEqual(
    ids(search(all, { ...DEFAULT_QUERY, match: 'sample' }, DAY)),
    ['4'],
  )
  assert.deepEqual(
    ids(search(all, { ...DEFAULT_QUERY, match: 'possible' }, DAY)),
    ['1'],
  )
})

test('free text searches the title, the employer and the named skills', () => {
  const all = board()
  assert.deepEqual(ids(search(all, { ...DEFAULT_QUERY, q: 'DBT' }, DAY)), ['2'])
  assert.deepEqual(
    ids(search(all, { ...DEFAULT_QUERY, q: 'exempel engineer 3' }, DAY)),
    ['3'],
  )
})

test('each filter narrows on the exported field and sorts keep the match order on ties', () => {
  const all = board()
  const q = (extra: Partial<typeof DEFAULT_QUERY>) =>
    ids(search(all, { ...DEFAULT_QUERY, ...extra }, DAY))
  assert.deepEqual(q({ place: 'Solna' }), ['2'])
  assert.deepEqual(q({ place: 'remote' }), ['2'])
  assert.deepEqual(q({ type: 'Vanlig anställning' }), ['1'])
  assert.deepEqual(q({ role: 'bi' }), ['1'])
  assert.deepEqual(q({ published: '30' }), ['2', '1'])
  assert.deepEqual(q({ deadline: '7' }), ['2'])
  assert.deepEqual(q({ level: 'junior' }), ['2'])
  assert.deepEqual(q({ level: 'not_senior' }), [])
  assert.deepEqual(q({ sort: 'newest' }), ['2', '1', '3'])
  assert.deepEqual(q({ sort: 'deadline' }), ['2', '1', '3'])
})

test('an option counts the ads it would leave with the other filters kept', () => {
  const all = board()
  const c = facetCounts(all, { ...DEFAULT_QUERY, place: 'Stockholm' }, DAY)
  assert.equal(c.place.get('Stockholm'), 2)
  assert.equal(c.place.get('Solna'), 1)
  assert.equal(c.place.get('remote'), 1)
  assert.equal(c.match.get('listed'), 2, 'the place filter is kept')
  assert.equal(c.match.get('sample'), 1)
  assert.equal(c.role.get('bi'), 1)
})

test('the query round-trips through the address and drops defaults and junk', () => {
  const base = new URLSearchParams('ad=7&lang=sv')
  const q = {
    ...DEFAULT_QUERY,
    q: 'dbt',
    place: 'Solna',
    sort: 'newest' as const,
  }
  const params = queryParams(base, q)
  assert.equal(params.toString(), 'ad=7&lang=sv&q=dbt&place=Solna&sort=newest')
  assert.deepEqual(parseQuery(params), q)
  assert.deepEqual(
    parseQuery(new URLSearchParams('match=everything&sort=random&published=2')),
    DEFAULT_QUERY,
  )
  assert.deepEqual(
    parseQuery(new URLSearchParams('place=Atlantis&type=x&role=bi'), board()),
    { ...DEFAULT_QUERY, role: 'bi' },
    'a place, type or role no loaded ad has falls back to the default',
  )
  assert.equal(queryParams(new URLSearchParams(), DEFAULT_QUERY).toString(), '')
  assert.equal(isFiltered(DEFAULT_QUERY), false)
  assert.equal(isFiltered({ ...DEFAULT_QUERY, sort: 'deadline' }), false)
  assert.equal(isFiltered({ ...DEFAULT_QUERY, level: 'junior' }), true)
})

test('days are whole calendar days and the sync age is in hours', () => {
  assert.equal(daysBetween('2026-10-21T23:59:00', DAY), 2)
  assert.equal(daysBetween(DAY, '2026-10-23T23:59:59'), 0)
  assert.equal(daysBetween(null, DAY), null)
  const now = new Date('2026-10-23T12:00:00Z')
  assert.equal(syncAge('2026-10-23T08:30:00+00:00', now), 3.5)
  assert.equal(syncAge(undefined, now), null)
})

test('the pipeline board groups the owner reviews from saved to the answer', () => {
  const cols = pipelineColumns([ad('1'), ad('2')], {
    reviews: {
      '1': { status: 'interesting', note: '' },
      '2': { status: 'interview', note: '' },
      '9': { status: 'applied', note: '' },
      '3': { status: 'pass', note: '' },
    },
    labels: {},
    available: true,
  })
  assert.deepEqual(
    cols.map((c) => [c.status, c.items.map((i) => i.id)]),
    [
      ['interesting', ['1']],
      ['applied', ['9']],
      ['interview', ['2']],
      ['offer', []],
      ['rejected', []],
    ],
  )
  assert.equal(cols[1].items[0].ad, undefined, 'an ad gone from the file')
})

test('labels give precision of the list, misses outside it and every disagreement', () => {
  const ev = evaluation({
    a: { label: 'relevant', note: '', shown_class: 'strong' },
    b: { label: 'not_relevant', note: '', shown_class: 'possible' },
    c: { label: 'relevant', note: '', shown_class: 'outside' },
    d: { label: 'maybe', note: '', shown_class: 'outside' },
  })
  assert.deepEqual(
    [ev.labelled, ev.listedRelevant, ev.listed, ev.outsideRelevant, ev.outside],
    [4, 1, 2, 1, 2],
  )
  assert.deepEqual(ev.disagreements.map((x) => x.id).sort(), ['b', 'c'])
})
