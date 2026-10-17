export type ArchiveStatus = 'saved' | 'upgraded' | 'relocated' | 'unchanged' | 'incomplete'

export interface RunSummary {
  trending_observed: number
  saved: number
  upgraded: number
  relocated: number
  unchanged: number
  incomplete: number
  eligible_not_archived: number
  rejected: number
  blockers: string[]
  archive_folder: string
}
export interface Featured {
  full_name: string
  url: string
  stars: number
  rating: number
  license: string
  reason: string
  ideas: string[]
}
export interface Archived {
  full_name: string
  url: string
  stars: number
  rating: number
  license: string
  commit_sha: string
  status: ArchiveStatus
  size_mb: number
  description: string
}
export interface Trending {
  rank: number
  full_name: string
  url: string
  stars: number
  stars_today: number
  language: string | null
  description: string
  decision: string
  decision_reason: string
}
export interface NewsItem {
  title: string
  url: string
  source: string
  points?: number | null
  comments?: number | null
  comments_url?: string | null
  published_at: string
  tags: string[]
  summary?: string
}
export interface Highlight {
  title: string
  url: string
  why_it_matters: string
}
export interface DailyReport {
  sample?: boolean
  generated_at: string
  date: string
  run: RunSummary
  featured: Featured[]
  archived: Archived[]
  trending: Trending[]
  news: NewsItem[]
  news_highlights: Highlight[]
}
export interface HistoryEntry {
  date: string
  featured: string[]
  archived_count: number
}
