import { motion } from 'framer-motion'
import type { Archived as A } from '../lib/types'
import { fmtNum } from '../lib/format'
import { Badge, CopyButton, EmptyState, SectionHeader, StarRating, TiltCard, fadeUp, stagger } from './ui'
import { Star } from './Icons'

export function Archived({ items }: { items: A[] }) {
  return (
    <section aria-labelledby="archive" className="page pt-20 sm:pt-28">
      <SectionHeader id="archive" eyebrow="02 · Archived today" title="Into the vault">
        <p className="max-w-sm text-[14px] text-muted">Snapshotted at a pinned commit so you can come back to exactly what was trending.</p>
      </SectionHeader>
      {items.length === 0 ? (
        <EmptyState title="Nothing archived today." hint="No repos were saved or upgraded in this run." />
      ) : (
        <motion.ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={stagger(0.07)}>
          {items.map((a, i) => {
            const wide = i < 2
            const [owner, name] = a.full_name.split('/')
            return (
              <motion.li key={a.full_name} variants={fadeUp} className={`${wide ? 'lg:col-span-3' : 'lg:col-span-2'} ${items.length % 2 === 1 && i === items.length - 1 ? 'sm:col-span-2 lg:col-span-2' : ''}`}>
                <TiltCard max={5}>
                  <article className="flex h-full flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge status={a.status} />
                      <StarRating value={a.rating} size={13} />
                    </div>
                    <h3 className={`mt-4 break-words font-display font-semibold leading-tight tracking-[-0.02em] ${wide ? 'text-[22px]' : 'text-[19px]'}`}>
                      <a href={a.url} target="_blank" rel="noreferrer" className="link-u"><span className="text-muted">{owner}/</span>{name}</a>
                    </h3>
                    <p className={`mt-2 text-[14px] leading-relaxed text-muted ${wide ? 'line-clamp-3' : 'line-clamp-3'}`}>{a.description}</p>
                    <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4 text-[12px]">
                      <div><dt className="text-muted">Stars</dt><dd className="mt-0.5 flex items-center gap-1 font-medium tabular-nums"><Star width={11} height={11} className="text-amber" />{fmtNum(a.stars)}</dd></div>
                      <div><dt className="text-muted">License</dt><dd className="mt-0.5 truncate font-mono font-medium">{a.license || '—'}</dd></div>
                      <div><dt className="text-muted">Size</dt><dd className="mt-0.5 font-medium tabular-nums">{a.size_mb >= 100 ? Math.round(a.size_mb) : a.size_mb} MB</dd></div>
                    </dl>
                    <div className="-mx-1.5 mt-2">{a.commit_sha && <CopyButton text={a.commit_sha} label={a.commit_sha.slice(0, 7)} />}</div>
                  </article>
                </TiltCard>
              </motion.li>
            )
          })}
        </motion.ul>
      )}
    </section>
  )
}
