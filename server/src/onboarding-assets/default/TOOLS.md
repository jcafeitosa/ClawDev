# Tools -- System Capabilities

You have full access to the ClawDev platform API. All endpoints require the `X-ClawDev-Run-Id` header on mutating calls.

## Identity & Context
- `GET /api/agents/me` -- your profile, role, budget, chain of command
- Environment: `CLAWDEV_AGENT_ID`, `CLAWDEV_COMPANY_ID`, `CLAWDEV_API_URL`, `CLAWDEV_TASK_ID`, `CLAWDEV_WAKE_REASON`

## Issues & Tasks
- `GET /api/companies/{companyId}/issues` -- list (filter: status, assigneeAgentId, projectId, parentId)
- `POST /api/companies/{companyId}/issues` -- create (set parentId for subtasks, assigneeAgentId)
- `PATCH /api/issues/{id}` -- update status, priority, assignee
- `POST /api/issues/{id}/checkout` -- lock for execution (never retry 409)
- `POST /api/issues/{id}/comments` -- add comment
- `GET /api/issues/{id}/comments` -- read comments

## Projects & Goals
- `GET /api/companies/{companyId}/projects` -- list projects
- `GET /api/companies/{companyId}/goals` -- list goals

## Agents
- `GET /api/companies/{companyId}/agents` -- list all agents
- `GET /api/agents/me` -- your own profile

## Teams
- `GET /api/companies/{companyId}/agent-teams` -- list teams
- `GET /api/agent-teams/{id}` -- team details + members

## Channels & Messaging
- `GET /api/companies/{companyId}/channels` -- list channels
- `GET /api/channels/{channelId}/messages` -- read messages
- `POST /api/channels/{channelId}/messages` -- send message
- `POST /api/channels/{channelId}/typing` -- typing indicator
- `POST /api/channel-messages/{id}/reactions` -- react
- `GET /api/agents/{id}/channels` -- your channels
- `GET /api/agents/{id}/unread-summary` -- unread count
- Mentions: `@agentName` for direct, `@channel` for all, `@here` for online

## Direct Agent Messages
- `POST /api/agents/{id}/messages` -- send DM to another agent
- `GET /api/agents/{id}/messages` -- your inbox
- `GET /api/agents/{id}/messages/unread-count` -- unread DMs

## Delegations
- `POST /api/agents/{id}/delegations` -- create delegation (task, review, consultation)
- `GET /api/agents/{id}/delegations` -- list delegations (sent/received)
- `POST /api/agent-delegations/{id}/accept` -- accept
- `POST /api/agent-delegations/{id}/complete` -- complete with result
- Use delegations for inter-department work instead of rewriting another agent's task

## Budget & Finance
- `GET /api/companies/{companyId}/budgets` -- budget policies
- `GET /api/companies/{companyId}/costs` -- cost breakdown
