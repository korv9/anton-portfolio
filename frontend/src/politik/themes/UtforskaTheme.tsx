/**
 * Utforska själv: every detailed view, grouped by the question it helps answer. The advanced
 * analyses (the language map, the speech archive, every roll call) live here, one click away,
 * instead of competing with the themes' main charts.
 */
import { l } from '../../i18n'
import { RIKSDAG_PARTIES, PartyLogo, partyName } from '../../parties/identity'
import { DEEP_DIVES, THEMES } from '../nav'
import { Term } from '../Term'

const TECHNICAL: Record<string, string> = {
  '#debates': 'UMAP · HDBSCAN · embeddings',
  '#data-explorer': 'Fulltext · anföranden sedan 1993',
  '#politics': 'fct_roll_call · decision points',
  '#raw-data': 'Parquet · DuckDB-WASM',
}

export default function UtforskaTheme() {
  const groups = THEMES.filter((t) => !['utforska'].includes(t.key)).map(
    (theme) => ({
      theme,
      dives: Object.entries(DEEP_DIVES).filter(
        ([path, d]) => d.parent === theme.key && path !== '#budget-comparison',
      ),
    }),
  )
  return (
    <article className="theme">
      <header className="theme-head">
        <h1 className="theme-question">
          {l('Explore for yourself', 'Utforska själv')}
        </h1>
        <p className="theme-why">
          {l(
            'All the data behind the themes, with every filter and detailed view: every roll call, every speech, every budget line and the language analyses.',
            'All data bakom temana, med alla filter och detaljerade vyer: varje votering, varje tal, varje budgetrad och språkanalyserna.',
          )}
        </p>
      </header>

      <section className="explore-parties" aria-labelledby="explore-parties">
        <h2 id="explore-parties" className="theme-chart-title">
          {l('Start from a party', 'Börja med ett parti')}
        </h2>
        <ul>
          {RIKSDAG_PARTIES.map((p) => (
            <li key={p}>
              <a href={`#parties-${p.toLowerCase()}`}>
                <PartyLogo party={p} size={28} />
                <span>{partyName(p)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {groups
        .filter((g) => g.dives.length)
        .map(({ theme, dives }) => (
          <section
            key={theme.key}
            className="explore-group"
            aria-labelledby={`explore-${theme.key}`}
          >
            <h2 id={`explore-${theme.key}`} className="theme-chart-title">
              <a href={theme.path}>{l(theme.en, theme.sv)}</a>
            </h2>
            <ul className="ds-rule-list">
              {dives.map(([path, dive]) => (
                <li key={path}>
                  <a href={path} className="explore-row">
                    <strong>{l(dive.en, dive.sv)}</strong>
                    <span>{l(dive.aboutEn, dive.aboutSv)}</span>
                    {TECHNICAL[path] && <small>{TECHNICAL[path]}</small>}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <section className="explore-group" aria-labelledby="explore-terms">
        <h2 id="explore-terms" className="theme-chart-title">
          {l(
            'Words used in the detailed views',
            'Ord som används i fördjupningarna',
          )}
        </h2>
        <p className="ds-small">
          <Term
            word="UMAP"
            explain={l(
              'A method that places similar texts close together on a flat map.',
              'En metod som placerar liknande texter nära varandra på en platt karta.',
            )}
          />
          {' · '}
          <Term
            word="Embedding"
            explain={l(
              'A text turned into numbers, so that texts with similar meaning get similar numbers.',
              'En text omvandlad till siffror, så att texter med liknande innebörd får liknande siffror.',
            )}
          />
          {' · '}
          <Term
            word="HDBSCAN"
            explain={l(
              'A method that finds groups of similar texts without deciding the number of groups in advance.',
              'En metod som hittar grupper av liknande texter utan att antalet grupper bestäms i förväg.',
            )}
          />
          {' · '}
          <Term
            word={l('Roll call', 'Votering')}
            explain={l(
              'A vote in the Riksdag where every member’s choice is recorded.',
              'En omröstning i riksdagen där varje ledamots val registreras.',
            )}
          />
        </p>
      </section>
    </article>
  )
}
