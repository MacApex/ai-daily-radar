const TZ = 'Asia/Shanghai'

export const fmtNum = (n: number) => new Intl.NumberFormat('en-US').format(n)
export const fmtCompact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export function fmtDateTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(+d)) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d) + ' CST'
}
export function fmtTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(+d)) return '—'
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}
export function fmtLongDate(date: string) {
  const d = new Date(date + 'T12:00:00+08:00')
  if (isNaN(+d)) return date
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
export function fmtShortDate(date: string) {
  const d = new Date(date + 'T12:00:00+08:00')
  if (isNaN(+d)) return date
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d)
}
export function relTime(iso: string, now = Date.now()) {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const s = Math.round((now - t) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
export const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
