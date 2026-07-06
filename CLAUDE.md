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

## 9. Current site structure (as of 2026-06-27)

| Route | Component | Notes |
|---|---|---|
| `/` | `src/app/page.tsx` | **NEW** claude.ai/design landing page (dark navy + teal). Has own nav + footer. |
| `/screener` | `src/app/screener/page.tsx` → `ScreenerPage` | Main app — keep all logic here |
| `/login` | `src/app/login/page.tsx` | Auth |
| `/signup` | `src/app/signup/page.tsx` | Auth + disclaimer text |
| `/account` | `src/app/account/page.tsx` | Tier display, upgrade CTA |

NavBar: `src/components/NavBar.tsx` — rendered via `ConditionalNavBar.tsx` which hides it on `/` (the landing page has its own nav).
Footer: likewise via `ConditionalFooter.tsx`.

Design inspiration for the screener UI: `Inspiration/` folder — FinViz.png, Trading View.png, thetascanner.png, Filter Screenshot.png.
Screener filter bar: TradingView-style horizontal chips with preset value dropdowns (see §11 below).

---

## 10. Data layer notes (yfinance rate limiting)

yfinance hits `query2.finance.yahoo.com` and gets 429 errors when > ~20 requests/minute burst.

**Mitigations in place (as of 2026-06-27):**
- `get_quote()` Redis-cached 30 min
- `get_call_options()` Redis-cached 15 min
- Redis volume is persistent (`redis_data` Docker volume — survives restarts)
- Startup cache pre-warmer warms BOTH quotes AND option chains (3s gap between tickers, 3s gap before chain fetch per ticker) — root cause of 429s was option chains not being pre-warmed
- Inter-ticker delay in screener endpoint: 1.5s
- Inter-expiry delay inside `_fetch_call_options()`: 0.4s between each `option_chain()` HTTP call
- Expiry dates filtered BEFORE fetching chains (avoids wasted HTTP calls for out-of-range dates)
- Retry on 429: 2s then 4s backoff in `_fetch_quote()`
- `DEFAULT_UNIVERSE` = 21 tickers

**Real fix at launch:** swap `YFinanceProvider` for `MarketDataProvider` (marketdata.app or Tradier). The `DataProvider` ABC is ready — one module swap.

---

## 11. Phase 3 — status & next steps

### Completed 2026-06-27
1. **Landing page** — `src/app/page.tsx` replaced with full claude.ai/design conversion. Dark navy + teal. Own nav/footer. Auth wired to `/login`, `/signup`, `/account`. "Open Screener" → `/screener`.
2. **Layout restructure** — `ConditionalNavBar` + `ConditionalFooter` so global nav/footer hide on `/`.
3. **API rate-limit fix** — warm cache now covers option chains; inter-expiry delay added.
4. **Screener UI redesign** — frontend-dev agent converting FilterRail to TradingView-style horizontal filter chips with preset value dropdowns (DTE, Market Cap, P/E, Beta, Sector). Dark theme (#0f1724). Status: pending agent output + Harry approval.

### Completed 2026-07-06 (branch claude/options-strategy-screener-fqnm81)
5. **Greeks/IV Rank columns (CC-22)** — Delta + IV Rank in table & accordion; delta estimated via Black-Scholes (`app/options/greeks.py`) when the provider has no Greeks (yfinance).
6. **All three strategies live** — Covered Call, Cash-Secured Put, PMCC. Strategy segmented control wired; per-strategy math in `app/options/math.py` (CSP: yield-on-collateral, breakeven, discount; PMCC: long-LEAPS selection by min extrinsic, assignment-safe width rule). Puts cached from the same option_chain() calls (zero extra HTTP); LEAPS cached 6 h.
7. **Greek filters** — |delta| min/max + IV Rank filter chips (work for calls and puts); presets incl. "Deep ITM ≥ 0.75" for PMCC longs.
8. **All "Coming Soon" filters implemented** — EPS Growth, Quick Ratio, Avg Volume, RSI(14), 52W range position, SMA50/SMA200 (technicals computed by scheduler from one batched daily download, cached 24 h).
9. **Docker fix** — `frontend/public/` now exists in git (robots.txt); `COPY /app/public` no longer fails the frontend image build.
10. Test suite: 119 backend tests green; ruff, tsc, eslint, next build clean.

### Remaining for Phase 3
- Harry reviews strategy screener (CSP + PMCC + Greek/technical filters)
- Deploy to Hostinger VPS (CC-23) — **BLOCKED until screener is approved**
- GATE: Canadian securities lawyer review before charging real money

### Screener filter presets (for reference)
When implementing filter dropdowns, always provide preset options with descriptive labels (per Finviz style):
- **P/E**: Very low ≤5 / Low ≤15 / Moderate ≤25 / High ≤35 / Very high ≤50
- **DTE**: Near-term 7–21 / Standard 21–45 / Extended 45–60
- **Market Cap**: Small $1B+ / Mid $5B+ / Large $20B+ / Mega $100B+
- **Beta**: Low ≤0.8 / Moderate ≤1.2 / High ≤1.5
- **Sector**: multi-select checkboxes for all 11 GICS sectors

**Do NOT start VPS deployment until screener redesign is Harry-approved.**
