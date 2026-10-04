import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { jsonData } from '../jobs/clusterData'
import { VisualizationFrame } from '../ui/Editorial'

/** A workflow illustration, not invented incident assignments or model scores. */
export function MethodPreview() {
  return (
    <VisualizationFrame
      caption={l(
        'Method overview · internal incident data',
        'Metodöversikt · intern incidentdata',
      )}
    >
      <div className="home-method-preview">
        <svg
          viewBox="0 0 420 125"
          role="img"
          aria-label={l(
            'Incident text to embeddings, UMAP and cluster review',
            'Incidenttext till inbäddningar, UMAP och klustergranskning',
          )}
        >
          <g fill="none" strokeWidth="5" opacity=".3">
            {[28, 51, 74, 97].map((y, i) => (
              <path
                key={y}
                d={`M 38 ${y} C 100 ${y}, 110 ${100 - y}, 165 ${100 - y} S 230 ${y}, 287 ${y}`}
                stroke={['#4E79A7', '#887EC8', '#59A14F', '#D4715A'][i]}
              />
            ))}
          </g>
          {[28, 51, 74, 97].map((y) => (
            <rect
              key={y}
              x="28"
              y={y - 5}
              width="10"
              height="10"
              fill="#6B6B6B"
            />
          ))}
          {[28, 51, 74, 97].map((y, i) => (
            <rect
              key={y}
              x="287"
              y={y - 6}
              width="12"
              height="12"
              fill={['#4E79A7', '#887EC8', '#59A14F', '#D4715A'][i]}
            />
          ))}
          <g fontSize="10" fill="currentColor">
            <text x="28" y="12">
              {l('Incident text', 'Incidenttext')}
            </text>
            <text x="110" y="118">
              EMBEDDINGS → UMAP
            </text>
            <text x="312" y="55">
              HDBSCAN
            </text>
            <text x="312" y="72">
              {l('Manual review', 'Manuell granskning')}
            </text>
          </g>
        </svg>
      </div>
    </VisualizationFrame>
  )
}

type Version = {
  rfc: number
  counts: { binding: number; weak: number; absent: number }
  requirements: number
}
export function RequirementPreview() {
  const [versions, setVersions] = useState<Version[]>([])
  useEffect(() => {
    let active = true
    jsonData<{ versions: Version[] }>('reports/rfc-drift.json')
      .then((data) => {
        if (active) setVersions(data.versions)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  if (!versions.length) return null
  return (
    <VisualizationFrame
      caption={l(
        'Observed requirement profiles · RFC text',
        'Observerade kravprofiler · RFC-text',
      )}
    >
      <div className="home-requirement-preview">
        {versions.slice(0, 2).map((version) => (
          <div className="home-requirement-profile" key={version.rfc}>
            <span>RFC {version.rfc}</span>
            {(['binding', 'weak', 'absent'] as const).map((kind, i) => (
              <div className="home-requirement-bar" key={kind}>
                <span>
                  {
                    [
                      l('Binding', 'Bindande'),
                      l('Weak', 'Svaga'),
                      l('No modal', 'Utan modal'),
                    ][i]
                  }
                </span>
                <span className="home-requirement-track">
                  <i
                    style={{
                      width: `${(version.counts[kind] / version.requirements) * 100}%`,
                      background: ['#4E79A7', '#D4715A', '#94948E'][i],
                    }}
                  />
                </span>
                <b>{version.counts[kind]}</b>
              </div>
            ))}
          </div>
        ))}
        <div className="home-requirement-word" aria-hidden="true">
          MUST
          <br />
          <span>SHOULD?</span>
        </div>
      </div>
    </VisualizationFrame>
  )
}

type SwedenHeadline = {
  indicator_key: string
  value: number
  period_label: string
}

/** Published SCB percentages on a common 0–100 scale. */
export function SwedenPreview() {
  const [rows, setRows] = useState<SwedenHeadline[]>([])
  useEffect(() => {
    let active = true
    jsonData<SwedenHeadline[]>('welfare/headlines.json')
      .then((data) => {
        if (active)
          setRows(
            data.filter((row) =>
              [
                'aku_employment_rate',
                'aku_labour_force_participation',
              ].includes(row.indicator_key),
            ),
          )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return (
    <VisualizationFrame
      caption={l(
        'SCB · Sweden · ages 15–74 · %',
        'SCB · Sverige · 15–74 år · %',
      )}
    >
      <div className="home-sweden-preview">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.indicator_key}>
              <span>
                {row.indicator_key === 'aku_employment_rate'
                  ? l('Employment', 'Sysselsättning')
                  : l('Labour force', 'Arbetskraft')}{' '}
                · {row.period_label}
              </span>
              <div className="sweden-preview-track">
                <i style={{ width: `${row.value}%` }} />
                <strong>
                  {row.value.toLocaleString(l('en-GB', 'sv-SE'))}%
                </strong>
              </div>
            </div>
          ))
        ) : (
          <span>{l('Jobs · health · trust', 'Jobb · hälsa · förtroende')}</span>
        )}
      </div>
    </VisualizationFrame>
  )
}
