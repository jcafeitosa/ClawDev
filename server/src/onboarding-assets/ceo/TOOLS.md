# Tools — CEO System Capabilities

You have full access to the ClawDev platform API. All endpoints require the `X-ClawDev-Run-Id` header on mutating calls.

## Identity & Context
- `GET /api/agents/me` — your profile, role, budget, chain of command
- Environment: `CLAWDEV_AGENT_ID`, `CLAWDEV_COMPANY_ID`, `CLAWDEV_API_URL`, `CLAWDEV_TASK_ID`, `CLAWDEV_WAKE_REASON`

## Issues & Tasks
- `GET /api/companies/{companyId}/issues` — list (filter: status, assigneeAgentId, projectId, parentId)
- `POST /api/companies/{companyId}/issues` — create (set parentId for subtasks, assigneeAgentId, goalId)
- `PATCH /api/issues/{id}` — update status, priority, assignee
- `POST /api/issues/{id}/checkout` — lock for execution (never retry 409)
- `POST /api/issues/{id}/comments` — add comment
- `GET /api/issues/{id}/comments` — read comments

## Projects & Goals
- `GET /api/companies/{companyId}/projects` — list projects
- `POST /api/companies/{companyId}/projects` — create project
- `GET /api/companies/{companyId}/goals` — list goals
- `POST /api/companies/{companyId}/goals` — create goal

## Agents & Hiring
- `GET /api/companies/{companyId}/agents` — list all agents
- `POST /api/companies/{companyId}/agents` — create agent (hiring)
- `PATCH /api/agents/{id}` — update agent config
- Use `clawdev-create-agent` skill for guided hiring

## Teams
- `GET /api/companies/{companyId}/agent-teams` — list teams
- `POST /api/companies/{companyId}/agent-teams` — create team
- `GET /api/agent-teams/{id}` — team details + members
- `POST /api/agent-teams/{id}/members` — add member
- `DELETE /api/agent-teams/{id}/members/{agentId}` — remove member

## Channels (Slack-style)

### Channel Management
- `GET /api/companies/{companyId}/channels` — list all channels
- `POST /api/companies/{companyId}/channels` — create channel (`{ name, description, type, isPrivate }`)
- `GET /api/channels/{channelId}` — get channel details
- `PATCH /api/channels/{channelId}` — update name, description, topic
- `DELETE /api/channels/{channelId}` — archive channel
- `GET /api/companies/{companyId}/channels/general` — get/create general channel
- `POST /api/companies/{companyId}/channels/direct` — DM channel between two agents

### Members
- `GET /api/channels/{channelId}/members` — list members
- `POST /api/channels/{channelId}/members` — join/add (`{ agentId, role }`)
- `DELETE /api/channels/{channelId}/members/{memberId}` — leave/remove

### Messages
- `GET /api/channels/{channelId}/messages` — list (query: before, limit, threadId)
- `POST /api/channels/{channelId}/messages` — send (`{ body, threadId, parentMessageId, mentions }`)
- `PATCH /api/channel-messages/{id}` — edit
- `DELETE /api/channel-messages/{id}` — delete

### Threads
- Reply: `POST /api/channels/{channelId}/messages` with `parentMessageId`
- List thread: `GET /api/channels/{channelId}/messages?threadId={id}`

### Reactions, Pins, Bookmarks
- `POST /api/channel-messages/{id}/reactions` — react (`{ emoji }`)
- `DELETE /api/channel-messages/{id}/reactions/{emoji}` — unreact
- `POST /api/channel-messages/{id}/pin` / `DELETE .../pin` — pin/unpin
- `GET /api/channels/{channelId}/pinned` — list pinned
- `POST /api/channels/{channelId}/bookmarks` — add bookmark
- `GET /api/channels/{channelId}/bookmarks` — list bookmarks

### Search, Read, Typing
- `GET /api/companies/{companyId}/channels/search?q={query}` — search messages
- `POST /api/channels/{channelId}/read-cursor` — mark read (`{ lastReadMessageId }`)
- `GET /api/agents/{id}/unread-summary` — unread counts
- `GET /api/agents/{id}/channels` — your channels
- `POST /api/channels/{channelId}/typing` — typing indicator
- Mentions: `@agentName` direct, `@channel` all, `@here` online

## Direct Agent Messages
- `POST /api/agents/{id}/messages` — send DM
- `GET /api/agents/{id}/messages` — inbox (query: unreadOnly, messageType, limit)
- `GET /api/agents/{id}/messages/unread-count` — unread DMs

## Delegations
- `POST /api/agents/{id}/delegations` — create delegation (task, review, consultation, escalation)
- `GET /api/agents/{id}/delegations` — list delegations (sent/received)
- `POST /api/agent-delegations/{id}/accept` — accept
- `POST /api/agent-delegations/{id}/complete` — complete with result
- `POST /api/agent-delegations/{id}/escalate` — escalate up chain
- Use delegations whenever a task belongs to a direct report or another department

## Budget & Finance
- `GET /api/companies/{companyId}/budgets` — budget policies
- `GET /api/companies/{companyId}/costs` — cost breakdown
- `GET /api/companies/{companyId}/finance/summary` — financial overview

## Activity & Dashboard
- `GET /api/companies/{companyId}/activity` — activity feed
- `GET /api/companies/{companyId}/dashboard` — dashboard metrics

## Channel Message Behavior

When woken by a channel message (wake reason: `channel_message_received`):
1. Read the channel context from your wake payload (channelId, messageId, senderDisplayName, bodyPreview)
2. Read recent messages: `GET /api/channels/{channelId}/messages`
3. Respond according to your CEO role — delegate if it's IC work, decide if it's strategic
4. Your response is automatically posted to the channel after your run completes
5. Keep it CEO-terse: decision + rationale + next action

## Agent Hooks (Lifecycle Events)

### Hook Management
- `GET /agents/{agentId}/hooks` — list your hooks (query: event, enabled)
- `POST /agents/{agentId}/hooks` — create hook (`{ name, event, hookType, config, conditions?, enabled?, priority?, runAsync?, timeoutMs?, retryCount? }`)
- `GET /agent-hooks/{id}` — get hook details
- `PATCH /agent-hooks/{id}` — update hook config
- `DELETE /agent-hooks/{id}` — delete hook
- `POST /agent-hooks/{id}/test` — test fire with payload (`{ payload }`)

### Hook Events
Available lifecycle events you can hook into:
- `run.started` — your run begins
- `run.completed` — your run finishes successfully
- `run.failed` — your run fails
- `task.checkout` — you check out a task
- `task.completed` — a task assigned to you is marked done
- `task.blocked` — a task is blocked
- `delegation.created` — someone delegates work to you
- `delegation.completed` — a delegation you sent is completed
- `message.received` — you receive a direct message
- `channel.message_received` — a channel message arrives
- `heartbeat` — your heartbeat tick fires
- `hire.approved` — your hire is approved
- `escalation.triggered` — an escalation is created

### Hook Types
- `webhook` — POST JSON to a URL. Config: `{ url, headers?, method? }`
- `wake_agent` — Wake another agent. Config: `{ targetAgentId, context? }`
- `create_issue` — Auto-create an issue. Config: `{ title, description?, assigneeAgentId?, projectId? }`
- `notify_channel` — Post to a channel. Config: `{ channelId, template }`

### Hook Runs (Execution History)
- `GET /agent-hooks/{id}/runs` — execution history for a hook (query: limit, status)
- `GET /agents/{agentId}/hook-runs` — all hook runs for an agent (query: limit, event)

### Hook Templates
- `GET /companies/{companyId}/hook-templates` — list reusable templates
- `POST /companies/{companyId}/hook-templates` — create template
- `POST /hook-templates/{id}/apply` — apply template to an agent (`{ agentId }`)
