/**
 * Källor och metod: every source, when it was last read, what the words mean, how the
 * numbers are made, what they cannot tell you, and where to get the tables themselves.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { load, type Now, type Sessions } from '../../parliament/data'
import { dayName, monthName } from '../controls'
import { Term } from '../Term'
import { loadBudgetReport } from './BudgetTheme'

type Dates = {
  now?: string
  news?: string
  polls?: string
  votes?: string
  budget?: string
}

export default function KallorTheme() {
  const [dates, setDates] = useState<Dates>({})
  useEffect(() => {
    // Each source separately: one missing file must not hide the others' dates.
    load<Now>('parliament/now.json')
      .then((n) => setDates((d) => ({ ...d, now: n.generated_at })))
      .catch(() => {})
    load<{ generated_at: string }>('parliament/news.json')
      .then((n) => setDates((d) => ({ ...d, news: n.generated_at })))
      .catch(() => {})
    load<{ polls: { survey_month: string }[] }>('parliament/polls.json')
      .then((p) =>
        setDates((d) => ({
          ...d,
          polls: p.polls
            .map((x) => x.survey_month)
            .sort()
            .at(-1),
        })),
      )
      .catch(() => {})
    load<Sessions>('parliament/sessions.json')
      .then((s) =>
        setDates((d) => ({ ...d, votes: s.sessions.at(-1)?.last_vote })),
      )
      .catch(() => {})
    loadBudgetReport()
      .then((b) => setDates((d) => ({ ...d, budget: b.coverage.generated_at })))
      .catch(() => {})
  }, [])

  const sources: {
    name: string
    url: string
    what: [string, string]
    date?: string
    dateKind: [string, string]
  }[] = [
    {
      name: 'Valmyndigheten',
      url: 'https://www.val.se',
      what: ['Election results and seats, 2026', 'Valresultat och mandat 2026'],
      date: dates.now && dayName(dates.now),
      dateKind: ['read', 'hämtad'],
    },
    {
      name: 'SCB',
      url: 'https://www.scb.se',
      what: [
        'Party preference survey (PSU) and elections 1973–2022',
        'Partisympatiundersökningen (PSU) och valen 1973–2022',
      ],
      date: dates.polls && monthName(dates.polls),
      dateKind: ['latest survey', 'senaste mätning'],
    },
    {
      name: 'Sveriges riksdag, öppna data',
      url: 'https://data.riksdagen.se',
      what: [
        'Roll calls, decisions, speeches, laws and budget reports',
        'Voteringar, beslut, anföranden, lagar och budgetbetänkanden',
      ],
      date: dates.votes && dayName(dates.votes),
      dateKind: ['latest roll call', 'senaste votering'],
    },
    {
      name: 'Regeringskansliet',
      url: 'https://www.regeringen.se',
      what: ['The government, press releases', 'Regeringen, pressmeddelanden'],
      date: dates.now && dayName(dates.now),
      dateKind: ['read', 'hämtad'],
    },
    {
      name: 'SVT Nyheter och Sveriges Radio Ekot',
      url: 'https://www.svt.se/nyheter/',
      what: [
        'Political headlines (the article stays with its publisher)',
        'Politiska rubriker (artikeln ligger kvar hos utgivaren)',
      ],
      date: dates.news && dayName(dates.news),
      dateKind: ['read', 'hämtad'],
    },
    {
      name: 'Finansutskottets betänkanden',
      url: 'https://data.riksdagen.se',
      what: [
        'Budget frames per expenditure area, government and parties',
        'Budgetramar per utgiftsområde, regeringen och partierna',
      ],
      date: dates.budget && dayName(dates.budget),
      dateKind: ['built', 'sammanställd'],
    },
  ]

  return (
    <article className="theme">
      <header className="theme-head">
        <h1 className="theme-question">
          {l('Sources and method', 'Källor och metod')}
        </h1>
        <p className="theme-why">
          {l(
            'Every number here comes from an official, public source. This page says which, when it was read, and what the numbers can and cannot tell you.',
            'Varje siffra här kommer från en officiell, öppen källa. Den här sidan visar vilken, när den lästes, och vad siffrorna kan och inte kan säga.',
          )}
        </p>
      </header>

      <section className="sources-block" aria-labelledby="sources-list">
        <h2 id="sources-list" className="theme-chart-title">
          {l('Sources', 'Källor')}
        </h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{l('Source', 'Källa')}</th>
                <th scope="col">{l('What it gives', 'Vad den ger')}</th>
                <th scope="col">{l('Updated', 'Uppdaterad')}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.name}>
                  <th scope="row">
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.name} ↗
                    </a>
                  </th>
                  <td>{l(...s.what)}</td>
                  <td>{s.date ? `${l(...s.dateKind)} ${s.date}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sources-block" aria-labelledby="sources-terms">
        <h2 id="sources-terms" className="theme-chart-title">
          {l('Definitions', 'Definitioner')}
        </h2>
        <dl className="definitions">
          <div>
            <dt>{l('Roll call', 'Votering')}</dt>
            <dd>
              {l(
                'A vote where every member’s choice is recorded. A party’s position is what most of its members present voted.',
                'En omröstning där varje ledamots val registreras. Ett partis ståndpunkt är vad flest av dess närvarande ledamöter röstade.',
              )}
            </dd>
          </div>
          <div>
            <dt>{l('Governing side', 'Regeringssidan')}</dt>
            <dd>
              {l(
                'The government parties and parties with a written agreement with the government.',
                'Regeringspartierna och partier med ett skriftligt avtal med regeringen.',
              )}
            </dd>
          </div>
          <div>
            <dt>{l('Expenditure area', 'Utgiftsområde')}</dt>
            <dd>
              {l(
                'One of the 27 areas the state budget is divided into, such as defence or healthcare.',
                'Ett av de 27 områden som statens budget delas in i, till exempel försvar eller sjukvård.',
              )}
            </dd>
          </div>
          <div>
            <dt>{l('Margin of error', 'Felmarginal')}</dt>
            <dd>
              {l(
                'How far a survey result may be from the true value because only a sample was asked (SCB gives 95 per cent intervals).',
                'Hur långt ett mätresultat kan ligga från det verkliga värdet eftersom bara ett urval tillfrågats (SCB anger 95-procentiga intervall).',
              )}
            </dd>
          </div>
          <div>
            <dt>{l('Issue words', 'Ämnesord')}</dt>
            <dd>
              {l(
                'Words in a speech that match the word list of one of the 27 budget areas.',
                'Ord i ett tal som matchar ordlistan för något av budgetens 27 områden.',
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="sources-block" aria-labelledby="sources-method">
        <h2 id="sources-method" className="theme-chart-title">
          {l('Method', 'Metod')}
        </h2>
        <p className="ds-body">
          {l(
            'The sources are read by ingestion jobs, stored unchanged, and transformed with tested SQL models (dbt and DuckDB) into the tables the site reads. Each step is logged, so every number can be traced to its source file.',
            'Källorna hämtas av inläsningsjobb, sparas oförändrade och omvandlas med testade SQL-modeller (dbt och DuckDB) till de tabeller sajten läser. Varje steg loggas, så att varje siffra kan spåras till sin källfil.',
          )}
        </p>
        <p className="ds-body">
          {l(
            'The detailed language views use',
            'Språkanalyserna i fördjupningen använder',
          )}{' '}
          <Term
            word="embeddings"
            explain={l(
              'Texts turned into numbers so that similar meaning gives similar numbers.',
              'Texter omvandlade till siffror så att liknande innebörd ger liknande siffror.',
            )}
          />
          ,{' '}
          <Term
            word="UMAP"
            explain={l(
              'Places similar texts close together on a flat map.',
              'Placerar liknande texter nära varandra på en platt karta.',
            )}
          />{' '}
          {l('and', 'och')}{' '}
          <Term
            word="HDBSCAN"
            explain={l(
              'Finds groups of similar texts.',
              'Hittar grupper av liknande texter.',
            )}
          />
          {l(
            '. The groups are machine-made and have not been checked by hand.',
            '. Grupperna är maskinellt framtagna och har inte kontrollerats för hand.',
          )}
        </p>
      </section>

      <section className="sources-block" aria-labelledby="sources-limits">
        <h2 id="sources-limits" className="theme-chart-title">
          {l('Known limitations', 'Kända begränsningar')}
        </h2>
        <ul className="limits">
          <li>
            {l(
              'A survey is not an election; small changes may be chance.',
              'En mätning är inte ett val; små förändringar kan bero på slumpen.',
            )}
          </li>
          <li>
            {l(
              'Voting alike is not the same as agreeing: most decisions are uncontroversial.',
              'Att rösta lika är inte samma sak som att hålla med: de flesta beslut är okontroversiella.',
            )}
          </li>
          <li>
            {l(
              'Budget motions are proposals, not decisions, and only opposition parties table them.',
              'Budgetmotioner är förslag, inte beslut, och bara oppositionspartier lägger dem.',
            )}
          </li>
          <li>
            {l(
              'Counting words about a subject says nothing about the party’s position on it.',
              'Att räkna ord om ett ämne säger inget om partiets ståndpunkt i frågan.',
            )}
          </li>
          <li>
            {l(
              'News items are tagged by the parties they name; an item can name a party without being about it.',
              'Nyheter märks med de partier de nämner; en nyhet kan nämna ett parti utan att handla om det.',
            )}
          </li>
        </ul>
      </section>

      <section className="sources-block" aria-labelledby="sources-data">
        <h2 id="sources-data" className="theme-chart-title">
          {l('The tables themselves', 'Tabellerna själva')}
        </h2>
        <ul className="ds-rule-list">
          <li>
            <a className="explore-row" href="#raw-data">
              <strong>{l('Tables and raw data', 'Tabeller och rådata')}</strong>
              <span>
                {l(
                  'Browse, filter and download every table.',
                  'Bläddra, filtrera och ladda ned varje tabell.',
                )}
              </span>
            </a>
          </li>
          <li>
            <a className="explore-row" href="#data-model">
              <strong>{l('Data model', 'Datamodell')}</strong>
              <span>
                {l(
                  'Every table, how they connect, with example rows.',
                  'Alla tabeller, hur de hänger ihop, med exempelrader.',
                )}
              </span>
            </a>
          </li>
          <li>
            <a className="explore-row" href="#status">
              <strong>{l('Pipeline status', 'Pipelinens status')}</strong>
              <span>
                {l(
                  'The latest run, its tests and every source.',
                  'Senaste körningen, dess tester och varje källa.',
                )}
              </span>
            </a>
          </li>
          <li>
            <a
              className="explore-row"
              href="https://github.com/korv9/anton-portfolio"
              target="_blank"
              rel="noreferrer"
            >
              <strong>{l('Code on GitHub', 'Koden på GitHub')} ↗</strong>
              <span>
                {l(
                  'Ingestion, dbt models and the site.',
                  'Hämtning, dbt-modeller och sajten.',
                )}
              </span>
            </a>
          </li>
        </ul>
      </section>
    </article>
  )
}
