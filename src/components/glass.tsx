import LiquidGlass from 'liquid-glass-react'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useMedia, useReducedMotion } from '../lib/hooks'

/* ------------------------------------------------------------------------------------------------
 * EXTREME preset. One material everywhere: every panel and every button is a liquid-glass-react
 * instance with the same map/aberration/elasticity; only displacement + blur scale with size.
 * ---------------------------------------------------------------------------------------------- */
export const MODE = 'prominent' as const
const PANEL = { displacementScale: 240, blurAmount: 0.3, saturation: 210, aberrationIntensity: 6, elasticity: 0.15 }
const BUTTON = { displacementScale: 240, blurAmount: 0.06, saturation: 220, aberrationIntensity: 6, elasticity: 0.5 }
const MOBILE_SCALE = 0.75 // phones: slightly lighter displacement, same look

/** Real SVG displacement only renders in Chromium (Chrome, Edge, Android WebView). */
function canLiquid() {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false
  const ua = navigator.userAgent
  const chromium = /Chrome\/|Chromium\//.test(ua) && !/Firefox|FxiOS|CriOS|EdgiOS|OPiOS/.test(ua)
  return chromium && CSS.supports('backdrop-filter', 'blur(1px)')
}
export function useLiquid() {
  const reduced = useReducedMotion()
  const [ok, setOk] = useState(false)
  useEffect(() => setOk(canLiquid()), [])
  return ok && !reduced
}

/* ---- one shared pointer store (mouse AND touch) -> globalMousePos / mouseOffset for every instance.
 * The library only listens to mousemove; feeding it externally makes taps on Android wobble too. ---- */
type P = { x: number; y: number }
let pos: P = { x: 0, y: 0 }
let off: P = { x: 0, y: 0 }
const subs = new Set<() => void>()
let raf = 0
let release: ReturnType<typeof setTimeout> | undefined
function set(x: number, y: number) {
  pos = { x, y }
  off = { x: ((x - innerWidth / 2) / innerWidth) * 100, y: ((y - innerHeight / 2) / innerHeight) * 100 }
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => subs.forEach((f) => f()))
}
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => set(e.clientX, e.clientY), { passive: true })
  const touch = (e: TouchEvent) => { const t = e.touches[0]; if (t) { clearTimeout(release); set(t.clientX, t.clientY) } }
  window.addEventListener('touchstart', touch, { passive: true })
  window.addEventListener('touchmove', touch, { passive: true })
  window.addEventListener('touchend', () => { clearTimeout(release); release = setTimeout(() => set(0, 0), 450) }, { passive: true })
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
function usePointer() {
  const p = useSyncExternalStore(subscribe, () => pos, () => pos)
  const o = useSyncExternalStore(subscribe, () => off, () => off)
  return { p, o }
}
const pageRef = { current: typeof document !== 'undefined' ? document.body : null }

/**
 * Full-surface liquid glass behind a panel. Insert as the FIRST child of any positioned element.
 * It measures its parent and renders an (empty) LiquidGlass of exactly that size, centred, behind
 * the content, plus a soft tint layer for text contrast.
 */
export function GlassBg({ radius = 24 }: { radius?: number }) {
  const on = useLiquid()
  const mobile = useMedia('(max-width: 767px)')
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const { p, o } = usePointer()
  useLayoutEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const k = mobile ? MOBILE_SCALE : 1
  return (
    <div ref={ref} className="glass-bg" aria-hidden>
      {on && size && size.w > 0 && (
        <LiquidGlass
          key={`${Math.round(size.w / 40)}x${Math.round(size.h / 40)}`}
          style={{ position: 'absolute', top: '50%', left: '50%' }}
          padding="0" cornerRadius={radius} mode={MODE}
          {...PANEL} displacementScale={PANEL.displacementScale * k}
          mouseContainer={pageRef} globalMousePos={p} mouseOffset={o}
        >
          <div style={{ width: size.w, height: size.h }} />
        </LiquidGlass>
      )}
      <div className="glass-tint" />
    </div>
  )
}

/**
 * Liquid-glass wrapper for a single button or link. The library centres itself with
 * top/left 50% + translate(-50%), so an inert invisible copy of the child sizes the host.
 * `minor` pills fall back to CSS glass on phones (keeps Android WebView fluid).
 */
export function LiquidButton({ children, radius = 999, className = '', minor = false }: { children: ReactNode; radius?: number; className?: string; minor?: boolean }) {
  const on = useLiquid()
  const mobile = useMedia('(max-width: 767px)')
  const { p, o } = usePointer()
  if (!on || (minor && mobile)) return <span className={`inline-flex ${className}`}>{children}</span>
  const k = mobile ? MOBILE_SCALE : 1
  return (
    <span className={`liquid-host ${className}`}>
      <span className="liquid-sizer" aria-hidden {...{ inert: '' }}>{children}</span>
      <LiquidGlass
        style={{ position: 'absolute', top: '50%', left: '50%' }}
        padding="0" cornerRadius={radius} mode={MODE}
        {...BUTTON} displacementScale={BUTTON.displacementScale * k}
        mouseContainer={pageRef} globalMousePos={p} mouseOffset={o} onClick={() => {}}
      >
        {children}
      </LiquidGlass>
    </span>
  )
}

/** Tap ripple (touch + mouse) on any glass button / pill / panel. */
export function GlassRipple() {
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null
      const el = t?.closest?.('.liquid-host .glass, .pill, .glass-btn, .frost') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      const s = document.createElement('span')
      const d = Math.min(Math.max(r.width, r.height) * 2.2, 900)
      s.className = 'glass-ripple'
      s.style.cssText = `left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;width:${d}px;height:${d}px`
      el.appendChild(s)
      s.addEventListener('animationend', () => s.remove(), { once: true })
    }
    window.addEventListener('pointerdown', down, { passive: true })
    return () => window.removeEventListener('pointerdown', down)
  }, [reduced])
  return null
}
