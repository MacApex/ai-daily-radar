import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { LiquidButton, GlassBg } from './glass'
import { useState } from 'react'
import { fmtTime } from '../lib/format'
import { Moon, Sun } from './Icons'

export const NAV = [
  { id: 'picks', label: 'Picks' },
  { id: 'archive', label: 'Archive' },
  { id: 'trending', label: 'Trending' },
  { id: 'news', label: 'News' },
  { id: 'history', label: 'History' },
]

export function TopBar({ theme, onTheme, active, updated }: { theme: 'dark' | 'light'; onTheme: () => void; active: string; updated?: string }) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 40))
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-[var(--bg)] via-[var(--bg)]/70 to-transparent transition-opacity duration-300 md:hidden ${scrolled ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`mx-auto flex h-14 max-w-page items-center gap-2 rounded-2xl border px-3 transition-all duration-300 sm:px-4 ${
          scrolled ? 'frost !rounded-2xl' : 'border-transparent'
        }`}
      >
        {scrolled && <GlassBg radius={16} />}
        <a href="#top" className="flex items-center gap-2.5 pr-2" aria-label="AI Daily Radar, back to top">
          <span className="relative grid h-7 w-7 place-items-center">
            <span className="radar-ping absolute inset-1 rounded-full bg-accent/40" />
            <span className="absolute inset-0 rounded-full border border-accent/50" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-gradient-to-br from-accent to-mint" />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">
            AI Daily Radar
          </span>
        </a>
        <nav aria-label="Sections" className="no-scrollbar ml-auto hidden overflow-x-auto md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} className={`relative block rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${active === n.id ? 'text-fg' : 'text-muted hover:text-fg'}`} aria-current={active === n.id ? 'true' : undefined}>
                  {active === n.id && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full border border-line bg-[var(--panel-hi)]" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {updated && (
          <span className="chip ml-auto hidden text-muted sm:inline-flex md:ml-2" title="Last updated (Asia/Shanghai)">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            Updated {fmtTime(updated)} CST
          </span>
        )}
        <LiquidButton radius={12} className="ml-auto shrink-0 sm:ml-2">
        <button
          type="button" onClick={onTheme}
          className="glass-btn grid h-9 w-9 shrink-0 place-items-center rounded-xl text-fg transition hover:bg-[var(--panel-hi)] active:scale-95"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={theme} initial={{ rotate: -90, scale: 0.4, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0.4, opacity: 0 }} transition={{ duration: 0.25 }}>
              {theme === 'dark' ? <Sun /> : <Moon />}
            </motion.span>
          </AnimatePresence>
        </button>
        </LiquidButton>
      </div>
      {/* mobile section nav */}
      <nav aria-label="Sections (mobile)" className="no-scrollbar mx-auto mt-2 flex max-w-page gap-1.5 overflow-x-auto md:hidden">
        {NAV.map((n) => (
          <LiquidButton key={n.id} className="shrink-0"><a href={`#${n.id}`} className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium glass-btn transition ${active === n.id ? '!border-accent/50 !bg-[color-mix(in_srgb,var(--accent)_30%,var(--surface))] text-fg' : '!bg-[var(--surface)] text-fg/80'}`}>
            {n.label}
          </a></LiquidButton>
        ))}
      </nav>
    </header>
  )
}
