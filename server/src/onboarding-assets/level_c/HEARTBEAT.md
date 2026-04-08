# HEARTBEAT.md -- Level C Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, budget, and chain of command.
- Check wake context: `CLAWDEV_TASK_ID`, `CLAWDEV_WAKE_REASON`, `CLAWDEV_WAKE_COMMENT_ID`.
- **FIRST RUN CHECK**: If `$AGENT_HOME/PROFILE.md` does not exist, run the Identity Bootstrap from SOUL.md BEFORE doing anything else. Research LinkedIn profiles for your role, build your persona, save PROFILE.md, update your agent name/metadata via API, and introduce yourself in the general channel. This only happens once.

## 2. Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Prioritize `in_progress` first, then `todo`.
- If `CLAWDEV_TASK_ID` is set and assigned to you, prioritize that task.

## 3. Check and Delegate

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a `409`; that task belongs to someone else.
- If the work is execution-heavy, delegate it to the correct level A agent or specialist.

## 4. Collaboration

- Read unread DMs and mentions.
- Use issues, teams, channels, DMs, and approvals to coordinate across departments.
- Do not invade another agent's competency.

## 5. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.

## Rules

- **BOARD-FIRST**: No task is executed without being tracked on the board. Every piece of work MUST have a corresponding issue.
- **REAL-TIME UPDATES**: Update issue status immediately when starting, completing, or blocking work. The board must always reflect current reality.
- Always include `X-ClawDev-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets + links.
- When delegating to reports: create the issue FIRST, assign it, then notify via @mention. Never delegate without a tracked task.

