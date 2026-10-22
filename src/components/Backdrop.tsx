import { motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useState } from 'react'
import { hasWebGL, useMedia, useReducedMotion } from '../lib/hooks'

const HeroScene = lazy(() => import('../three/HeroScene'))

/**
 * Site-wide animated background: fixed, full-viewport layer behind all content.
 * CSS aurora orbs (transform/opacity only, GPU composited) + lazy 3D scene.
 * Reduced motion or no WebGL -> static aurora (still vibrant, no movement).
 */
export function Backdrop({ theme, picks }: { theme: 'dark' | 'light'; picks: number }) {
  const reduced = useReducedMotion()
  const mobile = useMedia('(max-width: 767px)')
  const [webgl] = useState(hasWebGL)
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    const go = () => setReady(true)
    if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 1200 })
    else setTimeout(go, 300)
    const vis = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [])

  const show3D = webgl && !reduced && ready
  return (
    <div className="backdrop-layer" aria-hidden>
      <div className={`aurora ${reduced ? 'aurora-static' : ''}`}>
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
        <span className="orb orb-d" />
        <span className="orb orb-e" />
      </div>
      {show3D && (
        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6 }}>
          <Suspense fallback={null}>
            <HeroScene theme={theme} mobile={mobile} active={visible} picks={picks} />
          </Suspense>
        </motion.div>
      )}
      <div className="backdrop-vignette" />
    </div>
  )
}
