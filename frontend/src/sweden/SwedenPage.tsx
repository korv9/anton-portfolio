/**
 * The SWEDEN platform's routes (router.ts SWEDEN_PATHS): the hub at #sweden, a page per research
 * product, Connections, and #sweden-kit for developing the shared components. A product whose
 * data has not run yet shows its question and an EmptyState, never sample findings.
 */
import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { SWEDEN_PRODUCTS, productByHref, type SwedenProduct } from './products'
import {
  EmptyState,
  EvidenceStamp,
  RelatedProjects,
  Scene,
  StatusStamp,
  SwedenMasthead,
} from './template'
import './sweden.css'

// Products with findings, each loaded only on its own route.
const PAGES: Record<
  string,
  LazyExoticComponent<ComponentType<{ route: Route }>>
> = {
  '#sweden-matning': lazy(() => import('./Measurement')),
  '#sweden-arbete': lazy(() => import('./Language')),
  '#sweden-likhet': lazy(() => import('./Similarity')),
  '#sweden-tillhorighet': lazy(() => import('./Belonging')),
}

const b = (text: { en: string; sv: string }) => l(text.en, text.sv)

/** What each product still needs before its page can show findings. */
const PENDING: Partial<
  Record<
    SwedenProduct['id'],
    {
      shows: [string, string]
      needs: [string, string]
      state: 'ingestion' | 'validation' | 'licence' | 'cloud'
    }
  >
> = {
  E: {
    shows: [
      'Future-oriented themes in Riksdag speeches and in academic theses over time, each corpus on its own axis.',
      'Framtidsinriktade teman i riksdagsanföranden och i examensarbeten över tid, varje korpus på sin egen axel.',
    ],
    needs: [
      'A documented future-theme lexicon applied to the Riksdag speech corpus (2016/17 onward) and to DiVA abstracts, with language and genre kept apart.',
      'Ett dokumenterat lexikon för framtidsteman tillämpat på riksdagens anföranden (från 2016/17) och DiVA-sammanfattningar, med språk och genre åtskilda.',
    ],
    state: 'cloud',
  },
  X: {
    shows: [
      'Relationships between domains, each with its measurement contract, compatibility, result, uncertainty and confounders.',
      'Samband mellan domäner, vart och ett med sitt mätkontrakt, jämförbarhet, resultat, osäkerhet och störfaktorer.',
    ],
    needs: [
      'Validated results from at least two products on a shared geography or time grain.',
      'Validerade resultat från minst två produkter på samma geografi eller tidsupplösning.',
    ],
    state: 'validation',
  },
}

export default function SwedenPage({ route }: { route: Route }) {
  if (route.path === '#sweden') return <Hub />
  if (route.path === '#sweden-kit') return <Kit />
  const Page = PAGES[route.path]
  if (Page)
    return (
      <Suspense
        fallback={
          <p className="sweden sw-note" role="status">
            {l('Loading…', 'Laddar…')}
          </p>
        }
      >
        <Page route={route} />
      </Suspense>
    )
  const product = productByHref(route.path)!
  const pending = PENDING[product.id]!
  return (
    <article className="sweden sw-page">
      <SwedenMasthead current={product.href} />
      <Scene product={product} line={l(...pending.shows)}>
        <EmptyState
          state={pending.state}
          shows={l(...pending.shows)}
          needs={l(...pending.needs)}
          meanwhile={
            <a href="#sweden-matning">
              {l(
                'A — Politics of Measurement has findings',
                'A — Mätandets politik har resultat',
              )}
            </a>
          }
        />
      </Scene>
      <RelatedProjects product={product} />
    </article>
  )
}

function Hub() {
  return (
    <article className="sweden sw-page sw-hub">
      <SwedenMasthead current="#sweden" />
      <header className="sw-hub-head">
        <p className="sw-kicker">
          {l('Featured research platform', 'Utvald forskningsplattform')}
        </p>
        <h1>SWEDEN</h1>
        <p className="sw-question">
          {l(
            'What do we measure, what do we value, and what do we overlook?',
            'Vad mäter vi, vad värderar vi, och vad förbiser vi?',
          )}
        </p>
        <p className="sw-note">
          {l(
            'Five research products on work, culture, participation, belonging and imagined futures in Sweden, built on public data with their methods and limits in view. Each page says whether it has findings yet.',
            'Fem forskningsprodukter om arbete, kultur, deltagande, tillhörighet och föreställda framtider i Sverige, byggda på offentliga data med metod och begränsningar synliga. Varje sida säger om den har resultat ännu.',
          )}
        </p>
      </header>
      <ol className="sw-hub-list">
        {SWEDEN_PRODUCTS.map((p) => (
          <li key={p.id}>
            <a href={p.href}>
              <span className="sw-id">{p.id === 'X' ? '×' : p.id}</span>
              <span className="sw-hub-title">{b(p.title)}</span>
              <span className="sw-hub-question">{b(p.question)}</span>
              <StatusStamp status={p.status} />
            </a>
          </li>
        ))}
      </ol>
      <nav className="sw-hub-out" aria-label={l('More', 'Mer')}>
        <a href="#projekt">{l('Other projects', 'Andra projekt')}</a>
        <a href="#om-mig">{l('About me', 'Om mig')}</a>
      </nav>
    </article>
  )
}

/** Internal route for developing the shared components; it shows no data. */
function Kit() {
  return (
    <article className="sweden sw-page">
      <SwedenMasthead current="#sweden-kit" />
      <section className="sw-findings">
        <h1>SWEDEN kit</h1>
        <p className="sw-note">
          {l(
            'Component states only. Nothing on this page is data.',
            'Bara komponentlägen. Inget på sidan är data.',
          )}
        </p>
        <h2>{l('Status', 'Status')}</h2>
        <p>
          <StatusStamp status="findings" /> <StatusStamp status="pipeline" />{' '}
          <StatusStamp status="unavailable" />
        </p>
        <h2>{l('Evidence', 'Evidens')}</h2>
        <p>
          <EvidenceStamp evidence="descriptive" />{' '}
          <EvidenceStamp evidence="exploratory" />{' '}
          <EvidenceStamp evidence="causal" />
        </p>
        <h2>{l('Empty state', 'Tomt läge')}</h2>
        <EmptyState
          state="ingestion"
          shows={l(
            'What the visualisation would show.',
            'Vad visualiseringen skulle visa.',
          )}
          needs={l(
            'Which source or pipeline it needs.',
            'Vilken källa eller pipeline den behöver.',
          )}
        />
      </section>
    </article>
  )
}
