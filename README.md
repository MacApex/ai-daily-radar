# AI Daily Radar

Max's daily dashboard: GitHub trending picks, archive results, the full trending table, tech news
and history. **Live:** https://macapex.github.io/ai-daily-radar/

The site is fully static. It renders only from JSON files in `public/data/`. There's no backend and
no API keys. Every push to `main` rebuilds and deploys to GitHub Pages through
`.github/workflows/deploy.yml`.

- Stack: Vite + React 18 + TypeScript + Tailwind 3 + framer-motion + @react-three/fiber + drei
- Design plan: [DESIGN.md](./DESIGN.md)

```bash
npm ci
npm run dev        # http://localhost:5173/ai-daily-radar/
npm run validate   # check public/data against the contract below
npm run build
```

---

## Publishing pipeline (`scripts/publish.py`)

The 10:00 Asia/Shanghai routine runs one command on the box. It only needs Python 3.9+ (stdlib), Node
(for the validator), git already authenticated to push `main`, and, optionally, `GH_TOKEN` for
GitHub API lookups.

```bash
cd /workspace/ai-daily-radar
python3 scripts/publish.py --run /path/to/run.json        # full daily publish
python3 scripts/publish.py --news-only                    # refresh just the news (same day)
python3 scripts/publish.py --convert run-summary.json > run.json   # Mac run-summary.json -> simple input
```

What `--run` does:
1. Reads the run input. This can be the **simple format** below or the Mac archive job's raw
   `run-summary.json`, which is auto-detected (it has a `rows` key) and converted.
2. Fills in missing `description` / `language` / `stars` / `license` / `size_mb` from the GitHub API.
3. Aggregates news (see "News sources"), dedupes by normalised URL and title, tags each item, ranks by
   votes decayed by age, applies per-source caps, and keeps at most 40.
4. Writes `public/data/latest.json` and `public/data/history/<date>.json` (identical), and
   adds or replaces the date in `history/index.json` (newest first).
5. Runs `node scripts/validate-data.mjs`, then `git add public/data`, commits
   (`data: daily radar <date> …`), runs `git pull --rebase`, and pushes `main`. Pages redeploys in about a minute.

`--news-only` keeps everything in `latest.json` except `news` and `generated_at`. It rewrites that
day's history file too and keeps the existing `news_highlights` unless you pass `--refresh-highlights`.
If every news source fails it exits without touching anything.

Flags: `--highlights file.json` (curated `news_highlights` instead of auto ones),
`--no-news` (with `--run`: reuse the current news), `--date YYYY-MM-DD`, `--no-push` (commit
locally only), `--no-commit` (write + validate only), `--dry-run` (fetch + summarise, write nothing).
Exit code is non-zero if validation or git fails.

### Simple run input (`run.json`)

```jsonc
{
  "date": "2026-10-17",                    // optional; else derived from run_at (Asia/Shanghai)
  "run_at": "2026-10-17T14:51:45+08:00",   // optional; when the archive run finished
  "archive_folder": "2026-10-17_144052_Asia-Shanghai",
  "blockers": [],                          // string[]; problems that stopped/degraded the run
  "repos": [                               // EVERY repo observed on GitHub Trending, any order
    {
      "full_name": "mksglu/context-mode",  // required
      "rank": 5,                           // required: trending position, 1-based
      "stars": 30319,                      // optional (GitHub API fallback)
      "stars_today": 449,                  // optional, default 0
      "decision": "upgraded",              // required: saved | upgraded | relocated | unchanged | incomplete
                                           //           | eligible_not_archived | rejected
                                           // (Mac phrases like "updated" / "eligible, not archived (…)" are normalised)
      "reason": "Why this decision.",      // shown in the trending table / archive cards
      "rating": 5,                         // 1-5 or null
      "license": "Elastic-2.0",            // optional (SPDX; free text is normalised; GitHub API fallback)
      "commit_sha": "5f6298a9…",           // archived commit (archive statuses only)
      "size_mb": 11.8,                     // optional (GitHub API repo size fallback)
      "description": "…",                  // optional (GitHub API fallback)
      "language": "TypeScript"             // optional (GitHub API fallback)
    }
  ],
  "featured": [                            // 0-3 picks, in display order
    {
      "full_name": "obra/superpowers",
      "reason": "Why it's worth attention.",   // optional; defaults to that repo's "reason"
      "ideas": ["…", "…", "…", "…", "…"]       // exactly 5
      // optional overrides: "stars", "rating", "license"
    }
  ],
  "news_highlights": [ { "title": "…", "url": "…", "why_it_matters": "…" } ]  // optional; else auto-picked
}
```

Counts in `run` are computed from `repos` (archive statuses count as archived). The archived list is
the repos with an archive status, sorted by rating then rank and capped at 5. The trending table shows
archive statuses as `"archived"` and prefixes their reason with the status.

Mac `run-summary.json` mapping (done automatically): `rows[].repository` → `full_name`,
`trending_rank` → `rank`, `github_stars` → `stars`, `stars_today_on_page` → `stars_today`,
`action` → `decision`, `archived_commit` → `commit_sha`, `tracked_source_bytes` → `size_mb`,
`featured{name: [ideas]}` + `counts.featured` (order) → `featured`, `basename(run_directory)` → `archive_folder`.

### News sources

| Source | How | Notes |
|---|---|---|
| hacker-feeds-cli | `cli-anything-hacker-feeds-cli --json news -t 30`, `lobsters -c 25`, `devto -t ai -s top -c 12` | DEV.to dates come from dev.to's public API; the CLI's Lobsters items (no timestamps) are used only if the Lobsters API fails |
| Hacker News API | `https://hacker-news.firebaseio.com/v0/topstories.json` + `item/<id>.json` | job ads skipped; max 20 HN items |
| Lobsters | `https://lobste.rs/hottest.json` | max 10 |
| GitHub Blog | `https://github.blog/feed/` (RSS) | last 96 h, max 4 per feed |
| Simon Willison | `https://simonwillison.net/atom/everything/` (Atom) | last 96 h |
| Hugging Face blog | `https://huggingface.co/blog/feed.xml` (RSS) | last 96 h |

A failing source is logged and skipped. Override the CLI path with `HACKER_FEEDS_CLI=/path/to/cli`.

### Manual publishing (without the script)

Write `latest.json` and an identical `history/YYYY-MM-DD.json`, update `history/index.json`, run
`npm run validate`, then commit and push `main`. The deploy workflow also runs the validator. It
fails only on unparseable JSON or a missing/invalid `date`/`generated_at`, so the previous day's site
stays live in that case.

Rules:
- UTF-8 JSON. Field names are exactly as below (snake_case).
- Timestamps are ISO 8601 **with the `+08:00` offset**, e.g. `2026-10-17T10:02:11+08:00`.
- Dates are `YYYY-MM-DD` in Asia/Shanghai.
- `?` marks an optional field. Everything else is required (use `[]`, `0` or `""` when there's nothing).
- Leave out `sample`, or set `"sample": false`, for real runs. `"sample": true` shows a SAMPLE DATA badge.

## Data contract

### `public/data/latest.json` and `public/data/history/YYYY-MM-DD.json` (same shape)

```jsonc
{
  "sample": false,                         // optional boolean. true shows a "SAMPLE DATA" badge
  "generated_at": "2026-10-17T14:40:52+08:00", // ISO 8601 with +08:00. Shown as "Last updated … CST"
  "date": "2026-10-17",                    // report date, YYYY-MM-DD (Asia/Shanghai)
  "run": {
    "trending_observed": 13,               // repos seen on GitHub Trending this run
    "saved": 4,                            // newly archived
    "upgraded": 1,                         // re-archived at a newer commit
    "relocated": 0,                        // archive moved (e.g. repo renamed)
    "unchanged": 0,                        // already archived, same commit
    "incomplete": 0,                       // archive attempted but partial
    "eligible_not_archived": 7,            // passed the bar but skipped (e.g. daily cap)
    "rejected": 1,                         // failed the bar
    "blockers": [],                        // string[]: problems that stopped or degraded the run
    "archive_folder": "2026-10-17_144052_Asia-Shanghai"
  },
  "featured": [                            // 0-3 items. [] shows "No new repos worth recommending today."
    {
      "full_name": "obra/superpowers",     // owner/name
      "url": "https://github.com/obra/superpowers",
      "stars": 300811,                     // integer
      "rating": 5,                         // integer 1-5
      "license": "MIT",                    // SPDX id, or "" if none
      "reason": "Why it's worth attention (1-3 sentences).",
      "ideas": ["…", "…", "…", "…", "…"]   // exactly 5 strings
    }
  ],
  "archived": [                            // 0-5 items
    {
      "full_name": "mksglu/context-mode",
      "url": "https://github.com/mksglu/context-mode",
      "stars": 30319,
      "rating": 5,                         // integer 1-5
      "license": "Elastic-2.0",
      "commit_sha": "5f6298a9bdc480ebc7c88a29c9fbdf38ae2f8cb6", // full 40-char SHA archived
      "status": "upgraded",                // "saved" | "upgraded" | "relocated" | "unchanged" | "incomplete"
      "size_mb": 34.1,                     // number (MB)
      "description": "Repo description."
    }
  ],
  "trending": [                            // ALL observed repos, any length
    {
      "rank": 1,                           // position on the trending page, 1-based
      "full_name": "anthropics/claude-plugins-official",
      "url": "https://github.com/anthropics/claude-plugins-official",
      "stars": 40872,
      "stars_today": 1552,
      "language": "Python",                // string or null
      "description": "…",
      "decision": "archived",              // "archived" | "eligible_not_archived" | "rejected" (other strings are shown as-is)
      "decision_reason": "Short reason for the decision."
    }
  ],
  "news": [                                // any length (publisher caps at 40). File order = display order (ranked)
    {
      "title": "Claude reveals ECDSA curve origins",
      "url": "https://www.anthropic.com/research/ecdsa-curve-origins",
      "source": "Hacker News",             // e.g. "Hacker News" | "Lobsters". Drives the source filter
      "points": 852,                       // optional number
      "comments": 316,                     // optional number
      "comments_url": "https://news.ycombinator.com/item?id=…", // optional
      "published_at": "2026-10-17T04:12:00+08:00", // ISO 8601
      "tags": ["ai", "security"],          // string[], lowercase. Drives the tag filter
      "summary": "Optional short text."    // optional
    }
  ],
  "news_highlights": [                     // 0-5 recommended. Shown in the "Why it matters" rail
    {
      "title": "…",
      "url": "https://…",
      "why_it_matters": "One or two sentences."
    }
  ]
}
```

### `public/data/history/index.json`

An array of every published day, **newest first**. Each `date` must have a matching
`history/YYYY-MM-DD.json`.

```json
[
  {
    "date": "2026-10-17",
    "featured": ["obra/superpowers", "anthropics/claude-plugins-official", "HKUDS/CLI-Anything"],
    "archived_count": 5
  }
]
```

The History section shows this as a timeline and a date picker. Picking a date loads that day's
file and swaps the whole page to it. `?date=YYYY-MM-DD` deep-links to a past day.

## Seed data

`public/data` holds the real 2026-10-17 run, published with
`python3 scripts/publish.py --run scripts/examples/run.example.json`. That file is the Mac
`run-summary.json` for folder `2026-10-17_144052_Asia-Shanghai` converted with `--convert`, and it
is a working example of the simple input format.
