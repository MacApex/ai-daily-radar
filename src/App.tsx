import { Backdrop } from './components/Backdrop'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DailyReport, HistoryEntry } from './lib/types'
import { loadDay, loadHistory, loadLatest } from './lib/data'
import { fmtDateTime, fmtLongDate } from './lib/format'
import { useActiveSection, useTheme } from './lib/hooks'
import { useFreshness } from './lib/freshness'
import { NAV, TopBar } from './components/TopBar'
import { Hero } from './components/Hero'
import { RunSummary } from './components/RunSummary'
import { Featured } from './components/Featured'
import { Archived } from './components/Archived'
import { Trending } from './components/Trending'
import { News } from './components/News'
import { History } from './components/History'
import { Github } from './components/Icons'
import { LiquidButton } from './components/glass'

const IDS = NAV.map((n) => n.id)
const NONE: string[] = []

function Sections({ data, latest, history, onPick, loading, theme }: { data: DailyReport; latest: DailyReport; history: HistoryEntry[]; onPick: (d: string) => void; loading: string | null; theme: 'dark' | 'light' }) {
  const now = useMemo(() => Math.max(new Date(data.generated_at).getTime() || 0, ...data.news.map((n) => new Date(n.published_at).getTime() || 0)) || Date.now(), [data])
  const viewing = data.date !== latest.date
  return (
    <>
      <Hero data={data} theme={theme} viewingHistory={viewing} />
      <AnimatePresence>
        {viewing && (
          <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center justify-between gap-3 frost !rounded-2xl !border-accent/40 px-4 py-3 text-[13px]">
            <span>Viewing <b className="font-mono">{data.date}</b></span>
            <LiquidButton><button type="button" onClick={() => onPick(latest.date)} className="glass-btn rounded-full px-3 py-1.5 font-sans text-[13px] font-semibold leading-none text-fg">Back to latest →</button></LiquidButton>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div key={data.date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <RunSummary run={data.run} />
        <Featured items={data.featured} />
        <Archived items={data.archived} />
        <Trending items={data.trending} />
        <News items={data.news} highlights={data.news_highlights} now={now} />
      </motion.div>
      <History entries={history} current={data.date} latestDate={latest.date} onPick={onPick} loading={loading} />
    </>
  )
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [latest, setLatest] = useState<DailyReport | null>(null)
  const [view, setView] = useState<DailyReport | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    loadLatest().then((d) => { setLatest(d); setView(d) }).catch((e) => setError(String(e.message ?? e)))
    loadHistory().then(setHistory)
  }, [])

  // Long-lived tabs and the Android app's WebView: pick up a newer latest.json without a reload.
  const [toast, setToast] = useState<string | null>(null)
  useFreshness(async () => {
    const d = await loadLatest()
    if (latest && d.date === latest.date && d.generated_at === latest.generated_at) return
    const prev = latest
    setLatest(d)
    setError(null)
    setView((v) => (!v || !prev || v.date === prev.date ? d : v))
    loadHistory().then(setHistory)
    if (prev) setToast(d.date !== prev.date ? `Updated to ${d.date}` : 'Updated')
  })
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(id)
  }, [toast])

  const active = useActiveSection(view ? IDS : NONE, view?.date)

  const pick = useCallback((date: string) => {
    if (!latest) return
    if (date === latest.date) { setView(latest); return }
    setLoading(date)
    loadDay(date)
      .then((d) => { setView(d); window.scrollTo({ top: 0, behavior: 'smooth' }) })
      .catch(() => alert(`Couldn't load ${date}.`))
      .finally(() => setLoading(null))
  }, [latest])

  // keep the URL shareable: ?date=YYYY-MM-DD
  useEffect(() => {
    if (!latest) return
    const d = new URLSearchParams(location.search).get('date')
    if (d && d !== latest.date && /^\d{4}-\d{2}-\d{2}$/.test(d)) pick(d)
  }, [latest, pick])
  useEffect(() => {
    if (!view || !latest) return
    const url = new URL(location.href)
    if (view.date === latest.date) url.searchParams.delete('date'); else url.searchParams.set('date', view.date)
    history.length && window.history.replaceState(null, '', url)
  }, [view, latest, history.length])

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only z-[70] rounded-lg bg-fg px-3 py-2 text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <div className="ambient" aria-hidden />
      <Backdrop theme={theme} picks={view?.featured.length ?? 0} />
      <div className="grain" aria-hidden />
      <TopBar theme={theme} onTheme={toggleTheme} active={active} updated={latest?.generated_at} />
      <main id="main">
        {error ? (
          <div className="page grid min-h-[80vh] place-items-center pt-24 text-center">
            <div className="frost max-w-md p-8">
              <p className="font-display text-xl font-semibold">Couldn't load today's data</p>
              <p className="mt-2 text-sm text-muted">{error}. The daily job may still be publishing; try again in a minute.</p>
              <button type="button" className="pill mx-auto mt-5" onClick={() => location.reload()}>Retry</button>
            </div>
          </div>
        ) : !view || !latest ? (
          <div className="page min-h-[90vh] pt-36" aria-busy="true" aria-label="Loading">
            <div className="h-4 w-48 animate-pulse rounded bg-[var(--panel-hi)]" />
            <div className="mt-5 h-20 w-80 max-w-full animate-pulse rounded-xl bg-[var(--panel-hi)]" />
            <div className="mt-4 h-5 w-96 max-w-full animate-pulse rounded bg-[var(--panel-hi)]" />
          </div>
        ) : (
          <Sections data={view} latest={latest} history={history} onPick={pick} loading={loading} theme={theme} />
        )}
      </main>
      <AnimatePresence>
        {toast && (
          <motion.div role="status" initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }}
            className="fixed inset-x-0 top-20 z-50 mx-auto w-fit frost !rounded-full !border-accent/40 px-4 py-1.5 text-[12px] font-medium text-fg">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="page mt-24 pb-8 text-[13px] text-muted">
        <div className="frost flex p-6 sm:p-8 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-[15px] font-semibold text-fg">AI Daily Radar</p>
            <p className="mt-1">{view ? <>Report for {fmtLongDate(view.date)} · generated {fmtDateTime(view.generated_at)} (Asia/Shanghai)</> : 'Static dashboard, refreshed daily around 10:00 CST.'}</p>
          </div>
          <div className="flex items-center gap-4">
            <a className="glass-btn rounded-full px-3 py-1.5 text-fg" href={`${import.meta.env.BASE_URL}data/latest.json`}>latest.json</a>
            <a className="glass-btn inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-fg" href="https://github.com/MacApex/ai-daily-radar" target="_blank" rel="noreferrer"><Github /> Source</a>
          </div>
        </div>
      </footer>
    </MotionConfig>
  )
}
