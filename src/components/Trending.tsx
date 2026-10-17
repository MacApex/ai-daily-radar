import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { Trending as T } from '../lib/types'
import { fmtNum } from '../lib/format'
import { Badge, EmptyState, Lang, SectionHeader, Reveal } from './ui'
import { Chevron, Search, Star, Up } from './Icons'

type Key = 'rank' | 'stars' | 'stars_today' | 'full_name'
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'archived', label: 'Archived' },
  { id: 'eligible_not_archived', label: 'Eligible' },
  { id: 'rejected', label: 'Rejected' },
]

export function Trending({ items }: { items: T[] }) {
  const [q, setQ] = useState('')
  const [dec, setDec] = useState('all')
  const [lang, setLang] = useState('all')
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: 'rank', dir: 1 })
  const langs = useMemo(() => Array.from(new Set(items.map((t) => t.language).filter(Boolean))) as string[], [items])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    items.forEach((t) => { c[t.decision] = (c[t.decision] ?? 0) + 1 })
    return c
  }, [items])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items
      .filter((t) => dec === 'all' || t.decision === dec)
      .filter((t) => lang === 'all' || t.language === lang)
      .filter((t) => !s || `${t.full_name} ${t.description} ${t.decision_reason}`.toLowerCase().includes(s))
      .sort((a, b) => {
        const av = a[sort.k], bv = b[sort.k]
        return (typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir
      })
  }, [items, q, dec, lang, sort])
  const maxToday = Math.max(1, ...items.map((t) => t.stars_today))

  const setKey = (k: Key) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: k === 'rank' || k === 'full_name' ? 1 : -1 }))
  const th = ({ k, label, className = '' }: { k: Key; label: string; className?: string }) => (
    <th key={k} scope="col" aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`px-3 py-3 font-medium ${className}`}>
      <button type="button" onClick={() => setKey(k)} className={`inline-flex items-center gap-1 rounded-md transition hover:text-fg ${sort.k === k ? 'text-fg' : ''}`}>
        {label}
        <Up width={12} height={12} className={`transition-all ${sort.k === k ? 'opacity-100' : 'opacity-0'} ${sort.dir === -1 ? 'rotate-180' : ''}`} />
      </button>
    </th>
  )

  return (
    <section aria-labelledby="trending" className="page pt-20 sm:pt-28">
      <SectionHeader id="trending" eyebrow="03 · Full trending" title="Everything the scan saw">
        <p className="max-w-sm text-[14px] text-muted">Every repo observed on GitHub Trending today, with the decision and why.</p>
      </SectionHeader>
      {items.length === 0 ? <EmptyState title="No trending data for this day." /> : (
        <Reveal className="glass overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4 lg:flex-row lg:items-center">
            <label className="relative flex-1 lg:max-w-xs">
              <span className="sr-only">Search trending repos</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input pl-9" placeholder="Search repos…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="group" aria-label="Filter by decision">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className="pill" aria-pressed={dec === f.id} onClick={() => setDec(f.id)}>
                  {f.label} <span className="font-mono text-[11px] opacity-70">{counts[f.id] ?? 0}</span>
                </button>
              ))}
            </div>
            <label className="relative lg:ml-auto">
              <span className="sr-only">Filter by language</span>
              <select className="input appearance-none pr-9 lg:w-44" value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="all">All languages</option>
                {langs.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <Chevron className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            </label>
          </div>

          {/* desktop / tablet table */}
          <div className="hidden md:block">
            <table className="w-full text-left text-[14px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  {th({ k: 'rank', label: '#', className: 'w-14 pl-5' })}
                  {th({ k: 'full_name', label: 'Repository' })}
                  <th scope="col" className="hidden px-3 py-3 font-medium xl:table-cell">Language</th>
                  {th({ k: 'stars', label: 'Stars', className: 'text-right' })}
                  {th({ k: 'stars_today', label: 'Today', className: 'w-40' })}
                  <th scope="col" className="px-3 py-3 pr-5 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((t) => (
                    <motion.tr key={t.full_name} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                      className="border-b border-line align-top transition-colors last:border-0 hover:bg-[var(--panel-hi)]">
                      <td className="py-4 pl-5 pr-3 font-mono text-[13px] text-muted">{t.rank}</td>
                      <td className="max-w-[440px] px-3 py-4">
                        <a href={t.url} target="_blank" rel="noreferrer" className="link-u font-medium">{t.full_name}</a>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{t.description || 'No description.'}</p>
                      </td>
                      <td className="hidden px-3 py-4 text-[13px] xl:table-cell"><Lang name={t.language} /></td>
                      <td className="px-3 py-4 text-right tabular-nums">{fmtNum(t.stars)}</td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-right font-mono text-[12px] tabular-nums text-amber">+{fmtNum(t.stars_today)}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel-hi)]">
                            <motion.span className="block h-full rounded-full bg-gradient-to-r from-amber to-accent" initial={{ width: 0 }} whileInView={{ width: `${(100 * t.stars_today) / maxToday}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} />
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[300px] px-3 py-4 pr-5">
                        <Badge status={t.decision} />
                        <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{t.decision_reason}</p>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="md:hidden">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2.5 text-[12px] text-muted" role="group" aria-label="Sort by">
              <span className="self-center pr-1">Sort</span>
              {([['rank', 'Rank'], ['stars_today', 'Today'], ['stars', 'Stars'], ['full_name', 'Name']] as [Key, string][]).map(([k, l]) => (
                <button key={k} type="button" className="pill !py-1.5" aria-pressed={sort.k === k} onClick={() => setKey(k)}>
                  {l}{sort.k === k && <Up width={11} height={11} className={sort.dir === -1 ? 'rotate-180' : ''} />}
                </button>
              ))}
            </div>
            <ul>
              <AnimatePresence initial={false}>
                {rows.map((t) => (
                  <motion.li key={t.full_name} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-line p-4 last:border-0">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 w-6 shrink-0 font-mono text-[12px] text-muted">{t.rank}</span>
                      <div className="min-w-0 flex-1">
                        <a href={t.url} target="_blank" rel="noreferrer" className="block break-words font-medium">{t.full_name}</a>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{t.description || 'No description.'}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
                          <Lang name={t.language} />
                          <span className="inline-flex items-center gap-1 tabular-nums text-muted"><Star width={11} height={11} />{fmtNum(t.stars)}</span>
                          <span className="font-mono tabular-nums text-amber">+{fmtNum(t.stars_today)} today</span>
                        </div>
                        <div className="mt-2.5 flex flex-col items-start gap-1.5">
                          <Badge status={t.decision} />
                          <p className="text-[12.5px] leading-snug text-muted">{t.decision_reason}</p>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
          {rows.length === 0 && <p className="p-8 text-center text-sm text-muted">No repos match these filters.</p>}
        </Reveal>
      )}
    </section>
  )
}
