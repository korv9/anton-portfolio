/**
 * The original IT job report: ad volume per role family, junior openings and the technologies
 * data ads mention. A deep dive of the job-market project.
 */
import { useEffect, useMemo, useState } from 'react'
import TopicNav from '../TopicNav'
import { currentLocale, t } from '../i18n'
import { fetchData } from '../dataSource'
import TimeSeriesChart from '../charts/TimeSeriesChart'
import { yearSpan } from '../charts/scales'
import ReportHeader from '../site/ReportHeader'
import ProjectDataDisclosure from '../products/ProjectDataDisclosure'

type MonthlyAd = {
  month: string
  role: string
  new_ads: number
  unique_employers: number
}
type Technology = {
  cohort: string
  technology: string
  ads_mentioning: number
  share_pct: number
}
type JobKpis = {
  baseline_year: number
  comparison_year: number
  ads_total: number
  employers_unique: number
  software_baseline: number
  software_comparison: number
  software_change_pct: number
  junior_share_pct: number
  junior_software_baseline: number
  junior_software_comparison: number
  junior_software_change_pct: number
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(
    currentLocale() === 'sv' ? 'sv-SE' : 'en-GB',
  ).format(value)
}
function formatSignedPercent(value: number) {
  return `${value < 0 ? '−' : '+'}${Math.abs(value).toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
async function fetchReport(url: string) {
  const response = await fetchData(url)
  if (!response.ok) throw new Error(`Report data unavailable: ${url}`)
  return response.json()
}

function JobsChart({ rows, role }: { rows: MonthlyAd[]; role: string }) {
  const points = rows
    .filter((row) => row.role === role)
    .map((row) => ({ date: row.month, value: row.new_ads }))
  const span = yearSpan(points.map((point) => point.date))
  const range = span ? `${span.first}–${span.last}` : ''
  return (
    <TimeSeriesChart
      points={points}
      label={
        currentLocale() === 'sv'
          ? `Nya annonser per månad för ${t(role)}, ${range}`
          : `New ads per month for ${role}, ${range}`
      }
      describe={(point) =>
        `${point.date.slice(0, 7)}: ${formatNumber(point.value)} ${t('ads')}`
      }
      formatTick={(value) => formatNumber(value)}
      scrollHint={t('Chart scrolls horizontally on small screens')}
    />
  )
}

export default function TechReport() {
  const [monthly, setMonthly] = useState<MonthlyAd[]>([])
  const [technologies, setTechnologies] = useState<Technology[]>([])
  const [jobKpis, setJobKpis] = useState<JobKpis | null>(null)
  const [jobYears, setJobYears] = useState<number[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [role, setRole] = useState('')
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setReportError(null)
    fetchReport('gold/marts/jobs.json')
      .then((jobsData) => {
        if (!active) return
        setMonthly(jobsData.monthly as MonthlyAd[])
        setTechnologies(jobsData.technologies as Technology[])
        setJobKpis(jobsData.kpis)
        setJobYears(jobsData.years as number[])
        setRoles(jobsData.roles as string[])
        setRole((current) => current || (jobsData.roles as string[])[0])
      })
      .catch((error: Error) => {
        if (active) setReportError(error.message)
      })
    return () => {
      active = false
    }
  }, [])
  const topTech = technologies
    .filter((tech) => tech.cohort === 'Data roles')
    .slice(0, 10)
  const annual = useMemo(
    () =>
      roles.map((item) => ({
        role: item,
        values: jobYears.map((year) =>
          monthly
            .filter(
              (row) => row.role === item && row.month.startsWith(String(year)),
            )
            .reduce((sum, row) => sum + row.new_ads, 0),
        ),
      })),
    [monthly, roles, jobYears],
  )
  const selectedAnnual = annual.find((item) => item.role === role)?.values ?? []

  return (
    <div className="project-page">
      <div className="page-lead">
        <p className="eyebrow">{t('Swedish Job Market Analytics')}</p>
        <h1>{t('Swedish job market.')}</h1>
        <p>
          {t(
            'Historical job-ad data, with clear definitions and a view of how software and data roles changed.',
          )}
        </p>
        <TopicNav
          active="#job-market-tech"
          items={[
            ['#job-market', 'Overview', 'Översikt'],
            ['#job-market-occupations', 'Occupations', 'Yrken'],
            ['#job-market-regions', 'Counties', 'Län'],
            ['#job-market-conditions', 'Conditions', 'Villkor'],
            ['#job-market-tech', 'IT report', 'IT-rapport'],
          ]}
        />
      </div>
      <div className="reports">
        <article className="report" id="job-market">
          <ReportHeader
            number="02"
            eyebrow="Labour market & technology"
            title={t('What is happening to tech jobs?')}
            intro="A compact view of ad volume, junior openings and technologies mentioned in Swedish job ads."
            source="JobTech Historical Ads"
            period={jobYears.length ? `${jobYears[0]}–${jobYears.at(-1)}` : '…'}
            unit="Unique ad IDs"
          />
          <div className="kpis jobs-kpis">
            <div>
              <strong>{jobKpis ? formatNumber(jobKpis.ads_total) : '—'}</strong>
              <span>{t('ads in the sample')}</span>
            </div>
            <div>
              <strong>
                {jobKpis ? formatNumber(jobKpis.employers_unique) : '—'}
              </strong>
              <span>{t('unique employers')}</span>
            </div>
            <div>
              <strong>
                {jobKpis
                  ? formatSignedPercent(jobKpis.software_change_pct)
                  : '—'}
              </strong>
              <span>
                {t('developer ads')}
                {jobKpis
                  ? `, ${jobKpis.baseline_year}–${String(jobKpis.comparison_year).slice(2)}`
                  : ''}
              </span>
            </div>
            <div>
              <strong>
                {jobKpis ? `${jobKpis.junior_share_pct.toFixed(1)}%` : '—'}
              </strong>
              <span>{t('junior share')}</span>
            </div>
          </div>
          <div className="viz-shell">
            <div className="viz-toolbar">
              <div>
                <span className="control-label">{t('Role family')}</span>
                <div className="role-tabs">
                  {roles.map((item) => (
                    <button
                      key={item}
                      className={role === item ? 'active' : ''}
                      onClick={() => setRole(item)}
                    >
                      {t(item)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="job-chart-head">
              <div>
                <p className="eyebrow">{t('New ads per month')}</p>
                <h3>{t(role)}</h3>
              </div>
              <div className="year-totals">
                {selectedAnnual.map((value, index) => (
                  <span key={jobYears[index]}>
                    <small>{jobYears[index]}</small>
                    <strong>{formatNumber(value)}</strong>
                  </span>
                ))}
              </div>
            </div>
            {monthly.length ? (
              <JobsChart rows={monthly} role={role} />
            ) : reportError ? (
              <p role="alert">{reportError}</p>
            ) : (
              <div className="loading">{t('Loading report data…')}</div>
            )}
          </div>
          <div className="reading-grid compact-reading">
            <div className="finding">
              <p className="eyebrow">{t('Main observation')}</p>
              <h3>
                {jobKpis &&
                jobKpis.junior_software_change_pct < jobKpis.software_change_pct
                  ? t('Junior openings fell faster than total volume.')
                  : t('Junior openings compared with total volume.')}
              </h3>
              <p>
                {jobKpis
                  ? currentLocale() === 'sv'
                    ? `Juniora mjukvaruannonser gick från ${formatNumber(jobKpis.junior_software_baseline)} år ${jobKpis.baseline_year} till ${formatNumber(jobKpis.junior_software_comparison)} år ${jobKpis.comparison_year}: ${formatSignedPercent(jobKpis.junior_software_change_pct)}, jämfört med ${formatSignedPercent(jobKpis.software_change_pct)} för alla mjukvaruannonser.`
                    : `Junior software ads went from ${formatNumber(jobKpis.junior_software_baseline)} in ${jobKpis.baseline_year} to ${formatNumber(jobKpis.junior_software_comparison)} in ${jobKpis.comparison_year}: ${formatSignedPercent(jobKpis.junior_software_change_pct)}, compared with ${formatSignedPercent(jobKpis.software_change_pct)} for all software ads.`
                  : t('Loading the job-market summary…')}
              </p>
            </div>
            <div className="tech-bars">
              <p className="eyebrow">{t('Most mentioned in data ads')}</p>
              {topTech.slice(0, 7).map((tech) => (
                <div key={tech.technology}>
                  <span>{tech.technology}</span>
                  <span className="bar">
                    <i
                      style={{
                        width: `${(tech.share_pct / topTech[0].share_pct) * 100}%`,
                      }}
                    />
                  </span>
                  <strong>
                    {tech.share_pct.toLocaleString(
                      currentLocale() === 'sv' ? 'sv-SE' : 'en-GB',
                      { maximumFractionDigits: 1 },
                    )}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <details className="method">
            <summary>{t('Definitions & limitations')}</summary>
            <div>
              <p>
                {t(
                  'Documented text rules define role families and detect technology mentions. A mention may be optional or negated.',
                )}
              </p>
              <p>
                {t(
                  'An ad is not a hire. The archive may not cover every Swedish vacancy, and title-based seniority is an approximation.',
                )}
              </p>
              <a
                href="https://github.com/korv9/swedish-job-market-analytics"
                target="_blank"
                rel="noreferrer"
              >
                {t('Code and methodology on GitHub ↗')}
              </a>
            </div>
          </details>
        </article>
      </div>
      <ProjectDataDisclosure
        title={t('Job ad tables and definitions')}
        initialDataset="fact_job_month_role"
        sectionId="job-data"
      />
    </div>
  )
}
