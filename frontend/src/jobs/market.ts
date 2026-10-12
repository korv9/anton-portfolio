type YearValues = Record<string, number>
type Conditions = {
  employment: Record<string, number>
  hours: Record<string, number>
  experience: Record<string, number>
}
export type Market = {
  generated_at: string
  years: number[]
  latest_year: number
  ytd_months: number
  last_month: string
  fields: { id: string; name: string; groups: number }[]
  monthly: Record<string, [string, number, number][]>
  occupations: {
    id: string
    ssyk: string | null
    name: string
    field: string
    ads: YearValues
    ytd: YearValues
  }[]
  regions: {
    region: string
    ads: Record<string, YearValues>
    ytd: Record<string, YearValues>
  }[]
  conditions: Record<string, Record<string, Conditions>>
  archives: {
    archive: string
    source_url: string
    sha256: string
    ads: number
  }[]
  /** New ads per publication day and field ('all' for every field), from JobTech's daily
   * stream: only the days it has read whole. Preliminary until the quarter's archive. */
  daily?: Record<string, [string, number, number][]>
  /** Months counted from the daily stream rather than an archive. */
  preliminary?: string[]
  method: string
}

/** English names for the occupation fields (Arbetsförmedlingen's taxonomy). */
export const FIELD_EN: Record<string, string> = {
  'Administration, ekonomi, juridik': 'Administration, finance, law',
  'Bygg och anläggning': 'Construction',
  'Chefer och verksamhetsledare': 'Managers',
  'Data/IT': 'Data/IT',
  'Försäljning, inköp, marknadsföring': 'Sales, purchasing, marketing',
  Hantverk: 'Crafts',
  'Hotell, restaurang, storhushåll': 'Hotels, restaurants, catering',
  'Hälso- och sjukvård': 'Health care',
  'Industriell tillverkning': 'Manufacturing',
  'Installation, drift, underhåll': 'Installation, operation, maintenance',
  'Kropps- och skönhetsvård': 'Beauty and body care',
  'Kultur, media, design': 'Culture, media, design',
  'Militära yrken': 'Military',
  Naturbruk: 'Agriculture, forestry, fishing',
  Naturvetenskap: 'Natural sciences',
  Pedagogik: 'Education',
  'Sanering och renhållning': 'Cleaning and sanitation',
  'Säkerhet och bevakning': 'Security',
  'Transport, distribution, lager': 'Transport, distribution, warehousing',
  'Yrken med social inriktning': 'Social work',
  'Yrken med teknisk inriktning': 'Engineering and technical work',
}

export const EMPLOYMENT_EN: Record<string, string> = {
  'Vanlig anställning': 'Regular employment',
  Behovsanställning: 'On-call employment',
  'Sommarjobb / feriejobb': 'Summer job',
  'Arbete utomlands': 'Work abroad',
  Okänd: 'Not stated',
}
export const HOURS_EN: Record<string, string> = {
  Heltid: 'Full time',
  Deltid: 'Part time',
  Okänd: 'Not stated',
}
