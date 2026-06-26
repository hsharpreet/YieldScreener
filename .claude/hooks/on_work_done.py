#!/usr/bin/env python3
"""
Yield Screener — work-block hook.

Fires on Claude Code's Stop and SubagentStop events. It:
  1. Stages all changes and commits them (skips cleanly if there's nothing to commit).
  2. Pushes the current branch (best-effort; never fails the hook if push fails).
  3. If NOTION_TOKEN is set, appends a timestamped entry to the Notion
     "Build Updates Log" page so the board stays in sync automatically.

Cross-platform (Windows/macOS/Linux), stdlib only — no pip install needed.

Setup for the optional Notion logging:
  1. Create a Notion internal integration at https://www.notion.so/my-integrations
  2. Share the Project Hub page with that integration (Notion: ... > Connections).
  3. Set the env var before launching Claude Code:
       Windows (PowerShell):  setx NOTION_TOKEN "secret_xxx"
       macOS/Linux (bash):    export NOTION_TOKEN="secret_xxx"
Git always works even without the token.
"""

import json
import os
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Notion "Build Updates Log" page id (from the Project Hub).
BUILD_LOG_PAGE_ID = "38b25c2a-d4f0-8133-91a2-e4740fed1b01"
NOTION_VERSION = "2022-06-28"


def run(cmd):
    """Run a shell command, return (exit_code, stdout, stderr)."""
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def read_event():
    """Read the hook event JSON from stdin (best effort)."""
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def current_branch():
    code, out, _ = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    return out if code == 0 else "unknown"


def has_changes():
    code, out, _ = run(["git", "status", "--porcelain"])
    return code == 0 and bool(out)


def summarize(event):
    """Build a short message from Claude's last message, if available."""
    msg = (event.get("last_assistant_message") or "").strip()
    if not msg:
        return "work block"
    first_line = msg.splitlines()[0].strip()
    return (first_line[:140] + "…") if len(first_line) > 140 else first_line


def git_commit_and_push(summary, branch):
    run(["git", "add", "-A"])
    msg = f"chore(agent): {summary}\n\nCo-Authored-By: Claude <noreply@anthropic.com>"
    code, _, err = run(["git", "commit", "-m", msg])
    if code != 0:
        # Nothing to commit, or commit failed — nothing more to do.
        return False
    # Best-effort push; don't fail the hook if the remote/branch isn't ready.
    run(["git", "push", "-u", "origin", branch])
    return True


def notion_log(summary, branch):
    token = os.environ.get("NOTION_TOKEN")
    if not token:
        return
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    text = f"[{ts}] ({branch}) — {summary}"
    body = {
        "children": [
            {
                "object": "block",
                "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [
                        {"type": "text", "text": {"content": text}}
                    ]
                },
            }
        ]
    }
    url = f"https://api.notion.com/v1/blocks/{BUILD_LOG_PAGE_ID}/children"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="PATCH")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        # Never let a Notion hiccup break the build loop.
        print(f"[on_work_done] Notion log skipped: {e}", file=sys.stderr)


def main():
    event = read_event()
    # Only act if we're inside a git repo.
    code, _, _ = run(["git", "rev-parse", "--is-inside-work-tree"])
    if code != 0:
        return
    if not has_changes():
        return
    branch = current_branch()
    summary = summarize(event)
    committed = git_commit_and_push(summary, branch)
    if committed:
        notion_log(summary, branch)


if __name__ == "__main__":
    main()
