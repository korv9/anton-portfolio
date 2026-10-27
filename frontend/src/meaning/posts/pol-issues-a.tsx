/** Fifteen policy issues: decisions, speeches and budget outturn. */
import { l } from '../../i18n'
import { useState } from 'react'
import { focal, Frame, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain } from '../axes'
import { Bars, int, line, pc, Sub, sum, uniq } from './pol-kit'

type Issue = {
  issue_key: string
  issue_name_en: string
  issue_name_sv?: string
  per_session: { session: string; decisions: number }[]
  speeches: { session: string; party: string; speeches: number }[]
  budget_outturn_msek: { year: number; outturn_msek: number }[]
}
type Issues = { issues: Issue[] }

const useIssues = () => useData<Issues>('parliament/issues.json')
const keys = (d: Issues) => d.issues.map((i) => i.issue_key)
/** An issue's name in the reader's language. */
const nameOf = (i: Issue) =>
  l(i.issue_name_en, i.issue_name_sv ?? i.issue_name_en)
/** An issue's name, for its key. */
const issueName = (d: Issues) => (k: string) => {
  const i = d.issues.find((i) => i.issue_key === k)
  return i ? nameOf(i) : k
}
/** "Social insurance and migration" → "Social insurance", to fit a small panel. */
const shortName = (i: Issue) => nameOf(i).split(l(' and ', ' och '))[0]
const decisions = (i: Issue) => sum(i.per_session.map((s) => s.decisions))
/** Every session any issue has, in order, so all panels share one time axis. */
const sessions = (d: Issues) =>
  uniq(d.issues.flatMap((i) => i.per_session.map((s) => s.session))).sort()
const sessionSpan = (d: Issues) => {
  const s = sessions(d)
  return s.length ? `${s[0]}–${s.at(-1)}` : ''
}

/** One panel per issue, most decisions first, all on one scale. */
function Multiples() {
  return (
    <Frame data={useIssues()}>
      {(d) => {
        const ss = sessions(d)
        if (ss.length < 2) return null
        const [, max] = niceDomain(
          0,
          Math.max(
            1,
            ...d.issues.flatMap((i) => i.per_session.map((s) => s.decisions)),
          ),
        )
        const ordered = [...d.issues].sort(
          (a, b) => decisions(b) - decisions(a),
        )
        const x = linearScale([0, ss.length - 1], [4, 92])
        const y = linearScale([0, max], [56, 20])
        return (
          <svg
            viewBox="0 0 300 310"
            role="img"
            aria-label={l(
              'Decisions per session for each issue, one panel per issue',
              'Beslut per riksmöte för varje sakområde, en panel per område',
            )}
          >
            {ordered.map((iss, k) => (
              <g
                key={iss.issue_key}
                transform={`translate(${(k % 3) * 100},${Math.floor(k / 3) * 62})`}
              >
                <g className="mean-axis">
                  <line x1={4} x2={92} y1={y(0)} y2={y(0)} />
                  <line x1={4} x2={92} y1={y(max)} y2={y(max)} />
                  {k === 2 && (
                    <text x={92} y={11} textAnchor="end">
                      {l('top', 'max')} {max}
                    </text>
                  )}
                </g>
                <path
                  d={line(
                    iss.per_session.map((s) => [
                      x(ss.indexOf(s.session)),
                      y(s.decisions),
                    ]),
                  )}
                  fill="none"
                  stroke={focal(true)}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
                <g className="mean-end">
                  <text x={4} y={12}>
                    {shortName(iss)}
                  </text>
                </g>
              </g>
            ))}
          </svg>
        )
      }}
    </Frame>
  )
}

const latestYear = (d: Issues) => {
  const ys = d.issues.flatMap((i) => i.budget_outturn_msek.map((b) => b.year))
  return ys.length ? Math.max(...ys) : null
}
/** Issues with an outturn in the latest year, largest first. An issue with no figure for that
 * year is left out. */
const outturn = (d: Issues) => {
  const yr = latestYear(d)
  return d.issues
    .map((i) => {
      const v = i.budget_outturn_msek.find((b) => b.year === yr)?.outturn_msek
      return v == null ? null : { i, bn: v / 1000 }
    })
    .filter((r) => r !== null)
    .sort((a, b) => b.bn - a.bn)
}

function Outturn() {
  return (
    <Frame data={useIssues()}>
      {(d) => (
        <Bars
          label={l(
            `Budget outturn per issue in ${latestYear(d)}, billion kronor`,
            `Budgetutfall per sakområde ${latestYear(d)}, miljarder kronor`,
          )}
          format={(v) => `${int(v)} ${l('bn', 'mdkr')}`}
          rows={outturn(d)
            .slice(0, 10)
            .map(({ i, bn }, k) => ({
              key: i.issue_key,
              label: <span title={nameOf(i)}>{nameOf(i)}</span>,
              value: bn,
              color: focal(k === 0),
            }))}
        />
      )}
    </Frame>
  )
}

function Speeches() {
  const data = useIssues()
  const [picked, setKey] = useState<string | null>(null)
  return (
    <Frame data={data}>
      {(d) => {
        const key = picked ?? keys(d)[0]
        const iss = d.issues.find((i) => i.issue_key === key)
        if (!iss) return null
        const by = new Map<string, number>()
        for (const s of iss.speeches)
          by.set(s.party, (by.get(s.party) ?? 0) + s.speeches)
        return (
          <>
            <Slicer
              label={l('Issue', 'Sakområde')}
              options={keys(d)}
              format={issueName(d)}
              value={key}
              onChange={setKey}
            />
            <Sub>{nameOf(iss)}</Sub>
            <Bars
              label={l(
                `Speeches per party in debates on ${nameOf(iss)}`,
                `Anföranden per parti i debatter om ${nameOf(iss)}`,
              )}
              format={int}
              rows={[...by]
                .sort((a, b) => b[1] - a[1])
                .map(([p, n]) => ({
                  key: p,
                  label: p,
                  value: n,
                  color: pc(p),
                }))}
            />
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-issue-multiples',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    title: (d: Issues) =>
      l(
        `Riksdag decisions per session in ${d.issues.length} policy areas, ${sessionSpan(d)}`,
        `Riksdagens beslut per riksmöte inom ${d.issues.length} sakområden, ${sessionSpan(d)}`,
      ),
    note: [
      'Decisions per session; every panel uses the same scale. Source: Riksdagen.',
      'Beslut per riksmöte; alla paneler har samma skala. Källa: Riksdagen.',
    ],
    render: () => <Multiples />,
  },
  {
    id: 'pol-issue-outturn',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    title: (d: Issues) => {
      const [top] = outturn(d)
      return top
        ? l(
            `${nameOf(top.i)} had the largest budget outturn in ${latestYear(d)}: ${int(top.bn)} billion kronor`,
            `${nameOf(top.i)} hade störst budgetutfall ${latestYear(d)}: ${int(top.bn)} miljarder kronor`,
          )
        : l('Budget outturn per policy area', 'Budgetutfall per sakområde')
    },
    note: [
      'Outturn of the expenditure areas behind each issue, SEK billion, ten largest. Source: Statskontoret.',
      'Utfall för utgiftsområdena bakom varje sakområde, miljarder kronor, de tio största. Källa: Statskontoret.',
    ],
    render: () => <Outturn />,
  },
  {
    id: 'pol-issue-speeches',
    domain: 'politics',
    sources: ['parliament/issues.json'],
    title: (d: Issues) =>
      l(
        `Speeches per party in issue debates, ${sessionSpan(d)}`,
        `Anföranden per parti i debatter per sakområde, ${sessionSpan(d)}`,
      ),
    note: [
      "Counts only debate speeches linked to the issue's committee reports by title. Source: Riksdagen.",
      'Räknar bara debattanföranden som genom titeln kopplats till sakområdets betänkanden. Källa: Riksdagen.',
    ],
    render: () => <Speeches />,
  },
]
