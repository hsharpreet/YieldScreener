# Yield Screener — Project Context (CLAUDE.md)

This file is the single source of truth for how agents work on this project. Read it fully at the start of every session.

Repo: https://github.com/hsharpreet/YieldScreener

---

## 1. What we're building

A **quality-first covered-call screener**. The user finds a fundamentally strong, "buy-and-hold" stock, then we surface the single best covered call to write on it for consistent monthly income. **One funnel** — not TradingView in one tab and ThetaScanner in another.

Core job-to-be-done: *"Find a stock I'd happily own, buy 100 shares, write a covered call for monthly income, repeat. If assigned: premium + gains. If not: keep the shares, keep writing."*

The differentiator: **fundamentals filter (quality) → automatically rank the best covered call per surviving stock.** Most tools screen options OR stocks; we fuse them.

---

## 2. Legal guardrail (NON-NEGOTIABLE — applies to every feature and every user-facing string)

This product is a **non-tailored research/data tool** relying on the Canadian NI 31-103 s.8.25 exemption. It is **NOT** registered investment advice.

- NEVER personalize a recommendation to an individual's portfolio, risk profile, or situation.
- Rank the same data the same way for everyone (a screener, not an advisor).
- "Educational information, not investment advice" disclaimer must render on every screen and at signup.
- Never use language like "you should buy", "guaranteed", "risk-free", or "income without risk". The honest framing is: *"consistent income on quality stocks you'd want to hold anyway."* A covered call premium cushions a small dip; it is NOT downside insurance.
- A human + Canadian securities lawyer must sign off before charging real money (Kanban card: "GATE: Canadian securities lawyer review").

If a task would require crossing this line, STOP and flag it instead of proceeding.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js / React (web-first) |
| Backend | Python FastAPI (the options-math engine) |
| Database | Postgres (users, watchlists, saved screeners) |
| Cache | Redis (cache option chains; scheduled refresh — never hit the data API on every page load) |
| Billing | Stripe (Quebec-compliant auto-renewal notices) |
| Data (dev/MVP) | yfinance (free, 15-min delayed) |
| Data (launch) | Swap to marketdata.app (recommended) or Tradier, behind a `DataProvider` interface so the swap is one module |
| Deploy | Docker on the user's Hostinger VPS, new domain |

Build the data layer behind a `DataProvider` abstraction from day one so yfinance → marketdata.app is a single implementation swap.

---

## 4. Repo & git conventions

- Work on **feature branches** named `phase{N}/{short-task-slug}` (e.g. `phase1/options-math-engine`). Never commit directly to `main`.
- Commits are made automatically by the Stop/SubagentStop hook (`.claude/hooks/on_work_done.py`). Keep changes coherent so each commit maps to a unit of work.
- The human merges branches to `main` manually (their review gate). Do NOT merge to `main` yourself.
- Every options-math function ships with a unit test in the same PR.

---

## 5. Agent roster & the work loop

The **interactive session is the Lead/Orchestrator**. It plans, delegates to the worker subagents, reviews, and keeps the board current. Subagents live in `.claude/agents/`:

- `lead` — planning/decomposition/review pass (decompose epics, sanity-check before review).
- `backend-dev` — FastAPI, options-math engine, data integration, caching.
- `frontend-dev` — React screener, accordion detail view, customizable columns.
- `qa` — tests (options math is mandatory to test) + the CI gate.

**The loop for every card (follow exactly):**
1. Read the Kanban card + the relevant PRD section.
2. If the Notion MCP is connected (see §7), set the card to **In Progress**.
3. Implement on a feature branch. Write/extend tests.
4. Run the test gate (lint + tests). Do not leave it red.
5. Set the card to **In Review** (or note it for the human). The hook auto-commits + pushes + logs.
6. Post a Build Updates Log entry: *Did / Next / Blockers*. Then stop.

**Phase gates:** do NOT start the next Phase without an explicit human 👍. At a phase boundary, post a summary and stop. Work autonomously *within* a phase.

State lives in **Notion + git, never in agent memory.** When a session runs out of tokens, the next session re-reads CLAUDE.md + the Kanban + the Build Updates Log and continues.

---

## 6. Options-math formulas (CROWN JEWEL — implement exactly, test exhaustively)

For a covered call: own 100 shares at `price`, sell 1 call at `strike`, premium `premium` (per share), `dte` days to expiration.

| Metric | Formula |
|---|---|
| Net Credit ($) | `premium * 100` |
| Static Yield % (if not called) | `premium / price` |
| Annualized Static % | `(premium / price) * (365 / dte)` |
| Downside Cushion % | `premium / price`  (breakeven = `price - premium`) |
| If-Called Profit ($) | `(premium + (strike - price)) * 100` |
| If-Called Return % | `(premium + (strike - price)) / price` |
| Annualized If-Called % | `If-Called Return % * (365 / dte)` |

Worked example (golden test): price 100, premium 4, strike 105, dte 28 → Net Credit $400; Static 4.00%; Annualized ~52%; If-Called $900 / 9.00% / ~117%; Breakeven $96.
ITM edge case: price 100, premium 7, strike 95, dte 28 → If-Called Profit `(7 + (95-100))*100 = $200`. The `(strike - price)` term goes negative when the call is in-the-money — handle the sign correctly.

Always label annualized figures "illustrative" (naive linear; assumes flawless repetition). Exclude zero-bid / wide-spread contracts. Flag any contract whose `dte` spans an earnings date.

---

## 7. Notion integration (the build's command center)

Hub: https://app.notion.com/p/38b25c2ad4f081709ffafa608d13aadd

| Page / DB | ID |
|---|---|
| Kanban — data source (query/update cards here) | `2430359b-b8d5-4df7-ae17-5da8423a0e8c` |
| Kanban — database | `aa9880c7f85644b29825cde9282cbaa3` |
| Build Updates Log (append standups here) | `38b25c2a-d4f0-8133-91a2-e4740fed1b01` |
| PRD / Product Spec | `38b25c2a-d4f0-8124-9078-dc9b59f3798b` |
| Testing Report | `38b25c2a-d4f0-810a-b914-fc8852c62d37` |
| Decisions Log | `38b25c2a-d4f0-8120-99d2-dc99254bf9db` |

Two optional Notion automations (git works without either):
- **Automated card moves** need the Notion MCP connected to Claude Code. If connected, the agent moves cards via MCP. If not, the human moves cards (acceptable for MVP).
- **Automated log entries** need a `NOTION_TOKEN` env var (a Notion internal integration token, with the Hub shared to that integration). The hook then appends a timestamped entry to the Build Updates Log. See `.claude/hooks/on_work_done.py`.

---

## 8. Coding standards

- Backend: type hints, FastAPI routers per domain, pydantic models, pytest. Options-math lives in a pure, side-effect-free module that QA can test in isolation.
- Frontend: TypeScript, components small and composable, Tailwind. The default screener view is clean; detail lives in the click-to-expand accordion row.
- Secrets in `.env` (gitignored). Never commit keys.
- Small, reversible changes. If unsure, prefer the safer path and leave a note in the Build Updates Log.

---

## 9. Current site structure (as of 2026-06-26)

| Route | Component | Notes |
|---|---|---|
| `/` | `src/app/page.tsx` | Marketing landing page — will be replaced by claude.ai/design output |
| `/screener` | `src/app/screener/page.tsx` → `ScreenerPage` | Main app — keep all logic here |
| `/login` | `src/app/login/page.tsx` | Auth |
| `/signup` | `src/app/signup/page.tsx` | Auth + disclaimer text |
| `/account` | `src/app/account/page.tsx` | Tier display, upgrade CTA |

NavBar: `src/components/NavBar.tsx` — Logo→/, Screener, Pricing, Account, Login/Signup

---

## 10. Data layer notes (yfinance rate limiting)

yfinance hits `query2.finance.yahoo.com` and gets 429 errors when > ~20 requests/minute burst.

**Mitigations in place:**
- `get_quote()` Redis-cached 30 min (was uncached)
- `get_call_options()` Redis-cached 15 min
- Redis volume is persistent (`redis_data` Docker volume — survives restarts)
- Startup cache pre-warmer: daemon thread fetches all 20 default tickers at 3s gaps on app startup
- Inter-ticker delay in screener endpoint: 1.5s
- Retry on 429: 2s then 4s backoff in `_fetch_quote()`
- `DEFAULT_UNIVERSE` = 20 tickers (trimmed from 35)

**Real fix at launch:** swap `YFinanceProvider` for `MarketDataProvider` (marketdata.app or Tradier). The `DataProvider` ABC is ready — one module swap.

---

## 11. Phase 3 — next session task (design integration)

Harry is getting a landing page design from **claude.ai/design**. On next session start:

1. Receive design package (React code or screenshots) from Harry
2. Integrate as new `src/app/page.tsx` — replace the placeholder landing page
3. Wire design's Login / Sign Up / Account CTAs to `/login`, `/signup`, `/account`
4. The `/screener` route and all backend code stays unchanged
5. After design merge: add Greeks/IV Rank columns to ScreenerTable, then deploy to Hostinger VPS (CC-23)

**How Harry provides the design:** claude.ai/design → generate/build landing page → Export or Share → copy React/HTML → paste into chat. Screenshots also work (Claude Code reads images).

**Do NOT start VPS deployment until design is merged and Harry approves.**
