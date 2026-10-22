import LiquidGlass from 'liquid-glass-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../lib/hooks'

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
 * Transparent liquid-glass wrapper for a single button or link. The library positions itself with
 * top/left 50% + translate(-50%), so we size an inert, invisible copy of the child in normal flow and
 * centre the glass over it. The real (interactive) element is the child rendered inside the glass.
 */
export function LiquidButton({ children, radius = 999, className = '' }: { children: ReactNode; radius?: number; className?: string }) {
  const on = useLiquid()
  if (!on) return <span className={`inline-flex ${className}`}>{children}</span>
  return (
    <span className={`liquid-host ${className}`}>
      <span className="liquid-sizer" aria-hidden {...{ inert: '' }}>{children}</span>
      <LiquidGlass
        style={{ position: 'absolute', top: '50%', left: '50%' }}
        padding="0" cornerRadius={radius}
        displacementScale={56} blurAmount={0.06} saturation={170} aberrationIntensity={1.5}
        elasticity={0.22} mode="standard" onClick={() => {}}
      >
        {children}
      </LiquidGlass>
    </span>
  )
}
