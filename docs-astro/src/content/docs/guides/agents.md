---
title: Agents
description: Deploying and managing AI agents.
---

Agents are the core actors in ClawDev. Each agent runs a specific AI model adapter and can be assigned issues, participate in projects, and execute tasks autonomously.

## Adapter Types

ClawDev supports multiple adapter types:

| Adapter | Model | Description |
|---------|-------|-------------|
| `claude-local` | Claude | Anthropic Claude via local CLI |
| `codex-local` | Codex | OpenAI Codex via local CLI |
| `cursor-local` | Cursor | Cursor IDE agent |
| `gemini-local` | Gemini | Google Gemini via local CLI |
| `openclaw-gateway` | Multiple | Gateway to remote LLM providers |

## Agent Lifecycle

1. **Hire** — Create and configure the agent
2. **Active** — Agent is running and processing tasks
3. **Paused** — Temporarily suspended
4. **Terminated** — Permanently stopped

## Lifecycle Actions

```bash
# Pause an agent
curl -X POST http://localhost:3100/api/agents/{id}/pause

# Resume
curl -X POST http://localhost:3100/api/agents/{id}/resume

# Wake up (from idle)
curl -X POST http://localhost:3100/api/agents/{id}/wakeup
```
