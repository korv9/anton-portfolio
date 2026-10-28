/**
 * The How it works tab: the method, the profile against demand (only when there is demand to
 * show), evaluation (owner only: labels are read with the token), operation and the owner's tools
 * (only with the token or ?owner).
 */
import { l } from '../i18n'
import CvProfile, { useApprovedProfile } from './CvProfile'
import Owner from './Owner'
import { ROLE_NAMES, evaluation, type Delivered, type Records } from './data'
import { cvLevelLabel } from './labels'

type Props = {
  data: Delivered
  records: Records
  owner: boolean
  ownerTools: boolean
  onOwner: (owner: boolean) => void
  onRecords: (r: Records) => void
}
const LEVELS = ['practical', 'education_or_project', 'listed']

export default function Sections({
  data,
  records,
  owner,
  ownerTools,
  onOwner,
  onRecords,
}: Props) {
  const read = useApprovedProfile()
  const profile = read && read !== 'failed' ? read : null
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
              'The CV becomes a profile. Each skill keeps its CV line and a level: used in work, in education or a project, or only listed.',
              'Cv:t blir en profil. Varje kompetens behåller sin cv-rad och en nivå: använd i arbete, i utbildning eller projekt, eller bara listad.',
            )}
          </li>
          <li>
            {l(
              'New, changed and removed Data/IT ads are read several times a day.',
              'Nya, ändrade och borttagna Data/IT-annonser läses flera gånger om dagen.',
            )}
          </li>
          <li>
            {l(
              'Rules compare each ad with the profile on role, skills, seniority and place. Strong: a wished role and place, not senior, and at least 60 % of the named skills shown in work.',
              'Regler jämför varje annons med profilen på roll, kompetenser, senioritet och ort. Stark: önskad roll och ort, inte senior, och minst 60 % av de nämnda kompetenserna visade i arbete.',
            )}
          </li>
          <li>
            {l(
              'A language model may add a short explanation. It is shown only if every quote is found in the ad or the CV.',
              'En språkmodell kan lägga till en kort förklaring. Den visas bara om varje citat finns i annonsen eller cv:t.',
            )}
          </li>
        </ol>
        <p className="ja-muted">
          {l(
            'Data: JobTech, Arbetsförmedlingen open data (CC0). Not affiliated with Arbetsförmedlingen. ',
            'Data: JobTech, Arbetsförmedlingens öppna data (CC0). Inte knuten till Arbetsförmedlingen. ',
          )}
          <a href="https://github.com/korv9/anton-portfolio/blob/main/docs/job-assistant.md">
            {l('Method and code on GitHub', 'Metod och kod på GitHub')}
          </a>
        </p>
      </section>

      {profile && <CvProfile profile={profile} />}
      {read === 'failed' && (
        <p className="ja-muted" role="status">
          {l(
            'The approved CV profile could not be read just now, so it is not shown here.',
            'Den godkända cv-profilen gick inte att läsa just nu, så den visas inte här.',
          )}
        </p>
      )}

      {(profile || top.length > 0) && (
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
          {top.length > 0 && (
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
          )}
        </section>
      )}

      {records.available && (
        <section aria-labelledby="ja-eval">
          <h2 id="ja-eval">{l('Is the list right?', 'Stämmer listan?')}</h2>
          <p>
            {l(
              `I label ads from the list and 30 outside it, to find misranked and missed jobs. Labelled: ${ev.labelled} of 50.`,
              `Jag märker annonser från listan och 30 utanför den, för att hitta felrankade och missade jobb. Märkta: ${ev.labelled} av 50.`,
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
      )}

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

      {ownerTools && (
        <Owner
          owner={owner}
          available={records.available}
          problem={records.problem}
          onOwner={onOwner}
          onRecords={onRecords}
        />
      )}
    </div>
  )
}
