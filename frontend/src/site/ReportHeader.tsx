import { t } from '../i18n'

/** A report's heading with its source, period and unit, shared by the project reports. */
export default function ReportHeader({
  number,
  eyebrow,
  title,
  intro,
  source,
  period,
  unit,
}: {
  number: string
  eyebrow: string
  title: string
  intro: string
  source: string
  period: string
  unit: string
}) {
  return (
    <header className="report-header">
      <div className="report-number">R{number}</div>
      <div>
        <p className="eyebrow">{t(eyebrow)}</p>
        <h2>{t(title)}</h2>
        <p className="report-intro">{t(intro)}</p>
        <dl className="source-strip">
          <div>
            <dt>{t('Source')}</dt>
            <dd>{t(source)}</dd>
          </div>
          <div>
            <dt>{t('Period')}</dt>
            <dd>{period}</dd>
          </div>
          <div>
            <dt>{t('Unit')}</dt>
            <dd>{t(unit)}</dd>
          </div>
        </dl>
      </div>
    </header>
  )
}
