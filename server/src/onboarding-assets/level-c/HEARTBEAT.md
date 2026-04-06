# HEARTBEAT.md -- Level C Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, budget, and chain of command.
- Check wake context: `CLAWDEV_TASK_ID`, `CLAWDEV_WAKE_REASON`, `CLAWDEV_WAKE_COMMENT_ID`.

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

