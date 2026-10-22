import LiquidGlass from 'liquid-glass-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useMedia, useReducedMotion } from '../lib/hooks'

/** Real SVG displacement only renders in Chromium (Chrome, Edge, Android WebView). Elsewhere, and
 *  for reduced motion / data saver / no backdrop-filter, use the cheap CSS glass instead. */
function canLiquid() {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false
  const ua = navigator.userAgent
  const chromium = /Chrome\/|Chromium\//.test(ua) && !/Firefox|FxiOS|CriOS|EdgiOS|OPiOS/.test(ua)
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return chromium && !conn?.saveData && CSS.supports('backdrop-filter', 'blur(1px)')
}

export function useLiquid() {
  const reduced = useReducedMotion()
  const [ok, setOk] = useState(false)
  useEffect(() => setOk(canLiquid()), [])
  return ok && !reduced
}

/**
 * Liquid-glass wrapper for a single button or link. The library positions itself with
 * top/left 50% + translate(-50%), so we size an inert, invisible copy of the child in normal flow and
 * centre the glass over it. The real (interactive) element is the child rendered inside the glass.
 */
export function LiquidButton({ children, radius = 999, className = '', strength = 1 }: { children: ReactNode; radius?: number; className?: string; strength?: number }) {
  const on = useLiquid()
  const mobile = useMedia('(max-width: 767px)')
  if (!on) return <span className={`inline-flex ${className}`}>{children}</span>
  return (
    <span className={`liquid-host ${className}`}>
      <span className="liquid-sizer" aria-hidden {...{ inert: '' }}>{children}</span>
      <LiquidGlass
        style={{ position: 'absolute', top: '50%', left: '50%' }}
        padding="0" cornerRadius={radius}
        displacementScale={(mobile ? 70 : 120) * strength} blurAmount={0.04} saturation={185}
        aberrationIntensity={mobile ? 2 : 3} elasticity={0.35} mode="standard" onClick={() => {}}
      >
        {children}
      </LiquidGlass>
    </span>
  )
}

/**
 * Site-wide glass FX: the SVG filters used by `.frost` panels (edge refraction) plus one delegated
 * pointer listener that drives the pointer-following highlight (--mx/--my) and a tap/click ripple on
 * panels, buttons and chips (the library itself only reacts to mouse events).
 */
export function GlassFx() {
  const reduced = useReducedMotion()
  const mobile = useMedia('(max-width: 767px)')
  useEffect(() => {
    let raf = 0
    let last: HTMLElement | null = null
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = (e.target as Element | null)?.closest?.('.frost') as HTMLElement | null
        if (last && last !== el) last.classList.remove('is-lit')
        last = el
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
        el.classList.add('is-lit')
      })
    }
    const down = (e: PointerEvent) => {
      if (reduced) return
      const t = e.target as Element | null
      const el = (t?.closest?.('.liquid-host, .pill, .glass-btn, .chip') ?? t?.closest?.('.frost')) as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      const s = document.createElement('span')
      const d = Math.max(r.width, r.height) * 2.2
      s.className = 'glass-ripple'
      s.style.cssText = `left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;width:${d}px;height:${d}px`
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
      el.appendChild(s)
      s.addEventListener('animationend', () => s.remove(), { once: true })
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); cancelAnimationFrame(raf) }
  }, [reduced])
  // desktop: animated turbulence (slow ripple); mobile / reduced motion: static map, smaller scale
  const animate = !reduced && !mobile
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute', width: 0, height: 0 }}>
      <filter id="lg-warp" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={mobile ? "0.016 0.02" : "0.009 0.013"} numOctaves={2} seed={7} result="noise">
          {animate && <animate attributeName="baseFrequency" dur="14s" values="0.009 0.013;0.012 0.009;0.009 0.013" repeatCount="indefinite" />}
        </feTurbulence>
        <feGaussianBlur in="noise" stdDeviation="5" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale={mobile ? 42 : 44} xChannelSelector="R" yChannelSelector="G" result="r" />
        {!mobile && <>
          <feColorMatrix in="r" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rc" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale={39} xChannelSelector="R" yChannelSelector="G" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="gc" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale={34} xChannelSelector="R" yChannelSelector="G" result="b" />
          <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bc" />
          <feBlend in="rc" in2="gc" mode="screen" result="rg" />
          <feBlend in="rg" in2="bc" mode="screen" />
        </>}
      </filter>
    </svg>
  )
}
