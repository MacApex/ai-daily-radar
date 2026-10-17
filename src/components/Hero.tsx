import { motion, useScroll, useTransform } from 'framer-motion'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { DailyReport } from '../lib/types'
import { fmtDateTime, fmtLongDate } from '../lib/format'
import { hasWebGL, useMedia, useReducedMotion } from '../lib/hooks'
import { Clock, Sparkle } from './Icons'

const HeroScene = lazy(() => import('../three/HeroScene'))

function Fallback() {
  return <div aria-hidden className="fallback-orbs absolute inset-0" />
}

export function Hero({ data, theme, viewingHistory }: { data: DailyReport; theme: 'dark' | 'light'; viewingHistory: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const mobile = useMedia('(max-width: 767px)')
  const [webgl] = useState(hasWebGL)
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState(true)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const fade = useTransform(scrollYProgress, [0, 0.9], [1, 0])
  const lift = useTransform(scrollYProgress, [0, 1], [0, -60])

  useEffect(() => {
    // defer the heavy 3D chunk until the browser is idle after first paint
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    const go = () => setReady(true)
    if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 1200 })
    else setTimeout(go, 300)
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting && !document.hidden), { threshold: 0 })
    io.observe(el)
    const vis = () => setActive(!document.hidden && el.getBoundingClientRect().bottom > 0)
    document.addEventListener('visibilitychange', vis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis) }
  }, [])

  const r = data.run
  const archived = r.saved + r.upgraded + r.relocated + r.unchanged + r.incomplete
  const words = ["Today's", 'radar']
  const show3D = webgl && !reduced && ready

  return (
    <section ref={ref} id="top" className="relative isolate flex min-h-[80svh] items-end overflow-hidden pb-12 pt-32 sm:min-h-[88vh] sm:items-center sm:pb-20">
      <motion.div className="absolute inset-0 -z-10" style={{ opacity: fade }}>
        <Fallback />
        {show3D && (
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6 }}>
            <Suspense fallback={null}>
              <HeroScene theme={theme} mobile={mobile} active={active} picks={data.featured.length} />
            </Suspense>
          </motion.div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[var(--bg)]" />
      </motion.div>

      <motion.div className="page" style={reduced ? undefined : { y: lift }}>
        <div className="max-w-[640px]">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 flex flex-wrap items-center gap-2">
            <span className="chip border-accent/40 bg-accent/10 text-fg">
              <Sparkle className="text-accent" width={13} height={13} />
              {viewingHistory ? 'Archive view' : 'Daily briefing'}
            </span>
            {data.sample && <span className="chip border-amber/50 bg-amber/10 font-mono text-amber">SAMPLE DATA</span>}
          </motion.div>
          <p className="mb-3 font-mono text-[13px] text-muted">{fmtLongDate(data.date)}</p>
          <h1 className="font-display text-[48px] font-bold leading-[0.95] tracking-[-0.045em] sm:text-[72px] lg:text-[92px]">
            {words.map((w, i) => (
              <motion.span key={w} className={`mr-[0.22em] inline-block ${i === 1 ? 'text-grad' : ''}`}
                initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.1 + i * 0.09, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}
            className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-muted sm:text-[18px]">
            <span className="text-fg">{r.trending_observed}</span> trending repos scanned, <span className="text-fg">{archived}</span> archived,{' '}
            <span className="text-fg">{data.featured.length}</span> {data.featured.length === 1 ? 'pick' : 'picks'} worth your time, plus{' '}
            <span className="text-fg">{data.news.length}</span> stories from the tech wire.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }} className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#picks" className="group inline-flex items-center gap-2 rounded-full bg-fg px-5 py-3 text-[14px] font-semibold text-bg transition hover:shadow-[0_8px_30px_-8px_var(--accent)] active:scale-[.97]">
              See today's picks
              <span className="transition-transform group-hover:translate-y-0.5">↓</span>
            </a>
            <span className="inline-flex items-center gap-2 text-[13px] text-muted">
              <Clock width={14} height={14} /> Last updated {fmtDateTime(data.generated_at)}
            </span>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
