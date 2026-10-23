/** The job assistant's review list: derived status, filters and sorting, and the label metric. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_VIEW,
  evaluation,
  filter,
  rows,
  statusOf,
  type Ad,
  type Delivered,
  type Match,
} from '../../src/job-assistant/model.ts'
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

test('the default view is the review list in rank order; filters and sorts work together', () => {
  const d = delivered(
    [
      ad('1'),
      ad('2', { application_deadline: '2026-11-01' }),
      ad('3'),
      ad('4'),
    ],
    [
      match('2', 1, 'strong'),
      match('1', 2, 'possible', { role: 'bi' }),
      match('3', 3, 'stretch'),
      match('4', 4, 'outside', { sample: true }),
    ],
  )
  const all = rows(d, {
    reviews: { '1': { status: 'interesting', note: '' } },
    labels: {},
    available: true,
  })
  assert.deepEqual(
    filter(all, DEFAULT_VIEW).map((r) => r.ad.id),
    ['2', '1'],
  )
  assert.deepEqual(
    filter(all, { ...DEFAULT_VIEW, sort: 'newest' }).map((r) => r.ad.id),
    ['2', '1'],
  )
  assert.deepEqual(
    filter(all, { ...DEFAULT_VIEW, status: 'interesting' }).map((r) => r.ad.id),
    ['1'],
  )
  assert.deepEqual(
    filter(all, { ...DEFAULT_VIEW, role: 'bi' }).map((r) => r.ad.id),
    ['1'],
  )
  assert.deepEqual(
    filter(all, { ...DEFAULT_VIEW, classes: 'sample' }).map((r) => r.ad.id),
    ['4'],
  )
  assert.deepEqual(
    filter(all, { ...DEFAULT_VIEW, q: 'engineer 1' }).map((r) => r.ad.id),
    ['1'],
  )
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
