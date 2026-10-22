import { motion, useScroll, useTransform } from 'framer-motion'
import { GlassBg, LiquidButton } from './glass'
import { useRef } from 'react'
import type { DailyReport } from '../lib/types'
import { fmtDateTime, fmtLongDate } from '../lib/format'
import { useReducedMotion } from '../lib/hooks'
import { Clock, Sparkle } from './Icons'


export function Hero({ data, theme, viewingHistory }: { data: DailyReport; theme: 'dark' | 'light'; viewingHistory: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const lift = useTransform(scrollYProgress, [0, 1], [0, -60])

  const r = data.run
  const archived = r.saved + r.upgraded + r.relocated + r.unchanged + r.incomplete
  const words = ["Today's", 'radar']

  return (
    <section ref={ref} id="top" className="relative isolate flex min-h-[80svh] items-end pb-12 pt-32 sm:min-h-[88vh] sm:items-center sm:pb-20">
      <motion.div className="page" style={reduced ? undefined : { y: lift }}>
        <div className="frost frost-hi max-w-[680px] p-6 sm:p-10"><GlassBg />
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
            style={{ textShadow: "0 1px 12px var(--bg)" }} className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-muted sm:text-[18px]">
            <span className="text-fg">{r.trending_observed}</span> trending repos scanned, <span className="text-fg">{archived}</span> archived,{' '}
            <span className="text-fg">{data.featured.length}</span> {data.featured.length === 1 ? 'pick' : 'picks'} worth your time, plus{' '}
            <span className="text-fg">{data.news.length}</span> stories from the tech wire.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }} className="mt-8 flex flex-wrap items-center gap-3">
            <LiquidButton><a href="#picks" className="glass-btn group inline-flex items-center gap-2 rounded-full !bg-accent/30 px-5 py-3 font-sans text-[14px] font-semibold leading-none text-fg transition hover:!bg-accent/40">
                See today's picks
                <span className="transition-transform group-hover:translate-y-0.5">↓</span>
              </a></LiquidButton>
            <span className="inline-flex items-center gap-2 text-[13px] text-muted">
              <Clock width={14} height={14} /> Last updated {fmtDateTime(data.generated_at)}
            </span>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
