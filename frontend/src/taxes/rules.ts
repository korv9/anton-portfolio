/**
 * Swedish tax rules per income year, from Skatteverket. Every amount here has a source; a
 * new year is a new entry, never an edit of an old one.
 *
 * 2026:
 *  - Teknisk beskrivning SKV 433, utgåva 36 (2025-12-10): grundavdrag, förhöjt grundavdrag,
 *    statlig skatt, allmän pensionsavgift, skattereduktioner, public service-avgift
 *    https://www.skatteverket.se/download/18.1522bf3f19aea8075ba55c/1765284655603/teknisk-beskrivning-skv-433-2026-utgava-36.pdf
 *  - Belopp och procentsatser för inkomståret 2026 (2026-01-07): arbetsgivaravgifter,
 *    egenavgifter, fastighetsavgift, moms, prisbasbelopp, statslåneränta
 *    https://www.skatteverket.se/download/18.1522bf3f19aea8075ba3285/1765894689093/belopp-och-procentsatser-for-inkomstaret-2026.pdf
 *  - Investeringssparkonto: skattefri nivå 300 000 kr från 2026, schablonintäkt 3,55 %
 *    https://www.skatteverket.se/privat/skatter/vardepapper/investeringssparkontoisk.4.5fc8c94513259a4ba1d800037851.html
 *  - Lägre arbetsgivaravgifter för ungdomar, 1 april 2026 - 30 september 2027
 *    https://www.skatteverket.se/omoss/pressochmedia/nyheter/2026/nyheter/lagrearbetsgivaravgifterforungdomar.5.70685bee19c85dd5dd02b10.html
 */

export type TaxRules = {
  year: number
  /** Prisbasbelopp and inkomstbasbelopp. */
  pbb: number
  ibb: number
  /** Statlig inkomstskatt: rate above the skiktgräns, charged when the excess is at least minExcess. */
  state: { threshold: number; rate: number; minExcess: number }
  /** Allmän pensionsavgift. */
  pensionFee: { rate: number; floorPbb: number; ceilingIbb: number }
  publicService: { rate: number; capIbb: number }
  /** Skattereduktion för förvärvsinkomst. */
  earnedIncomeReduction: { from: number; to: number; rate: number; max: number }
  /** Tax on capital income, and the reduction for a capital deficit. */
  capital: {
    rate: number
    deficitRate: number
    deficitLimit: number
    deficitRateAbove: number
    /** Share of a loss that is deductible when it exceeds gains. */
    lossDeductibleShare: number
  }
  /** Investeringssparkonto and kapitalförsäkring: deemed income on the capital base. */
  isk: { deemedRate: number; taxFree: number }
  /** Kommunal fastighetsavgift for a småhus. */
  propertyFee: { cap: number; rate: number }
  employer: {
    standard: number
    /** Born in these years: only the old-age pension contribution. */
    reduced: { bornFrom: number; bornTo: number; rate: number }
    /** Temporary lower rate for young employees, on pay up to a monthly cap, for some months. */
    youth: {
      bornFrom: number
      bornTo: number
      rate: number
      monthlyCap: number
      months: number
    } | null
  }
  selfEmployed: {
    standard: number
    reduced: { bornFrom: number; bornTo: number; rate: number }
  }
  vat: { rate: number; examples: [string, string] }[]
  sources: { label: string; url: string }[]
}

export const RULES: Record<number, TaxRules> = {
  2026: {
    year: 2026,
    pbb: 59_200,
    ibb: 83_400,
    state: { threshold: 643_000, rate: 0.2, minExcess: 200 },
    pensionFee: { rate: 0.07, floorPbb: 0.423, ceilingIbb: 8.07 },
    publicService: { rate: 0.01, capIbb: 1.42 },
    earnedIncomeReduction: {
      from: 40_000,
      to: 240_000,
      rate: 0.0075,
      max: 1_500,
    },
    capital: {
      rate: 0.3,
      deficitRate: 0.3,
      deficitLimit: 100_000,
      deficitRateAbove: 0.21,
      lossDeductibleShare: 0.7,
    },
    isk: { deemedRate: 0.0355, taxFree: 300_000 },
    propertyFee: { cap: 10_425, rate: 0.0075 },
    employer: {
      standard: 0.3142,
      reduced: { bornFrom: 1938, bornTo: 1958, rate: 0.1021 },
      youth: {
        bornFrom: 2003,
        bornTo: 2007,
        rate: 0.2081,
        monthlyCap: 25_000,
        months: 9,
      },
    },
    selfEmployed: {
      standard: 0.2897,
      reduced: { bornFrom: 1938, bornTo: 1958, rate: 0.1021 },
    },
    vat: [
      {
        rate: 25,
        examples: ['Most goods and services', 'De flesta varor och tjänster'],
      },
      {
        rate: 12,
        examples: [
          'Restaurants, some repairs',
          'Restaurang, vissa reparationer',
        ],
      },
      {
        rate: 6,
        examples: [
          'Books, newspapers, passenger transport',
          'Böcker, tidningar, persontransporter',
        ],
      },
    ],
    sources: [
      {
        label: 'Skatteverket, Teknisk beskrivning SKV 433 (2026)',
        url: 'https://www.skatteverket.se/download/18.1522bf3f19aea8075ba55c/1765284655603/teknisk-beskrivning-skv-433-2026-utgava-36.pdf',
      },
      {
        label: 'Skatteverket, Belopp och procentsatser 2026',
        url: 'https://www.skatteverket.se/download/18.1522bf3f19aea8075ba3285/1765894689093/belopp-och-procentsatser-for-inkomstaret-2026.pdf',
      },
      {
        label: 'Skatteverket, Investeringssparkonto (ISK)',
        url: 'https://www.skatteverket.se/privat/skatter/vardepapper/investeringssparkontoisk.4.5fc8c94513259a4ba1d800037851.html',
      },
      {
        label: 'Skatteverket, Lägre arbetsgivaravgifter för ungdomar',
        url: 'https://www.skatteverket.se/omoss/pressochmedia/nyheter/2026/nyheter/lagrearbetsgivaravgifterforungdomar.5.70685bee19c85dd5dd02b10.html',
      },
    ],
  },
}

export const LATEST_YEAR = Math.max(...Object.keys(RULES).map(Number))
