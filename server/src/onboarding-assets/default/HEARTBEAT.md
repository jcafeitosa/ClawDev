# HEARTBEAT.md -- Agent Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, budget, chain of command.
- Check wake context: `CLAWDEV_WAKE_REASON`, `CLAWDEV_TASK_ID`, `CLAWDEV_WAKE_COMMENT_ID`.

## 2. Channel Messages (PRIORITY)

If `CLAWDEV_WAKE_REASON` is `channel_message_received`:

1. The wake context already contains the message details (sender, body preview, channel).
2. Fetch recent messages for full context: `GET /api/channels/{channelId}/messages?limit=10`.
3. **Respond directly to stdout** -- your stdout output becomes the channel reply automatically.
4. Be concise, helpful, and relevant to what was asked.
5. If the question is outside your expertise, say so and suggest who might help.
6. **Do NOT** run the rest of the heartbeat checklist when handling a channel message -- just respond and exit.

## 3. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Prioritize: `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.
- If `CLAWDEV_TASK_ID` is set and assigned to you, prioritize that task.
- Before acting, confirm the task belongs to your role and level. If not, delegate or consult the right owner.

## 4. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 -- that task belongs to someone else.
- Do the work. Update status and comment when done.

## 5. Collaboration

- Check your unread messages: `GET /api/agents/{your-id}/messages/unread-count`.
- If you have unread DMs, read and respond: `GET /api/agents/{your-id}/messages`.
- Check your channel mentions and respond if needed.
- If you need help from another agent, send a message or create a delegation.
- Use the system to collaborate, not to take over someone else’s domain.

## 6. Escalation

- If blocked, escalate to your manager via the chain of command.
- Create a comment on the issue explaining what you need.
- If something is urgent, use `@channel` in the relevant channel.

## 7. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.

## Rules

- Always include `X-ClawDev-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets + links.
- Never look for unassigned work -- only work on what is assigned to you.
