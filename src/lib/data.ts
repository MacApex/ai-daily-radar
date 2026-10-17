import type { DailyReport, HistoryEntry } from './types'

const BASE = import.meta.env.BASE_URL + 'data/'

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Defensive normalisation so a partially-filled file from the daily job never crashes the UI. */
export function normalize(raw: Partial<DailyReport>): DailyReport {
  const run = (raw.run ?? {}) as Partial<DailyReport['run']>
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0)
  return {
    sample: !!raw.sample,
    generated_at: raw.generated_at ?? '',
    date: raw.date ?? '',
    run: {
      trending_observed: n(run.trending_observed),
      saved: n(run.saved),
      upgraded: n(run.upgraded),
      relocated: n(run.relocated),
      unchanged: n(run.unchanged),
      incomplete: n(run.incomplete),
      eligible_not_archived: n(run.eligible_not_archived),
      rejected: n(run.rejected),
      blockers: arr<string>(run.blockers),
      archive_folder: run.archive_folder ?? '',
    },
    featured: arr<DailyReport['featured'][number]>(raw.featured).slice(0, 3).map((f) => ({ ...f, ideas: arr<string>(f.ideas) })),
    archived: arr<DailyReport['archived'][number]>(raw.archived).slice(0, 5),
    trending: arr<DailyReport['trending'][number]>(raw.trending),
    news: arr<DailyReport['news'][number]>(raw.news).map((x) => ({ ...x, tags: arr<string>(x.tags) })),
    news_highlights: arr<DailyReport['news_highlights'][number]>(raw.news_highlights),
  }
}

export const loadLatest = () => getJSON<Partial<DailyReport>>('latest.json').then(normalize)
export const loadDay = (date: string) => getJSON<Partial<DailyReport>>(`history/${date}.json`).then(normalize)
export const loadHistory = () =>
  getJSON<HistoryEntry[]>('history/index.json')
    .then((h) => arr<HistoryEntry>(h).sort((a, b) => b.date.localeCompare(a.date)))
    .catch(() => [] as HistoryEntry[])
