import { motion } from 'framer-motion'
import { GlassBg } from './glass'
import type { HistoryEntry } from '../lib/types'
import { fmtShortDate } from '../lib/format'
import { EmptyState, Reveal, SectionHeader } from './ui'
import { Calendar } from './Icons'

export function History({ entries, current, latestDate, onPick, loading }: { entries: HistoryEntry[]; current: string; latestDate: string; onPick: (d: string) => void; loading: string | null }) {
  const dates = entries.map((e) => e.date)
  const min = dates[dates.length - 1]
  const max = dates[0]
  const maxCount = Math.max(1, ...entries.map((e) => e.archived_count))
  return (
    <section aria-labelledby="history" className="page pt-20 sm:pt-28">
      <SectionHeader id="history" eyebrow="05 · History" title="Past radars">
        {entries.length > 0 && (
          <label className="relative inline-flex items-center gap-2">
            <span className="sr-only">Pick a date</span>
            <Calendar className="pointer-events-none absolute left-3 text-muted" />
            <input type="date" className="input w-auto pl-9 font-mono text-[13px]" min={min} max={max} value={current}
              onChange={(e) => { const d = e.target.value; if (dates.includes(d)) onPick(d) }} />
          </label>
        )}
      </SectionHeader>
      {entries.length === 0 ? <EmptyState title="No history yet." hint="Each daily run adds an entry here." /> : (
        <Reveal className="frost p-4 sm:p-6"><GlassBg />
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            <ol className="relative flex min-w-max gap-3 pb-1">
              {entries.map((e) => {
                const sel = e.date === current
                return (
                  <li key={e.date}>
                    <button type="button" onClick={() => onPick(e.date)} aria-pressed={sel}
                      className={`relative flex w-[230px] flex-col items-start gap-3 rounded-2xl border p-4 text-left transition ${sel ? 'border-accent/60 bg-accent/10' : 'border-line hover:bg-[var(--panel-hi)]'}`}>
                      {sel && <motion.span layoutId="hist-sel" className="absolute inset-x-4 -top-px h-px bg-gradient-to-r from-transparent via-accent to-transparent" />}
                      <div className="flex w-full items-center justify-between">
                        <span className="font-display text-[20px] font-semibold tracking-[-0.02em]">{fmtShortDate(e.date)}</span>
                        <span className="flex items-end gap-0.5" aria-label={`${e.archived_count} archived`}>
                          {Array.from({ length: maxCount }, (_, i) => (
                            <span key={i} className={`w-1.5 rounded-full ${i < e.archived_count ? 'bg-mint' : 'bg-[var(--panel-hi)]'}`} style={{ height: 6 + i * 3 }} />
                          ))}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-muted">{e.date}{e.date === latestDate ? ' · latest' : ''}</span>
                      <ul className="w-full space-y-1 text-[12.5px]">
                        {e.featured.length === 0 ? <li className="text-muted">No picks</li> : e.featured.map((f) => <li key={f} className="truncate"><span className="text-accent">★</span> {f}</li>)}
                      </ul>
                      {loading === e.date && <span className="text-[11px] text-accent">Loading…</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
          {entries.length < 3 && <p className="mt-4 text-[13px] text-muted">The timeline grows by one card each morning as the daily job publishes.</p>}
        </Reveal>
      )}
    </section>
  )
}
