/** The shape of parliament/news.json: headlines from SVT, Ekot and the Government Offices. */
export type NewsItem = {
  id: string
  source: 'svt' | 'ekot' | 'regeringen'
  title: string
  summary: string | null
  url: string
  published_at: string
  parties: string[]
  topics: string[]
}
export type News = {
  generated_at: string
  days: number
  collected_since: string | null
  sources: Record<
    string,
    {
      name: string
      url: string | null
      last_fetch: string | null
      last_success: string | null
      last_status: number | null
      last_error: string | null
    }
  >
  topics: { key: string; name_sv: string; name_en: string }[]
  party_counts_30d: Record<string, number>
  items: NewsItem[]
  method: string
}
