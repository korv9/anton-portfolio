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
          'I started building this platform with the idea that I would ingest as many data sources as possible. I was naive to think this would automatically produce actionable insights. Then I realised that the presentation of the data, with all its graphs and diagrams, is just as important.',
          'Jag började bygga den här plattformen med idén att läsa in så många datakällor som möjligt. Jag var naiv som trodde att det automatiskt skulle ge insikter att agera på. Sedan insåg jag att presentationen av datan, med alla dess grafer och diagram, är lika viktig.',
        )}
      </p>
      <Feed />
    </div>
  )
}
