# AI Daily Radar: Design Plan

A personal, once-a-day intelligence dashboard. Max opens one link at ~10:00 Asia/Shanghai and sees
the day's GitHub picks, archive results, full trending table, tech news and history, all rendered
statically from `public/data/*.json`.

## 1. Visual direction

**"Observatory at night"**: a dark, deep-space control room. Content sits on frosted-glass panels
floating above a slowly drifting 3D scene of iridescent glass forms and a faint particle
constellation (the "radar field"). Restraint over decoration: one hero moment, then calm, dense,
highly legible panels. Film grain over everything adds a tactile, printed feel and kills gradient
banding.

Light mode ("Paper"): warm off-white canvas, the same glass panels become milky white with soft
shadows, accents deepen for contrast. The 3D scene switches to pastel materials.

## 2. Color system (CSS variables, `data-theme` on `<html>`)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#07080d` | `#f5f3ee` | canvas |
| `--bg-2` | `#0d0f17` | `#ebe8e1` | section tint |
| `--panel` | `rgba(22,25,38,.55)` | `rgba(255,255,255,.66)` | glass panels |
| `--panel-border` | `rgba(255,255,255,.08)` | `rgba(15,17,26,.08)` | hairlines |
| `--text` | `#eef0f7` | `#12131a` | body (contrast >= 15:1) |
| `--muted` | `#9aa0b4` | `#555a6b` | secondary (>= 4.8:1 on panel) |
| `--accent` | `#8b7bff` (violet) | `#5b45e0` | primary accent, focus ring |
| `--accent-2` | `#3ee6c4` (mint) | `#0b8f74` | success, "saved" |
| `--accent-3` | `#ff9d5c` (amber) | `#b9520f` | stars, warmth |
| `--danger` | `#ff6b81` | `#c22a45` | rejected, blockers |

Signature gradient: `conic(violet -> mint -> amber -> violet)` used sparingly: hero wordmark, rating
stars, active pill underline, card hover sheen.

Status palette: saved = mint, upgraded = violet, relocated = sky `#5cc8ff`, unchanged = muted,
incomplete = amber, rejected = danger, eligible_not_archived = muted outline.

## 3. Typography

- Display: **Space Grotesk** 600/700 (headlines, numbers) with tight tracking (-0.03em).
- Text: **Inter** 400/500/600 (UI, body), `font-feature-settings: "cv11","ss01"`.
- Mono: **JetBrains Mono** 500 (SHAs, repo names, timestamps), tabular numbers for counters.
- Scale (fluid `clamp`): hero 44 -> 88px, h2 26 -> 36px, h3 18 -> 20px, body 15 -> 16px, small 13px.
- Fonts self-hosted via `@fontsource` (latin subsets only, `font-display: swap`).

## 4. Layout per breakpoint

Container max 1240px, gutters 16px (mobile) / 24px (tablet) / 32px (desktop).

| Breakpoint | Layout |
|---|---|
| < 640 (375 target) | single column; sticky compact top bar with icon nav; hero 78vh; stat bento 2x3; featured cards stacked; archive as stacked cards; trending table becomes card list; filters in horizontal scroll pills |
| 640-1023 | 2-column bento; featured 1 per row with ideas in 2 columns; trending table with fewer columns (hide language/desc) |
| >= 1024 | 12-col bento: run summary spans 12 (6 stat tiles + blockers tile), featured 3 across (equal height), archived 5 in a 3+2 bento with the first card wide, full trending table, news 8 cols + highlights 4 cols, history full width |

## 5. Sections and components

1. **TopBar** (sticky, glass): wordmark "AI Daily Radar" with a pulsing radar dot, section nav
   (Picks / Archive / Trending / News / History), "Updated 10:02 CST" chip, theme toggle.
2. **Hero**: lazy 3D scene behind; date (`Saturday, 17 Oct 2026`), headline "Today's radar", one-line
   summary ("13 trending scanned, 5 archived, 3 picks"), CTA chips jump to sections, scroll cue.
   `SAMPLE DATA` badge when `sample: true`.
3. **RunSummary bento**: animated counters for trending observed, saved, upgraded, eligible-not-archived,
   rejected, relocated/unchanged/incomplete; an archive-folder tile (mono, copy button); a blockers tile
   (green "No blockers" or a red list).
4. **Today's Picks** (`FeaturedCard` x <= 3): tilt card, rank numeral, repo name, star count, license
   chip, `StarRating`, reason, 5 numbered ideas, "Open on GitHub" link. Empty state:
   "No new repos worth recommending today."
5. **Archived Today** (`ArchiveCard` x <= 5): status badge, rating, stars, license, size, short SHA
   (copy on click), description. Empty state.
6. **Full Trending** (`TrendingTable`): search box, decision filter pills (All / Archived / Eligible /
   Rejected) with counts, language select, sortable columns (rank, stars, stars today, name).
   Mobile renders the same rows as cards. Decision reasons shown inline. Animated reorder (layout).
7. **Tech News** (`NewsSection`): highlights rail ("Why it matters"), list with source filter
   (All / Hacker News / Lobsters), tag pills (multi-select), full-text search, points/comments meta,
   relative time. Empty search state.
8. **History** (`HistorySection`): horizontal timeline of dates from `history/index.json` (dot size =
   archived count) plus a native `<input type="date">` picker limited to available dates. Selecting a
   date fetches `history/YYYY-MM-DD.json` and swaps the whole page into that day ("Viewing 2026-10-15,
   back to latest" banner). Picks per day listed beneath each dot.
9. **Footer**: data contract link, generated-at timestamp, repo link.

Shared components: `GlassPanel`, `TiltCard`, `Counter`, `StarRating`, `Badge`, `Pill`, `SectionHeader`,
`EmptyState`, `Skeleton`, `ThemeToggle`, `Grain` overlay.

## 6. 3D scene concept ("Radar Field")

React Three Fiber canvas fixed behind the hero (fades out as you scroll past it):
- 5 floating glass forms (torus knot, icosahedron, capsule, torus, octahedron) with
  `MeshTransmissionMaterial`-style physical glass (`meshPhysicalMaterial`, transmission 1, iridescence
  1, thickness, roughness .15, clearcoat) refracting a gradient environment (drei `Environment` with
  custom `Lightformer`s, no HDR download).
- ~600-point particle constellation on a slowly rotating sphere shell, additive blending, like radar
  blips; one featured repo = one brighter "star".
- `Float` for idle bobbing; group rotates toward pointer (damped lerp) and drifts up/rotates with
  scroll progress.
- DPR capped `[1, 1.5]` (1 on mobile), `PerformanceMonitor` drops DPR/particles on slow frames,
  `frameloop` set to `"never"` when hero is off-screen or tab hidden.
- **Fallback**: no WebGL or reduced motion -> static CSS composition (layered radial/conic gradients,
  blurred orbs, grain); identical framing so the layout never shifts.

## 7. Interaction and animation inventory

| Element | Interaction |
|---|---|
| Page load | hero headline words stagger up (y 24 -> 0, opacity), 60ms stagger; 3D fades in after mount |
| Sections | `whileInView` fade + rise once (amount .2), children stagger 50ms |
| Counters | count up 0 -> value over 1.2s ease-out when in view, tabular nums |
| Star rating | stars fill left -> right with gradient, 80ms stagger on view |
| Tilt cards | pointer-tracked rotateX/Y max 8 deg, spring; sheen highlight follows cursor; lift shadow; disabled on touch/reduced motion |
| Buttons/pills | hover background lift, active scale .97, animated underline (`layoutId`) on active filter |
| Trending sort/filter | rows use `layout` + `AnimatePresence` for reorder/enter/exit |
| News filter | list items cross-fade, count badge springs |
| Theme toggle | sun/moon icon morph (rotate + scale), colors transition 300ms |
| History switch | content cross-fades, banner slides down |
| Copy SHA | icon swaps to check for 1.5s, `aria-live` "Copied" |
| Nav | active section highlighted via IntersectionObserver; smooth scroll |
| Scroll | hero 3D parallax + fade, top bar gains stronger blur after 40px |

## 8. Accessibility and reduced motion

- Semantic landmarks (`header`, `nav`, `main`, `section[aria-labelledby]`, `footer`), skip link.
- All text >= 4.5:1, large text >= 3:1, in both themes. Visible 2px violet focus ring.
- Sortable headers are buttons with `aria-sort`; filters are toggle buttons with `aria-pressed`.
- Star ratings expose `aria-label="Rating 4 of 5"`; decorative 3D canvas `aria-hidden`.
- `prefers-reduced-motion: reduce` -> framer `MotionConfig reducedMotion="user"`, no tilt, counters
  render final value, 3D replaced by static fallback, smooth scroll disabled.
- Theme: dark by default (dark-first), light via toggle, choice persisted in `localStorage`.
- Times always rendered in Asia/Shanghai with "CST (UTC+8)" label via `Intl.DateTimeFormat`.

## 9. Performance budgets

| Budget | Target |
|---|---|
| Initial JS (gz, excluding 3D chunk) | <= 110 KB |
| 3D chunk (three + r3f + drei subset, gz) | <= 260 KB, loaded lazily after first paint / idle |
| CSS (gz) | <= 15 KB |
| Fonts | <= 3 woff2 subsets used on first paint (~90 KB) |
| LCP (4G mobile) | < 2.0s (hero text is HTML, not canvas) |
| CLS | < 0.02 (fixed hero height, skeletons match final size) |
| GPU | DPR <= 1.5, <= 5 transmission meshes, particles <= 600 (300 on mobile) |
| Data | latest.json fetched with `cache: no-cache` so the daily push shows immediately |
