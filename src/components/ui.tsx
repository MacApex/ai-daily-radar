import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { useFinePointer, useReducedMotion } from '../lib/hooks'
import { fmtNum } from '../lib/format'
import { Check, Copy, Star } from './Icons'

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}
export const stagger = (s = 0.06) => ({ hidden: {}, show: { transition: { staggerChildren: s } } })

export function Reveal({ children, className, as = 'div', delay = 0 }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'section'; delay?: number }) {
  const C = motion[as]
  return (
    <C className={className} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={fadeUp} transition={{ delay }}>
      {children}
    </C>
  )
}

export function Counter({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduced = useReducedMotion()
  const [v, setV] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced) { setV(value); return }
    if (!inView) return
    const c = animate(0, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [inView, value, reduced])
  return <span ref={ref} className={`tabular-nums ${className ?? ''}`}>{fmtNum(v)}</span>
}

export function StarRating({ value, size = 15 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <motion.span
      className="inline-flex items-center gap-0.5" role="img" aria-label={`Rating ${v} of 5`}
      initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.08)}
    >
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="star-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent-3)" />
            <stop offset="1" stopColor="#ffd36e" />
          </linearGradient>
        </defs>
      </svg>
      {Array.from({ length: 5 }, (_, i) => (
        <motion.span key={i} variants={{ hidden: { opacity: 0, scale: 0.4 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 22 } } }}>
          <Star width={size} height={size} style={{ fill: i < v ? 'url(#star-grad)' : 'var(--panel-border)', color: 'transparent' }} />
        </motion.span>
      ))}
    </motion.span>
  )
}

/** Pointer-tracked 3D tilt with a cursor-following sheen. Disabled for touch + reduced motion. */
export function TiltCard({ children, className = '', max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const fine = useFinePointer()
  const reduced = useReducedMotion()
  const on = fine && !reduced
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 220, damping: 22 })
  const sy = useSpring(py, { stiffness: 220, damping: 22 })
  const rotY = useTransform(sx, [0, 1], [-max, max])
  const rotX = useTransform(sy, [0, 1], [max, -max])
  const sheen = useTransform([sx, sy] as never, ([x, y]: number[]) =>
    `radial-gradient(420px circle at ${x * 100}% ${y * 100}%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 55%)`)
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!on) return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const leave = () => { px.set(0.5); py.set(0.5) }
  return (
    <div style={{ perspective: 1100 }} className="h-full">
      <motion.div
        onPointerMove={move} onPointerLeave={leave}
        style={on ? { rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' } : undefined}
        whileHover={on ? { y: -4 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className={`group relative h-full glass glass-hi ${className}`}
      >
        {on && <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[22px] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: sheen }} />}
        <div className="relative h-full" style={on ? { transform: 'translateZ(24px)' } : undefined}>{children}</div>
      </motion.div>
    </div>
  )
}

export function SectionHeader({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <Reveal className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2 id={id} className="h2">{title}</h2>
      </div>
      {children}
    </Reveal>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="relative grid h-14 w-14 place-items-center">
        <span className="absolute inset-0 rounded-full border border-line" />
        <span className="absolute inset-3 rounded-full border border-line" />
        <span className="h-2 w-2 rounded-full bg-muted" />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  )
}

const STATUS: Record<string, { label: string; color: string }> = {
  saved: { label: 'Saved', color: 'var(--accent-2)' },
  upgraded: { label: 'Upgraded', color: 'var(--accent)' },
  relocated: { label: 'Relocated', color: 'var(--sky)' },
  unchanged: { label: 'Unchanged', color: 'var(--muted)' },
  incomplete: { label: 'Incomplete', color: 'var(--accent-3)' },
  archived: { label: 'Archived', color: 'var(--accent-2)' },
  eligible_not_archived: { label: 'Eligible', color: 'var(--muted)' },
  rejected: { label: 'Rejected', color: 'var(--danger)' },
}
export const statusMeta = (s: string) => STATUS[s] ?? { label: s.replace(/_/g, ' '), color: 'var(--muted)' }

export function Badge({ status }: { status: string }) {
  const m = statusMeta(status)
  return (
    <span className="chip whitespace-nowrap capitalize" style={{ color: m.color, borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`, background: `color-mix(in srgb, ${m.color} 10%, transparent)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }) }}
      className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 font-mono text-[12px] text-muted transition hover:bg-[var(--panel-hi)] hover:text-fg"
      aria-label={`Copy ${label}`}
    >
      {done ? <Check className="text-mint" /> : <Copy />}
      <span>{label}</span>
      <span className="sr-only" aria-live="polite">{done ? 'Copied' : ''}</span>
    </button>
  )
}

export const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5', TypeScript: '#3178c6', JavaScript: '#f1e05a', Rust: '#dea584', Go: '#00ADD8', Shell: '#89e051',
  Kotlin: '#A97BFF', Swift: '#F05138', 'C++': '#f34b7d', C: '#555555', Java: '#b07219', Ruby: '#701516', Zig: '#ec915c',
}
export function Lang({ name }: { name: string | null }) {
  if (!name) return <span className="text-muted">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: LANG_COLORS[name] ?? 'var(--muted)' }} />
      {name}
    </span>
  )
}
