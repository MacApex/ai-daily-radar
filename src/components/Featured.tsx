import { motion } from 'framer-motion'
import type { Featured as F } from '../lib/types'
import { fmtNum } from '../lib/format'
import { EmptyState, SectionHeader, StarRating, TiltCard, fadeUp, stagger } from './ui'
import { Arrow, Star } from './Icons'
import { LiquidButton } from './glass'

function Card({ f, i }: { f: F; i: number }) {
  const [owner, name] = f.full_name.split('/')
  return (
    <TiltCard className="overflow-hidden">
      <article className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="font-display text-[44px] font-bold leading-none tracking-[-0.05em] text-transparent [-webkit-text-stroke:1px_var(--muted)] opacity-60">
            0{i + 1}
          </span>
          <StarRating value={f.rating} />
        </div>
        <h3 className="mt-4 break-words font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">
          <a href={f.url} target="_blank" rel="noreferrer" className="link-u">
            <span className="text-muted">{owner}/</span>{name}
          </a>
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="chip text-amber"><Star width={12} height={12} /> {fmtNum(f.stars)}</span>
          <span className="chip font-mono text-muted">{f.license || 'No license'}</span>
        </div>
        <p className="mt-4 text-[14.5px] leading-relaxed text-muted">{f.reason}</p>
        <div className="mb-6 mt-5 border-t border-line pt-4">
          <p className="eyebrow mb-3">5 ideas</p>
          <ol className="space-y-2.5">
            {f.ideas.map((idea, j) => (
              <li key={j} className="flex gap-3 text-[14px] leading-snug">
                <span className="mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-md border border-line font-mono text-[11px] text-accent">{j + 1}</span>
                <span>{idea}</span>
              </li>
            ))}
          </ol>
        </div>
        <LiquidButton className="mt-auto self-start">
        <a href={f.url} target="_blank" rel="noreferrer" className="glass-btn group/btn mt-auto inline-flex items-center gap-1.5 self-start rounded-full px-3.5 py-2 text-[13px] font-semibold text-fg hover:!bg-accent/20">
          Open on GitHub <Arrow className="transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
        </a>
        </LiquidButton>
      </article>
    </TiltCard>
  )
}

export function Featured({ items }: { items: F[] }) {
  return (
    <section aria-labelledby="picks" className="page pt-20 sm:pt-28">
      <SectionHeader id="picks" eyebrow="01 · Today's picks" title="Worth your attention">
        <p className="max-w-sm text-[14px] text-muted">Hand-rated from today's trending scan, each with five concrete ways to use it.</p>
      </SectionHeader>
      {items.length === 0 ? (
        <EmptyState title="No new repos worth recommending today." hint="The scan ran, but nothing cleared the bar. Check the full trending table below." />
      ) : (
        <motion.div className={`grid gap-4 sm:gap-5 ${items.length >= 3 ? 'lg:grid-cols-3' : items.length === 2 ? 'lg:grid-cols-2' : ''} md:grid-cols-2`}
          initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={stagger(0.1)}>
          {items.map((f, i) => (
            <motion.div key={f.full_name} variants={fadeUp} className={items.length >= 3 && i === 2 ? 'md:col-span-2 lg:col-span-1' : ''}>
              <Card f={f} i={i} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}
