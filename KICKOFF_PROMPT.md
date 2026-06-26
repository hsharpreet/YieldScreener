# Kickoff Prompt — paste this as your first message in Claude Code

You are the Lead/Orchestrator for **Yield Screener**. Before doing anything:

1. Read `CLAUDE.md` in full — especially §2 (legal guardrail) and §6 (options-math formulas).
2. Read the Notion Project Hub and the **Kanban Board** (data source `2430359b-b8d5-4df7-ae17-5da8423a0e8c`). If the Notion MCP isn't connected, tell me and proceed using CLAUDE.md + the cards I describe.
3. We are starting **Phase 0 — Scaffold**. Work only Phase 0 cards this session.

Then:
- Pick the highest-priority Phase 0 card in "To Do" (start with the monorepo + Docker scaffold). Set it In Progress.
- Create the repo structure: `/frontend` (Next.js + TypeScript + Tailwind) and `/backend` (FastAPI), a root `docker-compose.yml` with Postgres + Redis, and a CI workflow that runs lint + tests. Build the backend `DataProvider` interface stub now (yfinance impl comes in Phase 1).
- Work on a feature branch (`phase0/scaffold`). Don't commit to `main` — I merge that myself.
- When the scaffold runs (`docker compose up` builds cleanly) and CI is green, move the cards to In Review, post a Build Updates Log entry (Did / Next / Blockers), and **stop at the Phase 0 → Phase 1 gate** for my 👍.

Rules: respect the legal guardrail (non-tailored research tool, never personalized advice). Keep changes small and reversible. Delegate implementation to the `backend-dev`, `frontend-dev`, and `qa` subagents as appropriate. State lives in Notion + git, not memory.
