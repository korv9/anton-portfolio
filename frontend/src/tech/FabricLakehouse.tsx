/**
 * The same pattern on Microsoft Fabric: the DiVA lakehouse (github.com/korv9/diva-fabric-lakehouse),
 * once its own page at #diva-lakehouse. The MERGE counts per step are read from that
 * repository's docs/demo.md, the table its local Spark and Delta run wrote, so they follow the
 * document. They are synthetic demo batches, and the page says so.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { githubText } from './github'
import { num, reading } from './techData'

const LAKEHOUSE = 'korv9/diva-fabric-lakehouse'
const DEMO = `https://github.com/${LAKEHOUSE}/blob/main/docs/demo.md`

type Step = { label: string; counts: number[] }

/** The rows of the results table: a label, then new, changed, unchanged, deleted, Bronze rows. */
export function demoSteps(markdown: string): Step[] {
  const section = markdown.split(/^## Resultat från lokal körning.*$/m)[1] ?? ''
  return section
    .split('\n')
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    )
    .filter(
      (cells) =>
        cells.length === 6 && cells.slice(1).every((c) => /^\d+$/.test(c)),
    )
    .map(([label, ...counts]) => ({ label, counts: counts.map(Number) }))
}

export function FabricLakehouse() {
  const [steps, setSteps] = useState<Step[] | 'error' | null>(null)
  useEffect(() => {
    githubText(LAKEHOUSE, 'docs/demo.md').then(
      (text) => setSteps(demoSteps(text)),
      () => setSteps('error'),
    )
  }, [])
  // The doc labels its reruns "... igen" (again): batch B again, the same run_id again.
  const rerun = Array.isArray(steps)
    ? steps.filter((s) => /\bigen\b/.test(s.label))
    : []
  const COLUMNS = [
    l('New', 'Nya'),
    l('Changed', 'Ändrade'),
    l('Unchanged', 'Oförändrade'),
    l('Deleted', 'Raderade'),
    l('Bronze rows in total', 'Bronze-rader totalt'),
  ]
  return (
    <>
      <p className="tech-note">
        {l(
          'A second, smaller lakehouse in Microsoft Fabric harvests thesis metadata from DiVA over OAI-PMH and runs it through Bronze, Silver and Gold Delta tables in PySpark. Silver applies an explicit Delta MERGE with new, changed, unchanged and deleted records, and an older observation can never overwrite a newer one. Quality gates run before Gold is replaced.',
          'Ett andra, mindre lakehouse i Microsoft Fabric hämtar uppsatsmetadata från DiVA över OAI-PMH och kör den genom Delta-tabeller i Bronze, Silver och Gold med PySpark. Silver gör en uttrycklig Delta MERGE med nya, ändrade, oförändrade och raderade poster, och en äldre observation kan aldrig skriva över en nyare. Kvalitetsgrindar körs innan Gold ersätts.',
        )}
      </p>
      <ol className="engineering-flow">
        <li>OAI-PMH → XML</li>
        <li>Bronze → Silver</li>
        <li>Delta MERGE → Gold</li>
        <li>Fabric notebooks</li>
      </ol>
      {steps === null ? (
        reading
      ) : steps === 'error' || steps.length === 0 ? (
        <p className="tech-note">
          {l(
            'The replay results could not be read.',
            'Resultaten från omkörningen kunde inte läsas.',
          )}{' '}
          <a href={DEMO}>docs/demo.md</a>
        </p>
      ) : (
        <>
          <div className="tech-scroll" tabIndex={0}>
            <table className="tech-table">
              <caption className="tech-meta">
                {l(
                  'MERGE outcome per step of the replay demo, from a local Spark and Delta run on synthetic batches, not DiVA data.',
                  'MERGE-utfall per steg i omkörningsdemon, från en lokal körning med Spark och Delta på syntetiska batcher, inte DiVA-data.',
                )}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{l('Step', 'Steg')}</th>
                  {COLUMNS.map((c) => (
                    <th scope="col" className="num" key={c}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.label}>
                    <th scope="row" lang="sv">
                      {s.label}
                    </th>
                    {s.counts.map((n, i) => (
                      <td className="num" key={i}>
                        {num(n)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rerun.length > 0 && (
            <p className="tech-note">
              {l(
                `Idempotency: the ${rerun.length} reruns of batch B report ${num(rerun.reduce((n, s) => n + s.counts[0] + s.counts[1] + s.counts[3], 0))} new, changed or deleted records, and rerunning the same run_id leaves Bronze at ${num(rerun[rerun.length - 1].counts[4])} rows.`,
                `Idempotens: de ${rerun.length} omkörningarna av batch B ger ${num(rerun.reduce((n, s) => n + s.counts[0] + s.counts[1] + s.counts[3], 0))} nya, ändrade eller raderade poster, och samma run_id igen lämnar Bronze på ${num(rerun[rerun.length - 1].counts[4])} rader.`,
              )}
            </p>
          )}
        </>
      )}
      <p className="tech-meta">
        {l(
          'Verified locally with Spark and Delta; a run in Fabric and against the live DiVA endpoint is still to be confirmed.',
          'Verifierad lokalt med Spark och Delta; en körning i Fabric och mot DiVA:s levande endpoint återstår att bekräfta.',
        )}{' '}
        <a href={`https://github.com/${LAKEHOUSE}`}>{LAKEHOUSE}</a> ·{' '}
        <a href={DEMO}>docs/demo.md</a>
      </p>
    </>
  )
}
