# Yield Screener

A quality-first covered-call screener: find a fundamentally strong stock you'd happily hold, then surface the best covered call to write on it for consistent monthly income. One funnel — quality filter → best covered call per surviving stock.

> Educational research tool, **not** investment advice. See CLAUDE.md §2.

## Command center (Notion)

The build is planned and tracked in Notion — start at the **[Project Hub](https://app.notion.com/p/38b25c2ad4f081709ffafa608d13aadd)** (PRD, Kanban, Build Updates Log, Testing Report, Decisions Log).

## Building with Claude Code

This repo is wired for agentic development with Claude Code:

- `CLAUDE.md` — project rules, stack, options-math formulas, agent workflow, legal guardrail.
- `.claude/agents/` — the four personas: `lead`, `backend-dev`, `frontend-dev`, `qa`.
- `.claude/settings.json` — hooks that auto-commit + log each completed work block.
- `.claude/hooks/on_work_done.py` — the commit/push/Notion-log script (stdlib only).

To start, open this folder in VS Code with the Claude Code extension and paste the kickoff prompt (`KICKOFF_PROMPT.md`).

### Optional Notion automations
- **Card moves:** connect the Notion MCP to Claude Code (`/mcp`) and the agents move Kanban cards automatically.
- **Auto log entries:** create a Notion internal integration, share the Hub with it, and set `NOTION_TOKEN`. The hook then appends to the Build Updates Log on every commit.
