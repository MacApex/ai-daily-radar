import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { Highlight, NewsItem } from '../lib/types'
import { hostOf, relTime } from '../lib/format'
import { EmptyState, Reveal, SectionHeader, fadeUp, stagger } from './ui'
import { Arrow, Comment, Search, Sparkle, Up } from './Icons'

const SRC_COLOR: Record<string, string> = {
  'Hacker News': '#ff7a3d', Lobsters: '#d8453f', 'DEV.to': '#8b8fa3', 'Simon Willison': '#3ea8ff',
  'Hugging Face': '#ffbf1f', 'GitHub Blog': '#a371f7',
}

export function News({ items, highlights, now }: { items: NewsItem[]; highlights: Highlight[]; now: number }) {
  const [q, setQ] = useState('')
  const [src, setSrc] = useState('all')
  const [tags, setTags] = useState<string[]>([])
  const [limit, setLimit] = useState(14)
  const [allTagsOpen, setAllTagsOpen] = useState(false)
  const sources = useMemo(() => Array.from(new Set(items.map((n) => n.source))), [items])
  const allTags = useMemo(() => {
    const c = new Map<string, number>()
    items.forEach((n) => n.tags.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)))
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ t, n }))
  }, [items])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items
      .filter((n) => src === 'all' || n.source === src)
      .filter((n) => tags.length === 0 || tags.some((t) => n.tags.includes(t)))
      .filter((n) => !s || `${n.title} ${n.summary ?? ''} ${n.tags.join(' ')} ${hostOf(n.url)}`.toLowerCase().includes(s))
  }, [items, q, src, tags])
  const toggleTag = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))

  return (
    <section aria-labelledby="news" className="page pt-20 sm:pt-28">
      <SectionHeader id="news" eyebrow="04 · Tech news" title="Off the wire">
        <p className="max-w-sm text-[14px] text-muted">Hacker News, Lobsters, DEV.to and AI/dev blogs, ranked by votes and freshness.</p>
      </SectionHeader>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        {/* highlights rail */}
        <motion.aside aria-label="News highlights" className="lg:order-2 lg:col-span-4" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={stagger(0.08)}>
          <div className="frost frost-hi relative overflow-hidden p-5 lg:sticky lg:top-24">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/25 blur-3xl" />
            <p className="eyebrow mb-4 flex items-center gap-2"><Sparkle width={13} height={13} className="text-accent" /> Why it matters</p>
            {highlights.length === 0 ? <p className="text-sm text-muted">No highlights picked today.</p> : (
              <ol className="space-y-5">
                {highlights.map((h, i) => (
                  <motion.li key={h.url + i} variants={fadeUp} className="relative pl-8">
                    <span className="absolute left-0 top-0.5 font-display text-[15px] font-semibold text-accent">{String(i + 1).padStart(2, '0')}</span>
                    <a href={h.url} target="_blank" rel="noreferrer" className="link-u font-medium leading-snug">{h.title}</a>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{h.why_it_matters}</p>
                  </motion.li>
                ))}
              </ol>
            )}
          </div>
        </motion.aside>

        {/* list */}
        <Reveal className="frost overflow-hidden lg:order-1 lg:col-span-8">
          <div className="space-y-3 border-b border-line p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <label className="relative">
                <span className="sr-only">Search news</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-9" placeholder="Search headlines, domains, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by source">
                {['all', ...sources].map((s) => (
                  <button key={s} type="button" className="pill" aria-pressed={src === s} onClick={() => setSrc(s)}>
                    {s !== 'all' && <span className="h-2 w-2 rounded-full" style={{ background: SRC_COLOR[s] ?? 'var(--accent)' }} />}
                    {s === 'all' ? 'All sources' : s}
                  </button>
                ))}
              </div>
            </div>
            <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by tag">
              {(allTagsOpen ? allTags : allTags.slice(0, 9)).map(({ t, n }) => (
                <button key={t} type="button" className="pill !px-3 !py-1.5 !text-[12px]" aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>
                  #{t} <span className="font-mono text-[10px] opacity-60">{n}</span>
                </button>
              ))}
              {allTags.length > 9 && <button type="button" className="shrink-0 px-2 text-[12px] font-medium text-muted hover:text-fg" onClick={() => setAllTagsOpen((o) => !o)} aria-expanded={allTagsOpen}>{allTagsOpen ? 'Fewer tags' : `+${allTags.length - 9} tags`}</button>}
              {tags.length > 0 && <button type="button" className="shrink-0 px-2 text-[12px] font-medium text-accent" onClick={() => setTags([])}>Clear</button>}
            </div>
          </div>
          {items.length === 0 ? <div className="p-4"><EmptyState title="No news collected today." /></div> : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">No stories match. Try another tag or clear the search.</p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {rows.slice(0, limit).map((n) => (
                  <motion.li key={n.source + n.url + n.title} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                    className="group border-b border-line px-4 py-4 transition-colors last:border-0 hover:bg-[var(--panel-hi)] sm:px-5">
                    <div className="flex gap-4">
                      <div className="hidden w-12 shrink-0 flex-col items-center pt-0.5 sm:flex">
                        <Up width={13} height={13} className="text-muted" />
                        <span className="font-display text-[17px] font-semibold tabular-nums">{n.points ?? '—'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <a href={n.url} target="_blank" rel="noreferrer" className="font-medium leading-snug decoration-accent/60 underline-offset-4 group-hover:underline">
                          {n.title}
                          <Arrow width={13} height={13} className="ml-1 inline align-baseline text-muted opacity-0 transition group-hover:opacity-100" />
                        </a>
                        {n.summary && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{n.summary}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted">
                          <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: SRC_COLOR[n.source] }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SRC_COLOR[n.source] ?? 'var(--accent)' }} />{n.source}
                          </span>
                          {hostOf(n.url) && <span className="font-mono">{hostOf(n.url)}</span>}
                          <span className="sm:hidden">▲ {n.points ?? 0}</span>
                          {n.comments != null && (n.comments_url ? (
                            <a href={n.comments_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg"><Comment width={12} height={12} />{n.comments}</a>
                          ) : <span className="inline-flex items-center gap-1"><Comment width={12} height={12} />{n.comments}</span>)}
                          <span>{relTime(n.published_at, now)}</span>
                          {n.tags.slice(0, 3).map((t) => <span key={t} className="text-muted/80">#{t}</span>)}
                        </div>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          {rows.length > limit && (
            <div className="border-t border-line p-3 text-center">
              <button type="button" onClick={() => setLimit((l) => l + 20)} className="pill mx-auto">Show {Math.min(20, rows.length - limit)} more · {rows.length - limit} left</button>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  )
}
