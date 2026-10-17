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

## Daily job: how to publish a day

Every day at about 10:00 Asia/Shanghai the automated job should:

1. Write the day's report to `public/data/latest.json`.
2. Write an identical copy to `public/data/history/YYYY-MM-DD.json`.
3. Add or replace that date's entry in `public/data/history/index.json`. Keep it sorted newest first.
4. Optionally run `npm run validate`, then commit and push to `main`. The Pages workflow redeploys in
   about 1 minute. It also runs the validator, which fails the deploy only on unparseable JSON or a
   missing/invalid `date`/`generated_at`, so the previous day's site stays live in that case. Other
   problems are printed as warnings.

The front end is defensive: missing arrays render as empty states, missing numbers as 0.
`latest.json` is fetched with `cache: no-cache`, so a new push shows up straight away.

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
  "news": [                                // any length. The UI sorts by points
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

### News sources used for the seed

- Hacker News: `https://hacker-news.firebaseio.com/v0/topstories.json`, then `/v0/item/<id>.json`
  (`score` becomes `points`, `descendants` becomes `comments`, `time` becomes `published_at`).
- Lobsters: `https://lobste.rs/hottest.json` (`score`, `comment_count`, `comments_url`, `created_at`, `tags`).

## Seed data

The committed data is the real 2026-10-17 run (folder `2026-10-17_144052_Asia-Shanghai`, 13
trending observed, 5 archived, 7 eligible but not archived because of the daily cap, 1 rejected)
plus live HN/Lobsters items fetched that day, so `"sample": false`.
