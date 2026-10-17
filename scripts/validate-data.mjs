// Validates public/data against the contract in README.md.
// Exit 1 only on hard errors (unparseable JSON / missing date fields) so a slightly-off daily
// file never blocks a deploy; everything else is reported as a warning.
import { readFileSync, existsSync } from 'node:fs'

const dir = new URL('../public/data/', import.meta.url)
let errors = 0, warnings = 0
const err = (m) => { errors++; console.error('ERROR  ' + m) }
const warn = (m) => { warnings++; console.warn('WARN   ' + m) }
const read = (rel) => {
  try { return JSON.parse(readFileSync(new URL(rel, dir), 'utf8')) } catch (e) { err(`${rel}: ${e.message}`); return null }
}
const STATUS = ['saved', 'upgraded', 'relocated', 'unchanged', 'incomplete']
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function checkReport(r, f) {
  if (!r || typeof r !== 'object') return err(`${f}: not an object`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '')) err(`${f}: date must be YYYY-MM-DD`)
  if (isNaN(Date.parse(r.generated_at))) err(`${f}: generated_at must be ISO 8601`)
  else if (!/\+08:00$/.test(r.generated_at)) warn(`${f}: generated_at should carry +08:00`)
  const run = r.run ?? {}
  for (const k of ['trending_observed', 'saved', 'upgraded', 'relocated', 'unchanged', 'incomplete', 'eligible_not_archived', 'rejected'])
    if (!isNum(run[k])) warn(`${f}: run.${k} should be a number`)
  if (!Array.isArray(run.blockers)) warn(`${f}: run.blockers should be an array`)
  if (typeof run.archive_folder !== 'string') warn(`${f}: run.archive_folder should be a string`)
  const fe = r.featured ?? []
  if (fe.length > 3) warn(`${f}: featured has ${fe.length} items (max 3)`)
  fe.forEach((x, i) => {
    if (!x.full_name || !x.url) warn(`${f}: featured[${i}] missing full_name/url`)
    if (!(x.rating >= 1 && x.rating <= 5)) warn(`${f}: featured[${i}].rating must be 1-5`)
    if (!Array.isArray(x.ideas) || x.ideas.length !== 5) warn(`${f}: featured[${i}].ideas must have exactly 5`)
  })
  const ar = r.archived ?? []
  if (ar.length > 5) warn(`${f}: archived has ${ar.length} items (max 5)`)
  ar.forEach((x, i) => { if (!STATUS.includes(x.status)) warn(`${f}: archived[${i}].status "${x.status}" not in ${STATUS.join('|')}`) })
  ;(r.trending ?? []).forEach((x, i) => { if (!x.full_name || !isNum(x.rank)) warn(`${f}: trending[${i}] missing full_name/rank`) })
  ;(r.news ?? []).forEach((x, i) => {
    if (!x.title || !x.url || !x.source) warn(`${f}: news[${i}] missing title/url/source`)
    if (isNaN(Date.parse(x.published_at))) warn(`${f}: news[${i}].published_at invalid`)
    if (!Array.isArray(x.tags)) warn(`${f}: news[${i}].tags should be an array`)
  })
  ;(r.news_highlights ?? []).forEach((x, i) => { if (!x.title || !x.url || !x.why_it_matters) warn(`${f}: news_highlights[${i}] incomplete`) })
}

const latest = read('latest.json')
checkReport(latest, 'latest.json')
const index = existsSync(new URL('history/index.json', dir)) ? read('history/index.json') : (warn('history/index.json missing'), [])
if (index && !Array.isArray(index)) err('history/index.json must be an array')
for (const e of Array.isArray(index) ? index : []) {
  if (!existsSync(new URL(`history/${e.date}.json`, dir))) { warn(`history/${e.date}.json listed in index but missing`); continue }
  checkReport(read(`history/${e.date}.json`), `history/${e.date}.json`)
}
if (latest && Array.isArray(index) && !index.some((e) => e.date === latest.date)) warn(`latest date ${latest.date} not in history/index.json`)
console.log(`data check: ${errors} error(s), ${warnings} warning(s)`)
process.exit(errors ? 1 : 0)
