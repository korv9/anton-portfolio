/**
 * The SWEDEN research platform: six research products and Connections. Their names, questions
 * and order are fixed by the research brief; `status` says what the page can show today and is
 * changed only when a product's data has run and been validated.
 */
import type { Bilingual } from '../projects/projectRegistry'

export type Status = 'findings' | 'pipeline' | 'unavailable'
export type Evidence = 'descriptive' | 'exploratory' | 'causal'

export type SwedenProduct = {
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'X'
  href: string
  title: Bilingual
  /** One word for the navigation row. */
  short: Bilingual
  question: Bilingual
  status: Status
  /** Related products and why, two or three. */
  related: { id: SwedenProduct['id']; why: Bilingual }[]
}

export const SWEDEN_PRODUCTS: SwedenProduct[] = [
  {
    id: 'A',
    href: '#sweden-matning',
    title: { en: 'Politics of Measurement', sv: 'Mätandets politik' },
    short: { en: 'Measurement', sv: 'Mätning' },
    question: {
      en: 'What does Sweden measure, and what does it overlook?',
      sv: 'Vad mäter Sverige, och vad förbiser det?',
    },
    status: 'findings',
    related: [
      {
        id: 'D',
        why: {
          en: 'Culture has the fewest tables of any mapped domain in SCB’s database, and social relationships, civil society included, has none in Kolada’s classification. D maps public libraries from KB’s statistics.',
          sv: 'Kultur har minst antal tabeller av de indelade domänerna i SCB:s statistikdatabas, och sociala relationer, civilsamhället inräknat, har inga i Koladas indelning. D kartlägger folkbiblioteken med KB:s statistik.',
        },
      },
      {
        id: 'C',
        why: {
          en: 'Only measures published per municipality can enter the similarity analysis.',
          sv: 'Bara mått som publiceras per kommun kan ingå i likhetsanalysen.',
        },
      },
    ],
  },
  {
    id: 'B',
    href: '#sweden-arbete',
    title: { en: 'The Ideal Human', sv: 'Den ideala människan' },
    short: { en: 'Work', sv: 'Arbete' },
    question: {
      en: "How have Swedish employers' expectations of the ideal worker changed?",
      sv: 'Hur har svenska arbetsgivares förväntningar på den ideala arbetstagaren förändrats?',
    },
    status: 'findings',
    related: [
      {
        id: 'E',
        why: {
          en: 'Job-ad language and political language over time: two vocabularies of the future.',
          sv: 'Annonsspråk och politiskt språk över tid: två vokabulärer för framtiden.',
        },
      },
      {
        id: 'A',
        why: {
          en: 'Employment is the most densely measured domain in SCB’s database.',
          sv: 'Sysselsättning är den tätast mätta domänen i SCB:s statistikdatabas.',
        },
      },
    ],
  },
  {
    id: 'C',
    href: '#sweden-likhet',
    title: { en: 'The Invisible Sweden', sv: 'Det osynliga Sverige' },
    short: { en: 'Similarity', sv: 'Likhet' },
    question: {
      en: 'Which parts of Sweden are socially similar despite geographical distance?',
      sv: 'Vilka delar av Sverige liknar varandra socialt trots geografiskt avstånd?',
    },
    status: 'findings',
    related: [
      {
        id: 'D',
        why: {
          en: 'The same municipalities and map: access to meeting places within each similarity group.',
          sv: 'Samma kommuner och karta: tillgång till mötesplatser inom varje likhetsgrupp.',
        },
      },
      {
        id: 'A',
        why: {
          en: 'Which domains reach municipal resolution decides which dimensions C can use.',
          sv: 'Vilka domäner som når kommunnivå avgör vilka dimensioner C kan använda.',
        },
      },
    ],
  },
  {
    id: 'D',
    href: '#sweden-tillhorighet',
    title: {
      en: 'The Infrastructure of Belonging',
      sv: 'Tillhörighetens infrastruktur',
    },
    short: { en: 'Belonging', sv: 'Tillhörighet' },
    question: {
      en: 'Where can people participate in collective life without needing to consume?',
      sv: 'Var kan människor delta i gemensamt liv utan att behöva konsumera?',
    },
    status: 'findings',
    related: [
      {
        id: 'C',
        why: {
          en: 'Civic access compared across socially similar municipalities.',
          sv: 'Civil tillgång jämförd mellan socialt lika kommuner.',
        },
      },
      {
        id: 'A',
        why: {
          en: 'What official statistics say, and do not say, about culture and civil society.',
          sv: 'Vad den officiella statistiken säger, och inte säger, om kultur och civilsamhälle.',
        },
      },
    ],
  },
  {
    id: 'E',
    href: '#sweden-framtid',
    title: { en: 'The Lost Futures', sv: 'De förlorade framtiderna' },
    short: { en: 'Futures', sv: 'Framtid' },
    question: {
      en: 'How have Swedish visions of the future changed?',
      sv: 'Hur har svenska framtidsvisioner förändrats?',
    },
    status: 'findings',
    related: [
      {
        id: 'B',
        why: {
          en: 'Careers and self-development as the individual version of a future.',
          sv: 'Karriär och självutveckling som framtidens individuella version.',
        },
      },
      {
        id: 'X',
        why: {
          en: 'The Riksdag and thesis abstracts are shown apart on The Lost Futures page, never joined.',
          sv: 'Riksdagen och uppsatssammanfattningarna visas var för sig på sidan De förlorade framtiderna, aldrig sammanslagna.',
        },
      },
    ],
  },
  {
    id: 'F',
    href: '#sweden-valfard',
    title: { en: 'The Welfare Contract', sv: 'Välfärdskontraktet' },
    short: { en: 'Welfare', sv: 'Välfärd' },
    question: {
      en: 'What do Swedes pay into the welfare state, and how far do they trust each other?',
      sv: 'Vad betalar svenskar in till välfärdsstaten, och hur mycket litar de på varandra?',
    },
    status: 'findings',
    related: [
      {
        id: 'A',
        why: {
          en: 'A survey’s mode of collection can move its results: measurement shapes what a trend looks like.',
          sv: 'En enkäts insamlingssätt kan flytta resultaten: mätningen formar hur en trend ser ut.',
        },
      },
      {
        id: 'X',
        why: {
          en: 'Taxes and trust are shown side by side, not joined: four Nordic countries are too few for a relationship.',
          sv: 'Skatt och tillit visas sida vid sida, inte sammankopplade: fyra nordiska länder är för få för ett samband.',
        },
      },
    ],
  },
  {
    id: 'X',
    href: '#sweden-samband',
    title: { en: 'Connections', sv: 'Samband' },
    short: { en: 'Connections', sv: 'Samband' },
    question: {
      en: 'Which relationships between domains hold when measurement, time and geography are compatible?',
      sv: 'Vilka samband mellan domäner håller när mått, tid och geografi är jämförbara?',
    },
    status: 'findings',
    related: [
      {
        id: 'A',
        why: {
          en: 'Every join starts from the measurement contracts catalogued in A.',
          sv: 'Varje koppling börjar i de mätkontrakt som katalogiseras i A.',
        },
      },
      {
        id: 'C',
        why: {
          en: 'Municipal joins share C’s geography and identifiers.',
          sv: 'Kommunala kopplingar delar C:s geografi och identifierare.',
        },
      },
    ],
  },
]

export const productById = (id: SwedenProduct['id']) =>
  SWEDEN_PRODUCTS.find((p) => p.id === id)!
