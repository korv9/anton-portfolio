/** Below the review list: how the search works, the profile against demand, evaluation, operation and the owner's tools. */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import Owner from './Owner'
import { ROLE_NAMES, evaluation, type Delivered, type Records } from './data'
import { cvLevelLabel } from './labels'

type ApprovedProfile = {
  version: number
  wishes: { locations: string[]; remote: string | null; roles: string[] }
  skills: { skill: string; level: string }[]
}
type Props = {
  data: Delivered
  records: Records
  owner: boolean
  onOwner: (owner: boolean) => void
  onRecords: (r: Records) => void
}
const LEVELS = ['practical', 'education_or_project', 'listed']

export default function Sections({
  data,
  records,
  owner,
  onOwner,
  onRecords,
}: Props) {
  const [profile, setProfile] = useState<ApprovedProfile | null>(null)
  useEffect(() => {
    fetch('/api/jobs/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setProfile(p?.approved ?? null))
      .catch(() => setProfile(null))
  }, [])
  const ev = evaluation(records.labels)
  const top = data.demand.skills.slice(0, 15)

  return (
    <div className="ja-sections">
      <section aria-labelledby="ja-method">
        <h2 id="ja-method">
          {l('How the search works', 'Så fungerar sökningen')}
        </h2>
        <ol className="ja-steps">
          <li>
            {l(
              'The CV is read into a profile. Every skill keeps the CV line it comes from and one of three levels: used in work (LIA or employment), used in education or a project, or only listed. Wishes and interests are added by hand and never count as experience.',
              'Cv:t läses in till en profil. Varje kompetens behåller cv-raden den kommer från och en av tre nivåer: använd i arbete (LIA eller anställning), i utbildning eller projekt, eller bara listad. Önskemål och intressen läggs till för hand och räknas aldrig som erfarenhet.',
            )}
          </li>
          <li>
            {l(
              'Every hour the Data/IT ads that JobTech added, changed or removed are read. A removed ad stays, marked closed.',
              'Varje timme läses de Data/IT-annonser som JobTech lagt till, ändrat eller tagit bort. En borttagen annons finns kvar, markerad som stängd.',
            )}
          </li>
          <li>
            {l(
              'Rules compare each ad with the approved profile on role, skills, seniority and place. Strong means a wished role in the title, a wished place, not senior, and at least 60 % of three or more named skills shown in employment or internships. Skills shown only in projects or education are counted apart and never make an ad strong or possible. Education and conditions such as citizenship are listed apart and never change the class.',
              'Regler jämför varje annons med den godkända profilen på roll, kompetenser, senioritet och ort. Stark betyder en önskad roll i titeln, en önskad ort, inte senior, och minst 60 % av tre eller fler nämnda kompetenser visade i anställning eller praktik. Kompetenser som bara finns i projekt eller utbildning räknas för sig och gör aldrig en annons stark eller möjlig. Utbildning och villkor som medborgarskap listas för sig och ändrar aldrig klassen.',
            )}
          </li>
          <li>
            {l(
              'A language model may add a short explanation within a small daily budget. It is shown only if every sentence quotes the ad or the CV and every quote is found there.',
              'En språkmodell kan lägga till en kort förklaring inom en liten daglig budget. Den visas bara om varje mening citerar annonsen eller cv:t och varje citat finns där.',
            )}
          </li>
        </ol>
        <p className="ja-muted">
          {l(
            'Data: Arbetsförmedlingen JobTech (CC0). Built on the data platform behind this site: raw files with provenance, dbt models with contracts, versioned releases. Method and code: ',
            'Data: Arbetsförmedlingen JobTech (CC0). Byggt på sajtens dataplattform: råfiler med proveniens, dbt-modeller med kontrakt, versionerade releaser. Metod och kod: ',
          )}
          <a href="https://github.com/korv9/anton-portfolio/blob/main/docs/job-assistant.md">
            docs/job-assistant.md
          </a>
        </p>
      </section>

      <section aria-labelledby="ja-profile">
        <h2 id="ja-profile">
          {l(
            'What the ads ask for, against the CV',
            'Vad annonserna frågar efter, mot cv:t',
          )}
        </h2>
        {profile && (
          <p>
            {l('Looking for', 'Söker')}:{' '}
            {profile.wishes.roles
              .map((r) => l(...(ROLE_NAMES[r] ?? [r, r])))
              .join(', ')}
            . {profile.wishes.locations.join(', ')}
            {profile.wishes.remote &&
              profile.wishes.remote !== 'no' &&
              `, ${profile.wishes.remote}`}
            . {l('Profile version', 'Profilversion')} {profile.version}.
          </p>
        )}
        <div className="ja-table-wrap">
          <table className="ja-table ja-demand">
            <caption className="ja-muted">
              {l(
                'The skills named most often in the matched ads.',
                'De kompetenser som nämns oftast i de matchade annonserna.',
              )}
            </caption>
            <thead>
              <tr>
                <th scope="col">{l('Skill', 'Kompetens')}</th>
                <th scope="col" className="num">
                  {l('Ads naming it', 'Annonser')}
                </th>
                <th scope="col" className="num">
                  {l('As a requirement', 'Som krav')}
                </th>
                <th scope="col">{l('In the CV', 'I cv:t')}</th>
              </tr>
            </thead>
            <tbody>
              {top.map((s) => (
                <tr
                  key={s.skill}
                  data-gap={!LEVELS.slice(0, 2).includes(s.cv_level ?? '')}
                >
                  <th scope="row">{s.skill}</th>
                  <td className="num">{s.ads_naming}</td>
                  <td className="num">{s.ads_required}</td>
                  <td>{cvLevelLabel(s.cv_level)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ja-eval">
        <h2 id="ja-eval">{l('Is the list right?', 'Stämmer listan?')}</h2>
        <p>
          {l(
            `I label ads as relevant, maybe or not relevant, both from the list and from a fixed sample of 30 ads outside it, to find misranked and missed jobs. Labelled so far: ${ev.labelled} of the 50 planned.`,
            `Jag märker annonser som relevanta, kanske eller inte relevanta, både från listan och från ett fast urval på 30 annonser utanför den, för att hitta felrankade och missade jobb. Märkta hittills: ${ev.labelled} av 50 planerade.`,
          )}
        </p>
        {ev.labelled > 0 && (
          <dl className="ja-dates">
            <div>
              <dt>
                {l(
                  'Listed ads that were relevant',
                  'Listade annonser som var relevanta',
                )}
              </dt>
              <dd>
                {ev.listedRelevant} / {ev.listed}
              </dd>
            </div>
            <div>
              <dt>
                {l(
                  'Outside ads that were relevant (missed)',
                  'Annonser utanför som var relevanta (missade)',
                )}
              </dt>
              <dd>
                {ev.outsideRelevant} / {ev.outside}
              </dd>
            </div>
            <div>
              <dt>
                {l(
                  'Class and label disagree',
                  'Klass och märkning skiljer sig',
                )}
              </dt>
              <dd>{ev.disagreements.length}</dd>
            </div>
          </dl>
        )}
      </section>

      <section aria-labelledby="ja-ops">
        <h2 id="ja-ops">
          {l(
            'Scheduled runs, last seven days',
            'Schemalagda körningar, senaste sju dagarna',
          )}
        </h2>
        <div className="ja-table-wrap">
          <table className="ja-table">
            <thead>
              <tr>
                <th scope="col">{l('Day (UTC)', 'Dag (UTC)')}</th>
                <th scope="col" className="num">
                  {l('Runs', 'Körningar')}
                </th>
                <th scope="col" className="num">
                  {l('Failed', 'Misslyckade')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.ads.runs.map((r) => (
                <tr key={r.day}>
                  <th scope="row">{r.day}</th>
                  <td className="num">{r.runs}</td>
                  <td className="num">{r.runs_failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Owner
        owner={owner}
        available={records.available}
        onOwner={onOwner}
        onRecords={onRecords}
      />
    </div>
  )
}
