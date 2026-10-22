import { motion } from 'framer-motion'
import type { RunSummary as Run } from '../lib/types'
import { Counter, CopyButton, fadeUp, stagger } from './ui'
import { Alert, Folder, Shield } from './Icons'

export function RunSummary({ run }: { run: Run }) {
  const tiles = [
    { k: 'Trending observed', v: run.trending_observed, c: 'var(--text)', big: true },
    { k: 'Saved', v: run.saved, c: 'var(--accent-2)' },
    { k: 'Upgraded', v: run.upgraded, c: 'var(--accent)' },
    { k: 'Eligible, not archived', v: run.eligible_not_archived, c: 'var(--muted)' },
    { k: 'Rejected', v: run.rejected, c: 'var(--danger)' },
    { k: 'Other outcomes', v: run.relocated + run.unchanged + run.incomplete, c: 'var(--sky)', sub: `relocated ${run.relocated} · unchanged ${run.unchanged} · incomplete ${run.incomplete}` },
  ]
  return (
    <section aria-label="Run summary" className="page relative -mt-4 sm:-mt-8">
      <motion.div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger(0.05)}>
        {tiles.map((t, i) => (
          <motion.div key={t.k} variants={fadeUp}
            className={`frost frost-hi relative overflow-hidden p-4 sm:p-5 ${i === 0 ? 'col-span-2 lg:col-span-4 lg:row-span-2' : i === 5 ? 'col-span-2 sm:col-span-1 lg:col-span-2' : 'lg:col-span-2'}`}>
            <p className="text-[12px] font-medium leading-snug text-muted">{t.k}</p>
            <p className={`mt-2 font-display font-semibold tracking-[-0.04em] ${i === 0 ? 'text-[56px] leading-none sm:text-[72px]' : 'text-[34px] leading-none sm:text-[40px]'}`} style={{ color: t.c }}>
              <Counter value={t.v} />
            </p>
            {t.sub && <p className="mt-2 font-mono text-[11px] text-muted">{t.sub}</p>}
            {i === 0 && (
              <div className="mt-5 flex h-2 w-full overflow-hidden rounded-full bg-[var(--panel-hi)]" aria-hidden>
                {[
                  [run.saved + run.upgraded + run.relocated + run.unchanged + run.incomplete, 'var(--accent-2)'],
                  [run.eligible_not_archived, 'var(--muted)'],
                  [run.rejected, 'var(--danger)'],
                ].map(([v, c], j) => (
                  <motion.span key={j} className="h-full" style={{ background: c as string, opacity: j === 1 ? 0.45 : 1 }}
                    initial={{ width: 0 }} whileInView={{ width: `${(100 * (v as number)) / Math.max(run.trending_observed, 1)}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.2 + j * 0.15, ease: [0.22, 1, 0.36, 1] }} />
                ))}
              </div>
            )}
            {i === 0 && <p className="mt-2 text-[12px] text-muted">archived · eligible · rejected</p>}
          </motion.div>
        ))}
        <motion.div variants={fadeUp} className="frost frost-hi col-span-2 flex flex-col justify-between gap-3 p-4 sm:col-span-1 sm:p-5 lg:col-span-3">
          <p className="flex items-center gap-2 text-[12px] font-medium text-muted"><Folder width={14} height={14} /> Archive folder</p>
          {run.archive_folder ? (
            <div className="-mx-1.5 [overflow-wrap:anywhere] [&_span]:text-[11.5px]"><CopyButton text={run.archive_folder} label={run.archive_folder} /></div>
          ) : <p className="text-sm text-muted">No archive folder this run.</p>}
        </motion.div>
        <motion.div variants={fadeUp} className="frost frost-hi col-span-2 flex items-center p-4 sm:p-5 lg:col-span-3">
          {run.blockers.length === 0 ? (
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint/15 text-mint"><Shield /></span>
              <div>
                <p className="font-medium">No blockers</p>
                <p className="text-[13px] text-muted">The run completed cleanly.</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 flex items-center gap-2 font-medium text-danger"><Alert /> {run.blockers.length} blocker{run.blockers.length > 1 ? 's' : ''}</p>
              <ul className="space-y-1 text-[13px] text-muted">
                {run.blockers.map((b, i) => <li key={i} className="flex gap-2"><span className="text-danger">•</span>{b}</li>)}
              </ul>
            </div>
          )}
        </motion.div>
      </motion.div>
    </section>
  )
}
