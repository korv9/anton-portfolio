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

/**
 * One piece of a piecewise-linear schedule, as Skatteverket writes them: for x up to `to`
 * (inclusive), the value is base + rate x (x - over). `to`, `base` and `over` are in the
 * schedule's unit, a price base amount or one krona; the last piece has no upper bound.
 */
export type Piece = {
  to: number | null
  base: number
  rate: number
  over: number
}
export type Schedule = { unit: 'pbb' | 'kr'; pieces: Piece[] }

/**
 * A social contribution rate for people born in a range of years (open at either end), for
 * some months of the year, on pay up to a monthly cap; pay above the cap, and the months not
 * covered, pay the standard rate.
 */
export type ContributionBand = {
  bornFrom: number | null
  bornTo: number | null
  rate: number
  months: number
  monthlyCap: number | null
}

const band = (
  bornFrom: number | null,
  bornTo: number | null,
  rate: number,
  months = 12,
  monthlyCap: number | null = null,
): ContributionBand => ({ bornFrom, bornTo, rate, months, monthlyCap })

export type TaxRules = {
  year: number
  /** Prisbasbelopp and inkomstbasbelopp. */
  pbb: number
  ibb: number
  /** The age reached by the start of the year that gives the higher allowance and credit. */
  seniorAge: { allowance: number; credit: number }
  /** Statlig inkomstskatt: each bracket's rate on taxable income above its threshold. */
  state: { brackets: { threshold: number; rate: number }[] }
  /** Grundavdrag, and the förhöjt grundavdrag added to it at the senior age. */
  basicAllowance: Schedule
  raisedAllowance: Schedule | null
  /** Jobbskatteavdrag. Under the senior age: (schedule - basic allowance) x municipal rate,
   * less a phase-out share of work income above a threshold where there is one. At or over
   * it: the schedule itself. */
  inWorkCredit: {
    young: Schedule
    phaseOut: { fromPbb: number; rate: number } | null
    senior: Schedule
  }
  /** Skattereduktion för sjuk- och aktivitetsersättning, from 2018. `share`: the schedule
   * times the municipal rate. `lessAllowance`: the schedule less the basic allowance, but at
   * least minShare of the compensation, times the municipal rate. */
  sicknessReduction:
    | { mode: 'share'; schedule: Schedule }
    | { mode: 'lessAllowance'; schedule: Schedule; minShare: number }
    | null
  /** Allmän pensionsavgift. */
  pensionFee: { rate: number; floorPbb: number; ceilingIbb: number }
  /** Public service-avgift, from 2019. */
  publicService: { rate: number; capIbb: number } | null
  /** Skattereduktion för förvärvsinkomst, from 2021. Set against municipal income tax only
   * from 2022; in 2021 against the tax as a whole. */
  earnedIncomeReduction: {
    from: number
    to: number
    rate: number
    max: number
    against: 'municipal' | 'all'
  } | null
  /** Tillfällig skattereduktion för arbetsinkomster, 2021 and 2022 (SFS 2021:930): a schedule
   * in kronor of work income, set off last, in the final tax only (not in the tables). */
  temporaryWorkReduction: Schedule | null
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
  /** Arbetsgivaravgifter: the standard rate, and the rates for people born in some years,
   * for some months of the year, on pay up to a monthly cap. */
  employer: { standard: number; bands: ContributionBand[] }
  /** Egenavgifter for a sole proprietor, the same way (no caps). */
  selfEmployed: { standard: number; bands: ContributionBand[] }
  vat: { rate: number; examples: [string, string] }[]
  sources: { label: string; url: string }[]
}

/** Shorthand for a schedule's pieces: [to, base, rate, over]. */
const schedule = (
  unit: Schedule['unit'],
  pieces: [number | null, number, number, number][],
): Schedule => ({
  unit,
  pieces: pieces.map(([to, base, rate, over]) => ({ to, base, rate, over })),
})

/** The ordinary basic allowance has kept its shape since 2011; only the price base amount moves. */
const BASIC_ALLOWANCE = schedule('pbb', [
  [0.99, 0.423, 0, 0],
  [2.72, 0.423, 0.2, 0.99],
  [3.11, 0.77, 0, 0],
  [7.88, 0.77, -0.1, 3.11],
  [null, 0.293, 0, 0],
])

const RULES_2026: TaxRules = {
  year: 2026,
  pbb: 59_200,
  ibb: 83_400,
  seniorAge: { allowance: 66, credit: 66 },
  state: { brackets: [{ threshold: 643_000, rate: 0.2 }] },
  basicAllowance: BASIC_ALLOWANCE,
  raisedAllowance: schedule('pbb', [
    [0.91, 0.687, 0, 0],
    [1.11, 0.885, -0.2, 0],
    [1.965, 0.6, 0.057, 0],
    [2.72, 0.333, 0.1949, 0],
    [3.11, -0.212, 0.3949, 0],
    [3.24, -0.523, 0.4949, 0],
    [5.0, -0.073, 0.356, 0],
    [7.88, 0.017, 0.338, 0],
    [8.08, 0.703, 0.251, 0],
    [11.16, 2.732, 0, 0],
    [12.84, 9.651, -0.62, 0],
    [null, 1.691, 0, 0],
  ]),
  inWorkCredit: {
    young: schedule('pbb', [
      [0.91, 0, 1, 0],
      [3.24, 0.91, 0.3874, 0.91],
      [8.08, 1.813, 0.251, 3.24],
      [null, 3.027, 0, 0],
    ]),
    phaseOut: null,
    senior: schedule('pbb', [
      [1.75, 0, 0.22, 0],
      [5.24, 0.2635, 0.07, 0],
      [null, 0.6293, 0, 0],
    ]),
  },
  sicknessReduction: {
    mode: 'lessAllowance',
    schedule: schedule('pbb', [
      [0.91, 0, 1, 0],
      [3.24, 0.91, 0.3874, 0.91],
      [null, 1.813, 0.251, 3.24],
    ]),
    minShare: 0.045,
  },
  pensionFee: { rate: 0.07, floorPbb: 0.423, ceilingIbb: 8.07 },
  publicService: { rate: 0.01, capIbb: 1.42 },
  earnedIncomeReduction: {
    from: 40_000,
    to: 240_000,
    rate: 0.0075,
    max: 1_500,
    against: 'municipal',
  },
  temporaryWorkReduction: null,
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
    bands: [
      band(null, 1937, 0),
      band(1938, 1958, 0.1021),
      // The lower rate for 19-23-year-olds from 1 April 2026: nine months of the year.
      band(2003, 2007, 0.2081, 9, 25_000),
    ],
  },
  selfEmployed: {
    standard: 0.2897,
    bands: [band(null, 1937, 0), band(1938, 1958, 0.1021)],
  },
  vat: [
    {
      rate: 25,
      examples: ['Most goods and services', 'De flesta varor och tjänster'],
    },
    {
      rate: 12,
      examples: [
        'Restaurants, hotels (food until 1 April 2026)',
        'Restaurang, hotell (livsmedel till 1 april 2026)',
      ],
    },
    {
      rate: 6,
      examples: [
        'Food from 1 April 2026, books, newspapers, passenger transport',
        'Livsmedel från 1 april 2026, böcker, tidningar, persontransporter',
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
}

/*
 * Past years. The personal income tax (allowances, credits, state tax, fees) follows each
 * year's SKV 433 and is tested against that year's withholding tables; see HISTORY below.
 */
/** The rules that the withholding tables do not show: capital, ISK, property fee, social
 * contributions and VAT. They are added to each past year below, from OTHER. */
type OtherRules = Pick<
  TaxRules,
  'capital' | 'isk' | 'propertyFee' | 'employer' | 'selfEmployed' | 'vat'
>
type PersonalRules = Omit<TaxRules, keyof OtherRules>

const skv433 = (year: number, url: string) => ({
  label: `Skatteverket, Teknisk beskrivning SKV 433 (${year})`,
  url,
})

/** Jobbskatteavdrag at 65 or over, in kronor, unchanged from 2014 to 2022. */
const SENIOR_CREDIT_2014 = schedule('kr', [
  [100_000, 0, 0.2, 0],
  [300_000, 15_000, 0.05, 0],
  [600_000, 30_000, 0, 0],
  [null, 30_000, -0.03, 600_000],
])

/** Jobbskatteavdrag under 65, 2016 to 2018 (SKV 433 2016 and 2018, bilaga 3). */
const YOUNG_CREDIT_2016 = schedule('pbb', [
  [0.91, 0, 1, 0],
  [2.94, 0.91, 0.332, 0.91],
  [8.08, 1.584, 0.111, 2.94],
  [null, 2.155, 0, 0],
])

const Y2016: PersonalRules = {
  year: 2016,
  pbb: 44_300,
  ibb: 59_300,
  seniorAge: { allowance: 65, credit: 65 },
  state: {
    brackets: [
      { threshold: 430_200, rate: 0.2 },
      { threshold: 625_800, rate: 0.05 },
    ],
  },
  basicAllowance: BASIC_ALLOWANCE,
  raisedAllowance: schedule('pbb', [
    [0.99, 0.687, 0, 0],
    [1.11, 0.885, -0.2, 0],
    [2.72, 0.609, 0.049, 0],
    [3.11, 0.741, 0, 0],
    [3.77, 0.43, 0.1, 0],
    [5.4, 0.807, 0, 0],
    [7.88, 0.753, 0.01, 0],
    [12.43, 1.541, -0.09, 0],
    [null, 0.422, 0, 0],
  ]),
  inWorkCredit: {
    young: YOUNG_CREDIT_2016,
    phaseOut: { fromPbb: 13.54, rate: 0.03 },
    senior: SENIOR_CREDIT_2014,
  },
  sicknessReduction: null,
  pensionFee: { rate: 0.07, floorPbb: 0.423, ceilingIbb: 8.07 },
  publicService: null,
  earnedIncomeReduction: null,
  temporaryWorkReduction: null,
  sources: [
    skv433(
      2016,
      'https://web.archive.org/web/2017/https://skatteverket.se/download/18.3810a01c150939e893fd09a/1450188269972/43326.pdf',
    ),
  ],
}

/** Sjuk- och aktivitetsersättning, 2018 to 2021: 4.5 % up to 2.53 price base amounts, 2.5 % above. */
const SICKNESS_2018 = {
  mode: 'share' as const,
  schedule: schedule('pbb', [
    [2.53, 0, 0.045, 0],
    [null, 0.045 * 2.53, 0.025, 2.53],
  ]),
}

const Y2017: PersonalRules = {
  ...Y2016,
  year: 2017,
  pbb: 44_800,
  ibb: 61_500,
  state: {
    brackets: [
      { threshold: 438_900, rate: 0.2 },
      { threshold: 638_500, rate: 0.05 },
    ],
  },
  sources: [
    {
      label:
        'Skatteverket, skattetabeller 2017 (öppna data), som reglerna prövas mot',
      url: 'https://skatteverket.entryscape.net/rowstore/dataset/88320397-5c32-4c16-ae79-d36d95b17b95',
    },
  ],
}

const Y2018: PersonalRules = {
  ...Y2016,
  year: 2018,
  pbb: 45_500,
  ibb: 62_500,
  state: {
    brackets: [
      { threshold: 455_300, rate: 0.2 },
      { threshold: 662_300, rate: 0.05 },
    ],
  },
  // Förhöjt grundavdrag as amended by prop. 2017/18:1 (inkomstskattelagen 63 kap. 3 a §).
  raisedAllowance: schedule('pbb', [
    [0.99, 0.687, 0, 0],
    [1.11, 0.885, -0.2, 0],
    [2.72, 0.609, 0.049, 0],
    [2.94, -0.162, 0.332, 0],
    [3.11, 0.482, 0.113, 0],
    [4.45, 0.171, 0.213, 0],
    [7.88, 1.376, -0.058, 0],
    [9.15, 2.164, -0.158, 0],
    [12.43, 1.541, -0.09, 0],
    [null, 0.422, 0, 0],
  ]),
  sicknessReduction: SICKNESS_2018,
  sources: [
    {
      label:
        'Prop. 2017/18:1, förslag till lag om ändring i inkomstskattelagen',
      url: 'https://data.riksdagen.se/dokument/H5031',
    },
    {
      label: 'Skatteverket, Exempel till Teknisk beskrivning 2018',
      url: 'https://www.skatteverket.se/download/18.b1014b415f3321c0de5b7e/1708610795250/Exempel%20till%20Teknisk%20beskrivning%202018,%20version%201.1.pdf',
    },
  ],
}

const Y2019: PersonalRules = {
  ...Y2018,
  year: 2019,
  pbb: 46_500,
  ibb: 64_400,
  state: {
    brackets: [
      { threshold: 490_700, rate: 0.2 },
      { threshold: 689_300, rate: 0.05 },
    ],
  },
  // Förhöjt grundavdrag and jobbskatteavdrag as adopted from reservation 5 (M, KD) in
  // bet. 2018/19:FiU1 (inkomstskattelagen 63 kap. 3 a § and 67 kap. 7 §).
  raisedAllowance: schedule('pbb', [
    [0.99, 0.687, 0, 0],
    [1.11, 0.885, -0.2, 0],
    [2.72, 0.6, 0.057, 0],
    [3.11, -0.169, 0.34, 0],
    [3.21, -0.48, 0.44, 0],
    [4.45, 0.207, 0.228, 0],
    [5.31, 1.397, -0.039, 0],
    [7.88, 0.763, 0.08, 0],
    [8.08, 1.551, -0.02, 0],
    [13.54, 2.399, -0.125, 0],
    [34, 1.031, -0.024, 0],
    [null, 0.215, 0, 0],
  ]),
  inWorkCredit: {
    young: schedule('pbb', [
      [0.91, 0, 1, 0],
      [3.24, 0.91, 0.3405, 0.91],
      [8.08, 1.703, 0.128, 3.24],
      [null, 2.323, 0, 0],
    ]),
    phaseOut: { fromPbb: 13.54, rate: 0.03 },
    senior: SENIOR_CREDIT_2014,
  },
  publicService: { rate: 0.01, capIbb: 2.092 },
  sources: [
    {
      label: 'Bet. 2018/19:FiU1, reservation 5 (M, KD), lagförslag',
      url: 'https://data.riksdagen.se/dokument/H601FiU1',
    },
  ],
}

const Y2020: PersonalRules = {
  year: 2020,
  pbb: 47_300,
  ibb: 66_800,
  seniorAge: { allowance: 65, credit: 65 },
  state: { brackets: [{ threshold: 509_300, rate: 0.2 }] },
  basicAllowance: BASIC_ALLOWANCE,
  raisedAllowance: schedule('pbb', [
    [0.99, 0.687, 0, 0],
    [1.11, 0.885, -0.2, 0],
    [2.72, 0.6, 0.057, 0],
    [3.11, -0.169, 0.34, 0],
    [3.21, -0.48, 0.44, 0],
    [4.45, 0.207, 0.228, 0],
    [7.88, 0.488, 0.165, 0],
    [8.08, 1.276, 0.065, 0],
    [11.06, 2.205, -0.05, 0],
    [12.15, 7.182, -0.5, 0],
    [29.65, 1.654, -0.045, 0],
    [34, 1.031, -0.024, 0],
    [null, 0.215, 0, 0],
  ]),
  inWorkCredit: {
    young: schedule('pbb', [
      [0.91, 0, 1, 0],
      [3.24, 0.91, 0.3405, 0.91],
      [8.08, 1.703, 0.128, 3.24],
      [null, 2.323, 0, 0],
    ]),
    phaseOut: { fromPbb: 13.54, rate: 0.03 },
    senior: SENIOR_CREDIT_2014,
  },
  sicknessReduction: SICKNESS_2018,
  pensionFee: { rate: 0.07, floorPbb: 0.423, ceilingIbb: 8.07 },
  publicService: { rate: 0.01, capIbb: 2.092 },
  earnedIncomeReduction: null,
  temporaryWorkReduction: null,
  sources: [
    skv433(
      2020,
      'https://www.skatteverket.se/download/18.7eada0316ed67d7282797/1708607416979/Teknisk%20beskrivning%20SKV433%202020%20ver3%20.pdf',
    ),
  ],
}

/** Lag (2021:930) om tillfällig skattereduktion för arbetsinkomster, 4 §. */
const TEMPORARY_WORK_REDUCTION = schedule('kr', [
  [60_000, 0, 0, 0],
  [240_000, 0, 0.0125, 60_000],
  [300_000, 2_250, 0, 0],
  [500_000, 2_250, -0.01125, 300_000],
  [null, 0, 0, 0],
])

const Y2021: PersonalRules = {
  ...Y2020,
  year: 2021,
  pbb: 47_600,
  ibb: 68_200,
  state: { brackets: [{ threshold: 523_200, rate: 0.2 }] },
  raisedAllowance: schedule('pbb', [
    [0.99, 0.687, 0, 0],
    [1.11, 0.885, -0.2, 0],
    [2.72, 0.6, 0.057, 0],
    [3.11, -0.169, 0.34, 0],
    [3.21, -0.48, 0.44, 0],
    [7.88, 0.207, 0.228, 0],
    [8.08, 0.995, 0.128, 0],
    [11.28, 2.029, 0, 0],
    [12.53, 9.023, -0.62, 0],
    [13.54, 1.253, 0, 0],
    [35.36, 2.03, -0.0574, 0],
    [null, 0, 0, 0],
  ]),
  publicService: { rate: 0.01, capIbb: 1.95 },
  earnedIncomeReduction: {
    from: 40_000,
    to: 240_000,
    rate: 0.0075,
    max: 1_500,
    against: 'all',
  },
  temporaryWorkReduction: TEMPORARY_WORK_REDUCTION,
  sources: [
    skv433(
      2021,
      'https://www.skatteverket.se/download/18.5b35a6251761e691420443d/1708607364784/Teknisk%20beskrivning%20SKV433%202021.pdf',
    ),
  ],
}

const RAISED_2022 = schedule('pbb', [
  [0.91, 0.687, 0, 0],
  [1.11, 0.885, -0.2, 0],
  [1.965, 0.6, 0.057, 0],
  [2.72, 0.333, 0.1949, 0],
  [3.11, -0.212, 0.3949, 0],
  [3.24, -0.523, 0.4949, 0],
  [5.53, 0.325, 0.233, 0],
  [7.88, 0.441, 0.212, 0],
  [8.08, 1.104, 0.128, 0],
  [11.48, 2.139, 0, 0],
  [12.8, 9.257, -0.62, 0],
  [13.54, 1.32, 0, 0],
  [36.54, 2.097, -0.0574, 0],
  [null, 0, 0, 0],
])

/** Sjuk- och aktivitetsersättning from 2022: as the in-work credit, at least 4.5 %. */
const SICKNESS_2022 = {
  mode: 'lessAllowance' as const,
  schedule: schedule('pbb', [
    [0.91, 0, 1, 0],
    [3.24, 0.91, 0.3405, 0.91],
    [null, 1.703, 0.128, 3.24],
  ]),
  minShare: 0.045,
}

const Y2022: PersonalRules = {
  ...Y2021,
  year: 2022,
  pbb: 48_300,
  ibb: 71_000,
  state: { brackets: [{ threshold: 540_700, rate: 0.2 }] },
  raisedAllowance: RAISED_2022,
  inWorkCredit: {
    young: schedule('pbb', [
      [0.91, 0, 1, 0],
      [3.24, 0.91, 0.3874, 0.91],
      [8.08, 1.812, 0.128, 3.24],
      [null, 2.432, 0, 0],
    ]),
    phaseOut: { fromPbb: 13.54, rate: 0.03 },
    senior: SENIOR_CREDIT_2014,
  },
  sicknessReduction: SICKNESS_2022,
  publicService: { rate: 0.01, capIbb: 1.87 },
  earnedIncomeReduction: {
    from: 40_000,
    to: 240_000,
    rate: 0.0075,
    max: 1_500,
    against: 'municipal',
  },
  sources: [
    skv433(
      2022,
      'https://www.skatteverket.se/download/18.339cd9fe17d1714c0773ca7/1708607266874/Teknisk%20beskrivning%20SKV433%202022%20utg%2032.pdf',
    ),
  ],
}

const Y2023: PersonalRules = {
  ...Y2022,
  temporaryWorkReduction: null,
  year: 2023,
  pbb: 52_500,
  ibb: 74_300,
  // Förhöjt grundavdrag from 66; the higher in-work credit still from 65 (column 7).
  seniorAge: { allowance: 66, credit: 65 },
  state: { brackets: [{ threshold: 598_500, rate: 0.2 }] },
  inWorkCredit: {
    ...Y2022.inWorkCredit,
    senior: schedule('kr', [
      [100_000, 0, 0.22, 0],
      [300_000, 15_000, 0.07, 0],
      [600_000, 36_000, 0, 0],
      [null, 36_000, -0.03, 600_000],
    ]),
  },
  publicService: { rate: 0.01, capIbb: 1.75 },
  sources: [
    skv433(
      2023,
      'https://www.skatteverket.se/download/18.1997e70d1848dabbac94798/1708607267848/teknisk-beskrivning-skv433-2023-utgava-33.pdf',
    ),
  ],
}

const Y2024: PersonalRules = {
  ...Y2023,
  year: 2024,
  pbb: 57_300,
  ibb: 76_200,
  seniorAge: { allowance: 66, credit: 66 },
  state: { brackets: [{ threshold: 598_500, rate: 0.2 }] },
  raisedAllowance: schedule('pbb', [
    [0.91, 0.687, 0, 0],
    [1.11, 0.885, -0.2, 0],
    [1.965, 0.6, 0.057, 0],
    [2.72, 0.333, 0.1949, 0],
    [3.11, -0.212, 0.3949, 0],
    [3.24, -0.523, 0.4949, 0],
    [5.0, 0.208, 0.2693, 0],
    [7.88, 0.3, 0.2513, 0],
    [8.08, 0.986, 0.1643, 0],
    [10.74, 2.313, 0, 0],
    [12.16, 8.972, -0.62, 0],
    [13.54, 1.43, 0, 0],
    [38.42, 2.206, -0.0574, 0],
    [null, 0, 0, 0],
  ]),
  inWorkCredit: {
    young: schedule('pbb', [
      [0.91, 0, 1, 0],
      [3.24, 0.91, 0.3874, 0.91],
      [8.08, 1.813, 0.1643, 3.24],
      [null, 2.608, 0, 0],
    ]),
    phaseOut: { fromPbb: 13.54, rate: 0.03 },
    senior: schedule('pbb', [
      [1.75, 0, 0.22, 0],
      [5.24, 0.2635, 0.07, 0],
      [10.48, 0.6293, 0, 0],
      [null, 0.6293, -0.03, 10.48],
    ]),
  },
  publicService: { rate: 0.01, capIbb: 1.6 },
  sources: [
    skv433(
      2024,
      'https://www.skatteverket.se/download/18.7da1d2e118be03f8e4f2ef8/1708607268459/teknisk-beskrivning-SKV433-2024-utgava-34.pdf',
    ),
  ],
}

const Y2025: PersonalRules = {
  ...Y2024,
  year: 2025,
  pbb: 58_800,
  ibb: 80_600,
  state: { brackets: [{ threshold: 625_800, rate: 0.2 }] },
  raisedAllowance: schedule('pbb', [
    [0.91, 0.687, 0, 0],
    [1.11, 0.885, -0.2, 0],
    [1.965, 0.6, 0.057, 0],
    [2.72, 0.333, 0.1949, 0],
    [3.11, -0.212, 0.3949, 0],
    [3.24, -0.523, 0.4949, 0],
    [5.0, 0.096, 0.304, 0],
    [7.88, 0.186, 0.286, 0],
    [8.08, 0.872, 0.199, 0],
    [10.94, 2.48, 0, 0],
    [12.47, 9.263, -0.62, 0],
    [null, 1.532, 0, 0],
  ]),
  inWorkCredit: {
    young: schedule('pbb', [
      [0.91, 0, 1, 0],
      [3.24, 0.91, 0.3874, 0.91],
      [8.08, 1.813, 0.199, 3.24],
      [null, 2.776, 0, 0],
    ]),
    phaseOut: null,
    senior: schedule('pbb', [
      [1.75, 0, 0.22, 0],
      [5.24, 0.2635, 0.07, 0],
      [null, 0.6293, 0, 0],
    ]),
  },
  publicService: { rate: 0.01, capIbb: 1.55 },
  sources: [
    skv433(
      2025,
      'https://www.skatteverket.se/download/18.262c54c219391f2e9633edd/1734513198853/Teknisk%20beskrivning%20SKV433%202025%20utg%C3%A5va%2035.pdf',
    ),
  ],
}

/** VAT rates: food and restaurants at 12 % since 2012, until food drops to 6 % in April 2026. */
const VAT_2012: OtherRules['vat'] = [
  {
    rate: 25,
    examples: ['Most goods and services', 'De flesta varor och tjänster'],
  },
  {
    rate: 12,
    examples: ['Food, restaurants, hotels', 'Livsmedel, restaurang, hotell'],
  },
  {
    rate: 6,
    examples: [
      'Books, newspapers, passenger transport',
      'Böcker, tidningar, persontransporter',
    ],
  },
]

/** Kommunal fastighetsavgift, the cap for a small house (Skatteverket, "Kommunal
 * fastighetsavgift kalenderåren 2008 och 2016-2026"). */
const PROPERTY_FEE_CAP: Record<number, number> = {
  2016: 7_412,
  2017: 7_687,
  2018: 7_812,
  2019: 8_049,
  2020: 8_349,
  2021: 8_524,
  2022: 8_874,
  2023: 9_287,
  2024: 9_525,
  2025: 10_074,
}

/** Statslåneräntan at 30 November the year before, per cent (Skatteverket, "Belopp och
 * procent"): the ISK deemed income is this plus 0.75 points (2016-2017) or 1 point (from 2018),
 * at least 1.25 %. */
const STATE_LOAN_RATE: Record<number, number> = {
  2016: 0.65,
  2017: 0.27,
  2018: 0.49,
  2019: 0.51,
  2020: -0.09,
  2021: -0.1,
  2022: 0.23,
  2023: 1.94,
  2024: 2.62,
  2025: 1.96,
}

/** Employer and self-employment contribution bands per year (Skatteverket, "Belopp och procent"). */
const CONTRIBUTIONS: Record<
  number,
  { employer: ContributionBand[]; selfEmployed: ContributionBand[] }
> = {
  // Older people paid the special payroll tax (6.15 %), those born 1938 on also the old-age
  // pension contribution; young people's lower rate ended on 1 June 2016.
  2016: {
    employer: [
      band(null, 1937, 0.0615),
      band(1938, 1950, 0.1636),
      band(1991, null, 0.2546, 5),
    ],
    selfEmployed: [band(null, 1937, 0.0615), band(1938, 1950, 0.1636)],
  },
  2017: {
    employer: [band(null, 1937, 0.0615), band(1938, 1951, 0.1636)],
    selfEmployed: [band(null, 1937, 0.0615), band(1938, 1951, 0.1636)],
  },
  2018: {
    employer: [band(null, 1937, 0.0615), band(1938, 1952, 0.1636)],
    selfEmployed: [band(null, 1937, 0.0615), band(1938, 1952, 0.1636)],
  },
  // The special payroll tax for older people ended on 1 July 2019; the lower rate for
  // 15-18-year-olds began on 1 August.
  2019: {
    employer: [
      band(null, 1937, 0.0615, 6),
      band(null, 1937, 0, 6),
      band(1938, 1953, 0.1636, 6),
      band(1938, 1953, 0.1021, 6),
      band(2001, 2003, 0.1021, 5, 25_000),
    ],
    selfEmployed: [
      band(null, 1937, 0.0615, 6),
      band(null, 1937, 0, 6),
      band(1938, 1953, 0.1636, 6),
      band(1938, 1953, 0.1021, 6),
    ],
  },
  2020: {
    employer: [
      band(null, 1937, 0),
      band(1938, 1954, 0.1021),
      band(2002, 2004, 0.1021, 12, 25_000),
    ],
    selfEmployed: [band(null, 1937, 0), band(1938, 1954, 0.1021)],
  },
  // 19-23-year-olds: the old-age pension contribution only, in June-August 2021.
  2021: {
    employer: [
      band(null, 1937, 0),
      band(1938, 1955, 0.1021),
      band(2003, 2005, 0.1021, 12, 25_000),
      band(1998, 2002, 0.1021, 3, 25_000),
    ],
    selfEmployed: [band(null, 1937, 0), band(1938, 1955, 0.1021)],
  },
  // 19-23-year-olds: 19.73 % from January 2022 to March 2023, 10.21 % in June-August 2022.
  2022: {
    employer: [
      band(null, 1937, 0),
      band(1938, 1956, 0.1021),
      band(2004, 2006, 0.1021, 12, 25_000),
      band(1999, 2003, 0.1973, 9, 25_000),
      band(1999, 2003, 0.1021, 3, 25_000),
    ],
    selfEmployed: [band(null, 1937, 0), band(1938, 1956, 0.1021)],
  },
  2023: {
    employer: [
      band(null, 1937, 0),
      band(1938, 1956, 0.1021),
      band(2005, 2007, 0.1021, 12, 25_000),
      band(2000, 2004, 0.1973, 3, 25_000),
    ],
    selfEmployed: [band(null, 1937, 0), band(1938, 1956, 0.1021)],
  },
  2024: {
    employer: [band(null, 1937, 0), band(1938, 1957, 0.1021)],
    selfEmployed: [band(null, 1937, 0), band(1938, 1957, 0.1021)],
  },
  2025: {
    employer: [band(null, 1937, 0), band(1938, 1958, 0.1021)],
    selfEmployed: [band(null, 1937, 0), band(1938, 1958, 0.1021)],
  },
}

const AMOUNTS_URL =
  'https://www.skatteverket.se/privat/skatter/beloppochprocent.4.3a2a542410ab40a421c80006358.html'

function otherRules(year: number): OtherRules {
  const margin = year < 2018 ? 0.75 : 1
  return {
    capital: RULES_2026.capital,
    isk: {
      deemedRate: Math.max(STATE_LOAN_RATE[year] + margin, 1.25) / 100,
      taxFree: year >= 2025 ? 150_000 : 0,
    },
    propertyFee: { cap: PROPERTY_FEE_CAP[year], rate: 0.0075 },
    employer: { standard: 0.3142, bands: CONTRIBUTIONS[year].employer },
    selfEmployed: {
      standard: 0.2897,
      bands: CONTRIBUTIONS[year].selfEmployed,
    },
    vat: VAT_2012,
  }
}

const HISTORY: TaxRules[] = [
  Y2016,
  Y2017,
  Y2018,
  Y2019,
  Y2020,
  Y2021,
  Y2022,
  Y2023,
  Y2024,
  Y2025,
].map((rules) => ({
  ...rules,
  ...otherRules(rules.year),
  sources: [
    ...rules.sources,
    {
      label: `Skatteverket, Belopp och procent inkomstår ${rules.year}`,
      url: AMOUNTS_URL,
    },
  ],
}))

export const RULES: Record<number, TaxRules> = Object.fromEntries(
  [...HISTORY, RULES_2026].map((rules) => [rules.year, rules]),
)

export const LATEST_YEAR = Math.max(...Object.keys(RULES).map(Number))
