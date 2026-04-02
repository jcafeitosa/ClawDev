---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that ClawDev uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Server host binding |
| `DATABASE_URL` | (dev embedded-compatible runtime) | PostgreSQL connection string |
| `CLAWDEV_HOME` | `~/.clawdev` | Base directory for all ClawDev data |
| `CLAWDEV_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `CLAWDEV_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAWDEV_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `CLAWDEV_SECRETS_MASTER_KEY_FILE` | `~/.clawdev/.../secrets/master.key` | Path to key file |
| `CLAWDEV_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `CLAWDEV_AGENT_ID` | Agent's unique ID |
| `CLAWDEV_COMPANY_ID` | Company ID |
| `CLAWDEV_API_URL` | ClawDev API base URL |
| `CLAWDEV_API_KEY` | Short-lived JWT for API auth |
| `CLAWDEV_RUN_ID` | Current heartbeat run ID |
| `CLAWDEV_TASK_ID` | Issue that triggered this wake |
| `CLAWDEV_WAKE_REASON` | Wake trigger reason |
| `CLAWDEV_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `CLAWDEV_APPROVAL_ID` | Resolved approval ID |
| `CLAWDEV_APPROVAL_STATUS` | Approval decision |
| `CLAWDEV_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |
