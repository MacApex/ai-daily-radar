import { useEffect, useRef } from 'react'

const CHECK_EVERY_MS = 10 * 60 * 1000 // while the page is visible
const MIN_GAP_MS = 20 * 1000 // focus + visibilitychange + pageshow often fire together
const RELOAD_KEY = 'radar-reloaded-for'

/** Returns true when a newer deploy is live (and reloads once for it). */
async function newDeployLive(): Promise<boolean> {
  if (import.meta.env.DEV) return false
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-cache' })
    if (!res.ok) return false
    const { build } = (await res.json()) as { build?: string }
    if (!build || build === __BUILD_ID__) return false
    // Guard against a reload loop if the CDN still serves the old index.html for a few minutes.
    let already: string | null = null
    try { already = sessionStorage.getItem(RELOAD_KEY) } catch { /* ignore */ }
    if (already === build) return false
    try { sessionStorage.setItem(RELOAD_KEY, build) } catch { /* ignore */ }
    location.reload()
    return true
  } catch {
    return false
  }
}

/**
 * Keeps a long-lived tab / app WebView in sync with the site:
 * re-checks on becoming visible, on focus, on pageshow (incl. bfcache restores) and every 10 min.
 * `check` should re-fetch latest.json and apply it if it changed.
 */
export function useFreshness(check: () => Promise<void> | void) {
  const ref = useRef(check)
  ref.current = check
  useEffect(() => {
    let last = Date.now()
    let busy = false
    const run = async (force = false) => {
      if (document.visibilityState !== 'visible' || busy) return
      if (!force && Date.now() - last < MIN_GAP_MS) return
      busy = true
      last = Date.now()
      try {
        if (!(await newDeployLive())) await ref.current()
      } catch { /* offline etc. — try again next time */ }
      finally { busy = false }
    }
    const onVis = () => { if (document.visibilityState === 'visible') run() }
    const onFocus = () => run()
    const onShow = (e: PageTransitionEvent) => run(e.persisted)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onShow)
    const id = window.setInterval(() => run(true), CHECK_EVERY_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onShow)
      window.clearInterval(id)
    }
  }, [])
}
