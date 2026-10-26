/**
 * The SWEDEN research platform: six research products and Connections. Their names, questions
 * and order are fixed by the research brief.
 */
import type { Bilingual } from '../projects/projectRegistry'

export type Evidence = 'descriptive' | 'exploratory' | 'causal'

export type SwedenProduct = {
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'X'
  href: string
  title: Bilingual
  /** One word for the navigation row. */
  short: Bilingual
  question: Bilingual
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
  },
]

export const productById = (id: SwedenProduct['id']) =>
  SWEDEN_PRODUCTS.find((p) => p.id === id)!
