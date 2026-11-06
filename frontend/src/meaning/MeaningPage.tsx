/**
 * What does it even mean? An overwhelming feed of every chart the site's data allows: the title,
 * why the feed exists, then one line per subject, the charts and their legends. The feed lives in
 * ./Feed.tsx; the page wears the site's shared ivory-on-charcoal tokens.
 */
import Feed from './Feed'
import { l } from '../i18n'

export default function MeaningPage() {
  return (
    <div className="mean-page">
      <h1 className="mean-title">
        {/* The product's name, kept in English in both languages as in the hub and header. */}
        {l('What does it even mean?', 'What does it even mean?')}
      </h1>
      <p className="mean-lede">
        {l(
          'Every chart the platform produces, in one feed: politics, Sweden, job ads, the AI Act, Swedish law, symbols, philosophy, concepts and the platform itself. Each card names its source.',
          'Alla diagram plattformen producerar, i ett flöde: politik, Sverige, platsannonser, AI-förordningen, svensk lag, symboler, filosofi, begrepp och plattformen själv. Varje kort anger sin källa.',
        )}
      </p>
      <Feed />
    </div>
  )
}
