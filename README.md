# LatestNews

**Real-time community intelligence across Reddit, Hacker News, Dev.to, GitHub and DuckDuckGo. Zero API keys required.**

Search any topic and instantly see what the community is discussing — newest first — with filters, sort controls, and a ready-to-paste Claude prompt for AI synthesis.

![LatestNews screenshot](https://placeholder.com/screenshot.png)

---

## Features

| Feature | Detail |
|---|---|
| **5 live sources** | Reddit · Hacker News · Dev.to · GitHub · DuckDuckGo |
| **Zero API keys** | All sources use public/free endpoints |
| **Newest first** | Results sorted by date descending by default |
| **Filter by source** | Click any source tab to narrow results |
| **Sort: Newest / Top** | Toggle between date and engagement sorting |
| **3 search modes** | Quick (fast) · Standard · Deep (thorough) |
| **Claude prompt** | One-click copy of a synthesis prompt for any LLM |
| **Dark UI** | Navy + amber design, fully responsive |

---

## Quick start

```bash
git clone <your-repo-url>
cd latest-news
./start.sh
# → opens http://localhost:5000
```

`start.sh` will:
1. Create a Python venv and install `flask flask-cors`
2. Build the React frontend (first run only, ~10s)
3. Start the server at **http://localhost:5000**

---

## Development mode (hot reload)

Open two terminals:

```bash
# Terminal 1 — Python API
cd latest-news
source .venv/bin/activate
python backend/app.py

# Terminal 2 — React dev server (proxies /api → :5000)
cd latest-news/frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## API reference

```
GET /api/search

Params:
  q        (required) Search topic
  mode     quick | standard | deep   (default: standard)
  sources  comma list: reddit,hn,devto,github,ddg  (default: reddit,hn,devto,github)

Response JSON:
  articles[]     Normalised articles, sorted newest first
  stats          total, upvotes, comments
  sources_found  per-source result counts
  claude_prompt  Ready-to-paste LLM synthesis prompt
```

Example:
```
http://localhost:5000/api/search?q=SAP+SuccessFactors&mode=standard&sources=reddit,hn,devto
```

---

## Sources

| Key | Name | API |
|---|---|---|
| `reddit` | Reddit | `reddit.com/search.json` (public) |
| `hn` | Hacker News | Algolia HN search (free) |
| `devto` | Dev.to | `dev.to/api/articles` (free) |
| `github` | GitHub | `api.github.com/search/repositories` (60 req/hr) |
| `ddg` | DuckDuckGo | HTML scrape |

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.10+ · Flask · flask-cors |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS 3 |
| Fonts | Inter · Fira Code (Google Fonts) |

---

## Project structure

```
latest-news/
├── backend/
│   ├── app.py          ← Flask API + all 5 source scrapers
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx               ← Main app + search logic
│   │   ├── types.ts              ← Shared TypeScript types
│   │   ├── api.ts                ← fetch wrapper
│   │   └── components/
│   │       ├── ResultCard.tsx    ← Individual article card
│   │       ├── StatsBar.tsx      ← Stats pills + source/sort filters
│   │       ├── ClaudePromptBox.tsx ← Collapsible prompt copy box
│   │       └── LoadingCards.tsx  ← Skeleton loading state
│   └── ...config files
├── start.sh            ← One-command startup
└── README.md
```

---

*No API keys. No tracking. 100% open-source.*

## Saved Searches

Searches can now be pinned in the browser as **Saved** topics. This is useful for recurring monitoring themes such as SAP SuccessFactors, AI agents, or UK mortgage rates. Saved searches live in `localStorage`, require no account, and can be removed from the chip list.
