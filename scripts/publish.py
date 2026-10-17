#!/usr/bin/env python3
"""
AI Daily Radar publisher.

Builds public/data/latest.json + history/YYYY-MM-DD.json, updates history/index.json,
validates, then commits and pushes to main (which redeploys GitHub Pages).

  python3 scripts/publish.py --run run.json            # full publish (simple input OR Mac run-summary.json)
  python3 scripts/publish.py --news-only               # refresh only the news in latest.json (+ today's history file)
  python3 scripts/publish.py --convert run-summary.json > run.json   # Mac run-summary -> simple input
  add --no-push to build + validate + commit locally only, --dry-run to write nothing.

Stdlib only (Python 3.9+). Input format: see README.md "Publishing pipeline".
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import email.utils
import html
import json
import math
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
TZ = dt.timezone(dt.timedelta(hours=8))
UA = "ai-daily-radar-publisher/1.0 (+https://github.com/MacApex/ai-daily-radar)"
NEWS_CAP = 40
ARCHIVE_STATUSES = ("saved", "upgraded", "relocated", "unchanged", "incomplete")
DECISIONS = ARCHIVE_STATUSES + ("eligible_not_archived", "rejected")
HFC = os.environ.get("HACKER_FEEDS_CLI", "cli-anything-hacker-feeds-cli")
RSS_FEEDS = [
    ("GitHub Blog", "https://github.blog/feed/"),
    ("Simon Willison", "https://simonwillison.net/atom/everything/"),
    ("Hugging Face", "https://huggingface.co/blog/feed.xml"),
]


def log(*a):
    print("[publish]", *a, file=sys.stderr)


def now8() -> dt.datetime:
    return dt.datetime.now(TZ).replace(microsecond=0)


def iso8(d: dt.datetime) -> str:
    return d.astimezone(TZ).replace(microsecond=0).isoformat()


# ───────────────────────────── HTTP helpers ─────────────────────────────

def http_get(url: str, timeout: int = 20, headers: dict | None = None) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def http_json(url: str, **kw):
    return json.loads(http_get(url, **kw))


_gh_cache: dict[str, dict] = {}


def gh_repo(full_name: str) -> dict:
    """Repo metadata from the GitHub API (uses GH_TOKEN/GITHUB_TOKEN if set). Never raises."""
    if full_name in _gh_cache:
        return _gh_cache[full_name]
    headers = {"Accept": "application/vnd.github+json"}
    tok = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    try:
        d = http_json(f"https://api.github.com/repos/{full_name}", headers=headers, timeout=15)
    except Exception as e:  # noqa: BLE001
        log(f"github api {full_name}: {e}")
        d = {}
    _gh_cache[full_name] = d
    return d


# ───────────────────────────── run input ─────────────────────────────

def norm_decision(action: str) -> str:
    a = (action or "").strip().lower()
    if a.startswith("eligible"):
        return "eligible_not_archived"
    if a.startswith("updated") or a.startswith("upgrade"):
        return "upgraded"
    for s in DECISIONS:
        if a.startswith(s):
            return s
    return "rejected" if "reject" in a else a.replace(" ", "_") or "unknown"


def norm_license(lic: str | None) -> str:
    if not lic:
        return ""
    s = str(lic).strip()
    if re.search(r"elastic license 2\.0|elv2", s, re.I):
        return "Elastic-2.0"
    s = re.split(r"\s+\(|;", s)[0].strip()
    if s.upper() in ("NOASSERTION", "NONE", "NULL", "OTHER"):
        return ""
    if " " in s:  # free text such as "README states MIT" -> "MIT (README)"
        m = re.search(r"\b(MIT|Apache-2\.0|[AL]?GPL-[\d.]+(?:-only|-or-later)?|BSD-[\w-]+|MPL-2\.0|ISC|Unlicense)\b", s, re.I)
        return (m.group(1) + (" (README)" if "readme" in s.lower() else "")) if m else s
    return s


def convert_mac_summary(src: dict) -> dict:
    """Mac archive job's run-summary.json -> simple publisher input."""
    rows = src.get("rows") or []
    counts = src.get("counts") or {}
    folder = Path(src.get("run_directory") or counts.get("run_directory") or "").name
    feat_ideas = src.get("featured") or {}
    if isinstance(feat_ideas, list):  # tolerate list form
        feat_ideas = {f["full_name"]: f.get("ideas", []) for f in feat_ideas}
    order = counts.get("featured") or list(feat_ideas.keys())
    by_name = {r.get("repository"): r for r in rows}
    repos = []
    for r in rows:
        size = r.get("tracked_source_bytes")
        repos.append({
            "full_name": r.get("repository") or r.get("canonical_identity"),
            "rank": r.get("trending_rank"),
            "stars": r.get("github_stars"),
            "stars_today": r.get("stars_today_on_page"),
            "decision": norm_decision(r.get("action", "")),
            "reason": r.get("reason", ""),
            "rating": r.get("rating"),
            "license": norm_license(r.get("license")),
            "commit_sha": r.get("archived_commit") or "",
            "size_mb": round(size / 1048576, 1) if isinstance(size, (int, float)) else None,
        })
    m = re.match(r"(\d{4}-\d{2}-\d{2})", folder)
    blockers = list(src.get("blockers") or [])
    return {
        "date": m.group(1) if m else None,
        "run_at": src.get("generated_at") or counts.get("time"),
        "archive_folder": folder,
        "blockers": blockers,
        "repos": repos,
        "featured": [
            {"full_name": n, "reason": (by_name.get(n) or {}).get("reason", ""), "ideas": list(feat_ideas.get(n) or [])}
            for n in order if n in feat_ideas
        ][:3],
    }


def load_run(path: str) -> dict:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if "rows" in raw and "repos" not in raw:
        log("detected Mac run-summary.json format, converting")
        return convert_mac_summary(raw)
    return raw


def build_repo_sections(run: dict):
    repos = [dict(r) for r in run.get("repos") or []]
    # enrich missing description/language/stars/license from GitHub (parallel)
    need = [r for r in repos if not r.get("description") or "language" not in r or r.get("stars") is None]
    with cf.ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda r: gh_repo(r["full_name"]), need))
    for r in repos:
        g = _gh_cache.get(r["full_name"], {})
        r.setdefault("description", g.get("description") or "")
        if not r.get("description"):
            r["description"] = g.get("description") or ""
        if "language" not in r:
            r["language"] = g.get("language")
        if r.get("stars") is None:
            r["stars"] = g.get("stargazers_count", 0)
        if not r.get("license"):
            r["license"] = norm_license((g.get("license") or {}).get("spdx_id"))
        if r.get("size_mb") is None and g.get("size") is not None:
            r["size_mb"] = round(g["size"] / 1024, 1)
        r["decision"] = norm_decision(r.get("decision", ""))
    repos.sort(key=lambda r: (r.get("rank") is None, r.get("rank") or 0))

    url = lambda n: f"https://github.com/{n}"  # noqa: E731
    trending = []
    for i, r in enumerate(repos, 1):
        d = r["decision"]
        reason = r.get("reason", "")
        if d in ARCHIVE_STATUSES:
            reason = f"{d.capitalize()}: {reason}" if reason else d.capitalize()
        trending.append({
            "rank": r.get("rank") or i, "full_name": r["full_name"], "url": url(r["full_name"]),
            "stars": int(r.get("stars") or 0), "stars_today": int(r.get("stars_today") or 0),
            "language": r.get("language"), "description": r.get("description") or "",
            "decision": "archived" if d in ARCHIVE_STATUSES else d, "decision_reason": reason,
        })
    archived_src = [r for r in repos if r["decision"] in ARCHIVE_STATUSES]
    archived_src.sort(key=lambda r: (-(r.get("rating") or 0), r.get("rank") or 99))
    archived = [{
        "full_name": r["full_name"], "url": url(r["full_name"]), "stars": int(r.get("stars") or 0),
        "rating": int(r.get("rating") or 0), "license": r.get("license") or "", "commit_sha": r.get("commit_sha") or "",
        "status": r["decision"], "size_mb": float(r.get("size_mb") or 0), "description": r.get("description") or "",
    } for r in archived_src[:5]]
    by = {r["full_name"]: r for r in repos}
    featured = []
    for f in (run.get("featured") or [])[:3]:
        r = by.get(f["full_name"]) or {}
        g = gh_repo(f["full_name"]) if not r else {}
        ideas = [str(x) for x in f.get("ideas") or []]
        if len(ideas) != 5:
            log(f"WARNING featured {f['full_name']} has {len(ideas)} ideas (contract wants exactly 5)")
        featured.append({
            "full_name": f["full_name"], "url": url(f["full_name"]),
            "stars": int(f.get("stars") or r.get("stars") or g.get("stargazers_count") or 0),
            "rating": int(f.get("rating") or r.get("rating") or 0),
            "license": f.get("license") or r.get("license") or norm_license((g.get("license") or {}).get("spdx_id")),
            "reason": f.get("reason") or r.get("reason") or "", "ideas": ideas[:5],
        })
    c = lambda s: sum(1 for r in repos if r["decision"] == s)  # noqa: E731
    summary = {
        "trending_observed": len(repos), "saved": c("saved"), "upgraded": c("upgraded"), "relocated": c("relocated"),
        "unchanged": c("unchanged"), "incomplete": c("incomplete"), "eligible_not_archived": c("eligible_not_archived"),
        "rejected": c("rejected"), "blockers": [str(b) for b in run.get("blockers") or []],
        "archive_folder": run.get("archive_folder") or "",
    }
    return summary, featured, archived, trending


# ───────────────────────────── news ─────────────────────────────

TAG_RULES = [
    ("ai", r"\b(ai|llms?|claude|anthropic|openai|gemini|gpt[\w.-]*|chatgpt|models?|transformers?|ml|mlx|llama|gguf|diffusion|flux|agents?|agentic|copilot|deepseek|qwen|mistral|hugging ?face|inference|rag|mcp|embeddings?|fine-?tun\w*|benchmarks?|neural|vibecoding|machine learning)\b"),
    ("security", r"\b(security|exploit\w*|vulnerab\w*|cve|bug bounty|ecdsa|crypto(graphy)?|firmware|malware|bypass\w*|attack\w*|breach|ransomware|privacy|auth\w*)\b"),
    ("programming", r"\b(c\+\+|c23|rust|golang|go\b|python|typescript|javascript|lean|haskell|zig|compiler|programming|pytorch|concurren\w*|refactor\w*|testing|tests?|debug\w*|api|sdk|library|framework|git|open source)\b"),
    ("web", r"\b(jpeg|avif|web|browser|css|html|http|react|frontend|wasm|webassembly)\b"),
    ("hardware", r"\b(hardware|chips?|gpu|cpu|ps5|robots?|robotics|wifi|radio|tesla|mac studio|nvidia|semiconductor|battery|iphone|raspberry)\b"),
    ("linux", r"\b(linux|ubuntu|gnome|kde|openbsd|freebsd|kernel|debian|fedora|incus)\b"),
    ("science", r"\b(quantum|math\w*|physics|biology|chemistry|space|nasa|climate|ice|scien\w*|research)\b"),
    ("devtools", r"\b(cli|terminal|editor|vscode|neovim|ide|devops|docker|kubernetes|ci|github)\b"),
]
TAG_ALIASES = {"vibecoding": "ai", "cryptography": "security", "ml": "ai", "machinelearning": "ai",
               "artificialintelligence": "ai", "llm": "ai", "generative-ai": "ai", "openbsd": "linux",
               "rust": "programming", "go": "programming", "c": "programming", "python": "programming",
               "javascript": "programming", "release": "release", "devops": "devtools", "editors": "devtools"}


def tag_text(text: str, extra=()) -> list[str]:
    t = (text or "").lower()
    out = [k for k, rx in TAG_RULES if re.search(rx, t)]
    for e in extra:
        e = re.sub(r"[^a-z0-9+-]", "", str(e).lower())
        m = TAG_ALIASES.get(e)
        if m and m not in out:
            out.append(m)
    return out[:4] or ["misc"]


def norm_url(u: str) -> str:
    try:
        p = urllib.parse.urlsplit(u.strip())
        q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query) if not k.lower().startswith(("utm_", "ref", "fbclid", "gclid"))]
        host = p.netloc.lower().removeprefix("www.")
        path = p.path.rstrip("/") or "/"
        return f"{host}{path}" + (f"?{urllib.parse.urlencode(q)}" if q else "")
    except Exception:  # noqa: BLE001
        return u


def strip_html(s: str, n: int = 280) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return (s[: n - 1].rsplit(" ", 1)[0] + "…") if len(s) > n else s


def item(title, url, source, published, points=None, comments=None, comments_url=None, tags=(), summary=None):
    d = {"title": html.unescape(str(title)).strip().replace("\u00a0", " "), "url": url, "source": source,
         "points": points, "comments": comments, "comments_url": comments_url,
         "published_at": iso8(published) if isinstance(published, dt.datetime) else published,
         "_extra_tags": list(tags)}
    if summary:
        d["summary"] = summary
    return d


def fetch_hn_api(n=30) -> list[dict]:
    ids = http_json("https://hacker-news.firebaseio.com/v0/topstories.json")[:n]
    with cf.ThreadPoolExecutor(10) as ex:
        its = list(ex.map(lambda i: _safe(lambda: http_json(f"https://hacker-news.firebaseio.com/v0/item/{i}.json")), ids))
    out = []
    for it in its:
        if not it or it.get("type") != "story" or it.get("dead") or it.get("deleted") or it.get("descendants") is None:
            continue  # skip job ads
        hn = f"https://news.ycombinator.com/item?id={it['id']}"
        out.append(item(it["title"], it.get("url") or hn, "Hacker News", dt.datetime.fromtimestamp(it["time"], TZ),
                        it.get("score"), it.get("descendants"), hn))
    return out


def fetch_lobsters(n=25) -> list[dict]:
    out = []
    for it in http_json("https://lobste.rs/hottest.json")[:n]:
        out.append(item(it["title"], it.get("url") or it["comments_url"], "Lobsters",
                        dt.datetime.fromisoformat(it["created_at"]), it.get("score"), it.get("comment_count"),
                        it.get("comments_url"), it.get("tags") or [], strip_html(it.get("description_plain") or "") or None))
    return out


def run_hfc(*args, timeout=60):
    """Run hacker-feeds-cli in --json mode and return parsed JSON (None on failure)."""
    exe = shutil.which(HFC) or (HFC if os.path.exists(HFC) else None)
    if not exe:
        log("hacker-feeds-cli not found on PATH; skipping")
        return None
    try:
        p = subprocess.run([exe, "--json", *args], capture_output=True, text=True, timeout=timeout)
        s = p.stdout
        i = s.find("{")
        d = json.loads(s[i:]) if i >= 0 else None
        if not d or d.get("error"):
            log(f"hacker-feeds-cli {' '.join(args)}: {(d or {}).get('error') or p.stderr.strip()[:200]}")
            return None
        return d
    except Exception as e:  # noqa: BLE001
        log(f"hacker-feeds-cli {' '.join(args)} failed: {e}")
        return None


def fetch_hfc(now: dt.datetime) -> list[dict]:
    out = []
    d = run_hfc("news", "-t", "30")
    for it in (d or {}).get("items", []):
        if it.get("type") != "story" or it.get("descendants") is None:
            continue
        hn = f"https://news.ycombinator.com/item?id={it['id']}"
        out.append(item(it["title"], it.get("url") or hn, "Hacker News", dt.datetime.fromtimestamp(it["time"], TZ),
                        it.get("score"), it.get("descendants"), hn))
    d = run_hfc("lobsters", "-s", "hottest", "-c", "25")
    for it in (d or {}).get("items", []):
        out.append(item(it["title"], it.get("url") or f"https://lobste.rs/s/{it.get('id')}", "Lobsters", now,
                        it.get("score"), it.get("comments"), f"https://lobste.rs/s/{it['id']}" if it.get("id") else None,
                        it.get("tags") or []))
    d = run_hfc("devto", "-t", "ai", "-s", "top", "-c", "12")
    dates = {}
    if d and d.get("items"):  # the CLI omits dates; look them up from DEV.to's public API
        for a in _safe(lambda: http_json("https://dev.to/api/articles?tag=ai&top=7&per_page=60"), []) or []:
            dates[a.get("url")] = a.get("published_at")
    for it in (d or {}).get("items", []):
        if not dates.get(it.get("url")):
            continue  # undated -> skip rather than invent a timestamp
        tags = [t.strip() for t in str(it.get("tags") or "").split(",") if t.strip()]
        out.append(item(it["title"], it["url"], "DEV.to", dates[it["url"]], it.get("reactions"),
                        it.get("comments"), it["url"] + "#comments", tags + ["ai"], strip_html(it.get("description") or "") or None))
    return out


def _txt(el, *names):
    for n in names:
        x = el.find(n)
        if x is not None and (x.text or "").strip():
            return x.text.strip()
    return ""


def parse_date(s: str):
    if not s:
        return None
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        pass
    try:
        return email.utils.parsedate_to_datetime(s)
    except Exception:  # noqa: BLE001
        return None


def fetch_rss(name: str, url: str, max_age_h: int = 96, n: int = 4) -> list[dict]:
    root = ET.fromstring(http_get(url, timeout=25))
    A = "{http://www.w3.org/2005/Atom}"
    out = []
    entries = root.findall("./channel/item") or root.findall(f"{A}entry")
    for e in entries:
        if e.tag == "item":
            title, link = _txt(e, "title"), _txt(e, "link")
            pub = parse_date(_txt(e, "pubDate", "{http://purl.org/dc/elements/1.1/}date"))
            summ = strip_html(_txt(e, "description"))
            cats = [c.text for c in e.findall("category") if c.text]
        else:
            title = _txt(e, f"{A}title")
            ln = e.find(f"{A}link[@rel='alternate']")
            if ln is None:
                ln = e.find(f"{A}link")
            link = ln.get("href") if ln is not None else ""
            pub = parse_date(_txt(e, f"{A}published", f"{A}updated"))
            summ = strip_html(_txt(e, f"{A}summary", f"{A}content"))
            cats = [c.get("term") for c in e.findall(f"{A}category") if c.get("term")]
        if not title or not link or not pub:
            continue
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=dt.timezone.utc)
        if (now8() - pub).total_seconds() > max_age_h * 3600:
            continue
        out.append(item(title, link, name, pub, tags=cats, summary=summ or None))
        if len(out) >= n:
            break
    return out


def _safe(fn, default=None):
    try:
        return fn()
    except Exception as e:  # noqa: BLE001
        log(f"fetch failed: {e}")
        return default


SOURCE_CAPS = {"Hacker News": 20, "Lobsters": 10, "DEV.to": 4}
RSS_BASE_POINTS = 40  # editorial feeds have no votes; give them a modest baseline


def collect_news(cap: int = NEWS_CAP) -> tuple[list[dict], list[str]]:
    now = now8()
    jobs = {
        "hacker-feeds-cli": lambda: fetch_hfc(now),
        "hn-api": fetch_hn_api,
        "lobsters": fetch_lobsters,
        **{f"rss:{n}": (lambda n=n, u=u: fetch_rss(n, u)) for n, u in RSS_FEEDS},
    }
    with cf.ThreadPoolExecutor(len(jobs)) as ex:
        futs = {k: ex.submit(_safe, f, []) for k, f in jobs.items()}
        results = {k: f.result() or [] for k, f in futs.items()}
    used = [k for k, v in results.items() if v]
    for k, v in results.items():
        log(f"news source {k}: {len(v)} items")
    # merge + dedupe by normalised URL (direct API items win over CLI for timestamps/comment links)
    # the CLI's Lobsters feed has no timestamps: only use it when the direct Lobsters API failed
    if results.get("lobsters"):
        results["hacker-feeds-cli"] = [x for x in results.get("hacker-feeds-cli", []) if x["source"] != "Lobsters"]
    order = ["hn-api", "lobsters", *[k for k in results if k.startswith("rss:")], "hacker-feeds-cli"]
    merged: dict[str, dict] = {}
    by_title: dict[str, str] = {}
    for k in order:
        for it in results.get(k, []):
            key = norm_url(it["url"])
            tkey = re.sub(r"[^a-z0-9]+", " ", it["title"].lower()).strip()
            key = by_title.get(tkey, key)
            cur = merged.get(key)
            if not cur:
                merged[key] = it
                by_title.setdefault(tkey, key)
                continue
            cur["_extra_tags"] = list(dict.fromkeys(cur["_extra_tags"] + it["_extra_tags"]))
            if (it.get("points") or 0) > (cur.get("points") or 0) and it["source"] == cur["source"]:
                cur["points"], cur["comments"] = it["points"], it.get("comments")
            cur.setdefault("summary", it.get("summary"))
    items = list(merged.values())
    # score: votes decayed by age (HN-style gravity); editorial feeds get a baseline
    for it in items:
        pub = parse_date(it["published_at"]) or now
        age_h = max(0.0, (now - pub).total_seconds() / 3600)
        pts = it.get("points") if it.get("points") is not None else RSS_BASE_POINTS
        it["_score"] = (math.log1p(max(pts, 0)) + 0.35 * math.log1p(it.get("comments") or 0)) / ((age_h + 4) / 24 + 1) ** 0.8
        it["tags"] = tag_text(f"{it['title']} {it.get('summary') or ''}", it.pop("_extra_tags"))
    items.sort(key=lambda x: -x["_score"])
    out, per = [], {}
    for it in items:
        cap_s = SOURCE_CAPS.get(it["source"], 4)
        if per.get(it["source"], 0) >= cap_s:
            continue
        per[it["source"]] = per.get(it["source"], 0) + 1
        it.pop("_score")
        out.append({k: v for k, v in it.items() if v is not None})
        if len(out) >= cap:
            break
    return out, used


def auto_highlights(news: list[dict], n: int = 5) -> list[dict]:
    """Factual, template-based highlights: the most-discussed AI/security/dev stories."""
    pri = [x for x in news if set(x["tags"]) & {"ai", "security", "devtools", "programming"}] or news
    pri = sorted(pri, key=lambda x: -((x.get("points") or 0) + 2 * (x.get("comments") or 0)))
    out = []
    for x in pri[:n]:
        bits = []
        if x.get("points") is not None:
            bits.append(f"{x['points']} points")
        if x.get("comments") is not None:
            bits.append(f"{x['comments']} comments")
        topic = {"ai": "AI", "devtools": "dev-tools", "misc": "tech"}.get(x["tags"][0], x["tags"][0])
        why = (f"A top {topic} discussion on {x['source']} today ({', '.join(bits)})." if bits
               else f"New from {x['source']}.")
        if x.get("summary"):
            why += " " + strip_html(x["summary"], 180)
        out.append({"title": x["title"], "url": x["url"], "why_it_matters": why})
    return out


# ───────────────────────────── write / git ─────────────────────────────

def write_json(p: Path, obj, dry: bool):
    s = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    if dry:
        log(f"(dry-run) would write {p.relative_to(ROOT)} ({len(s)} bytes)")
        return
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding="utf-8")
    log(f"wrote {p.relative_to(ROOT)}")


def update_index(report: dict, dry: bool):
    p = DATA / "history" / "index.json"
    idx = json.loads(p.read_text()) if p.exists() else []
    idx = [e for e in idx if e.get("date") != report["date"]]
    idx.append({"date": report["date"], "featured": [f["full_name"] for f in report["featured"]],
                "archived_count": len(report["archived"])})
    idx.sort(key=lambda e: e["date"], reverse=True)
    write_json(p, idx, dry)


def sh(*cmd, check=True, capture=False):
    log("$ " + " ".join(cmd))
    return subprocess.run(cmd, cwd=ROOT, check=check, text=True, capture_output=capture)


def validate():
    sh("node", "scripts/validate-data.mjs")


def git_publish(message: str, push: bool):
    sh("git", "add", "public/data")
    if not sh("git", "status", "--porcelain", "public/data", capture=True).stdout.strip():
        log("no data changes to commit")
    else:
        env_name = sh("git", "config", "user.name", check=False, capture=True).stdout.strip()
        ident = [] if env_name else ["-c", "user.name=MacApex", "-c", "user.email=MacApex@users.noreply.github.com"]
        sh("git", *ident, "commit", "-m", message)
    if push:
        sh("git", "pull", "--rebase", "--autostash", "origin", "main")
        sh("git", "push", "origin", "HEAD:main")
        log("pushed; GitHub Pages deploy will start automatically")


# ───────────────────────────── main ─────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Publish AI Daily Radar data")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--run", help="run input JSON (simple format or Mac run-summary.json)")
    g.add_argument("--news-only", action="store_true", help="refresh only news in latest.json (+ that day's history file)")
    g.add_argument("--convert", metavar="RUN_SUMMARY", help="print the simple input converted from a Mac run-summary.json")
    ap.add_argument("--highlights", help="JSON file with news_highlights [{title,url,why_it_matters}] to use instead of auto")
    ap.add_argument("--refresh-highlights", action="store_true", help="--news-only: regenerate highlights too")
    ap.add_argument("--no-news", action="store_true", help="--run: keep news from current latest.json instead of fetching")
    ap.add_argument("--date", help="override report date YYYY-MM-DD")
    ap.add_argument("--no-push", action="store_true", help="commit locally but do not push")
    ap.add_argument("--no-commit", action="store_true", help="write + validate only")
    ap.add_argument("--dry-run", action="store_true", help="fetch and build, print summary, write nothing")
    a = ap.parse_args()

    if a.convert:
        print(json.dumps(convert_mac_summary(json.loads(Path(a.convert).read_text(encoding="utf-8"))), ensure_ascii=False, indent=2))
        return

    latest_p = DATA / "latest.json"
    current = json.loads(latest_p.read_text(encoding="utf-8")) if latest_p.exists() else {}
    highlights_override = json.loads(Path(a.highlights).read_text()) if a.highlights else None
    ts = now8()

    if a.news_only:
        if not current:
            sys.exit("latest.json not found; run a full publish first")
        news, used = collect_news()
        if not news:
            sys.exit("no news fetched from any source; leaving data untouched")
        report = {**current, "sample": False, "generated_at": iso8(ts), "news": news}
        if highlights_override is not None:
            report["news_highlights"] = highlights_override
        elif a.refresh_highlights or not current.get("news_highlights"):
            report["news_highlights"] = auto_highlights(news)
        msg = f"data: refresh news {report['date']} {ts.strftime('%H:%M')} CST ({len(news)} items)"
    else:
        run = load_run(a.run)
        run_at = parse_date(str(run.get("run_at") or "")) or ts
        date = a.date or run.get("date") or run_at.astimezone(TZ).strftime("%Y-%m-%d")
        summary, featured, archived, trending = build_repo_sections(run)
        if a.no_news and current.get("news"):
            news, used = current["news"], ["kept from latest.json"]
        else:
            news, used = collect_news()
        report = {
            "sample": False, "generated_at": iso8(ts), "date": date, "run": summary,
            "featured": featured, "archived": archived, "trending": trending, "news": news,
            "news_highlights": highlights_override if highlights_override is not None
            else (run.get("news_highlights") or auto_highlights(news)),
        }
        msg = (f"data: daily radar {date} ({summary['trending_observed']} trending, {len(archived)} archived, "
               f"{len(featured)} picks, {len(news)} news)")

    log(f"news sources used: {', '.join(used) or 'none'}")
    log(f"report {report['date']}: featured={len(report['featured'])} archived={len(report['archived'])} "
        f"trending={len(report['trending'])} news={len(report['news'])} highlights={len(report['news_highlights'])}")
    if a.dry_run:
        print(json.dumps({k: (v if k in ("run", "date", "generated_at") else len(v) if isinstance(v, list) else v) for k, v in report.items()}, indent=2))
        return
    write_json(latest_p, report, False)
    write_json(DATA / "history" / f"{report['date']}.json", report, False)
    if not a.news_only:
        update_index(report, False)
    validate()
    if not a.no_commit:
        git_publish(msg, push=not a.no_push)


if __name__ == "__main__":
    main()
