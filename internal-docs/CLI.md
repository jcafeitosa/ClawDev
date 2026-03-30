# CLI Reference

ClawDev CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm clawdev --help
```

First-time local bootstrap + run:

```sh
pnpm clawdev run
```

Choose local instance:

```sh
pnpm clawdev run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `clawdev onboard` and `clawdev configure --section server` set deployment mode in config
- runtime can override mode with `CLAWDEV_DEPLOYMENT_MODE`
- `clawdev run` and `clawdev doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm clawdev allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.clawdev`:

```sh
pnpm clawdev run --data-dir ./tmp/clawdev-dev
pnpm clawdev issue list --data-dir ./tmp/clawdev-dev
```

## Context Profiles

Store local defaults in `~/.clawdev/context.json`:

```sh
pnpm clawdev context set --api-base http://localhost:3100 --company-id <company-id>
pnpm clawdev context show
pnpm clawdev context list
pnpm clawdev context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm clawdev context set --api-key-env-var-name CLAWDEV_API_KEY
export CLAWDEV_API_KEY=...
```

## Company Commands

```sh
pnpm clawdev company list
pnpm clawdev company get <company-id>
pnpm clawdev company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm clawdev company delete PAP --yes --confirm PAP
pnpm clawdev company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `CLAWDEV_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `CLAWDEV_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm clawdev issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm clawdev issue get <issue-id-or-identifier>
pnpm clawdev issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm clawdev issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm clawdev issue comment <issue-id> --body "..." [--reopen]
pnpm clawdev issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm clawdev issue release <issue-id>
```

## Agent Commands

```sh
pnpm clawdev agent list --company-id <company-id>
pnpm clawdev agent get <agent-id>
pnpm clawdev agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a ClawDev agent:

- creates a new long-lived agent API key
- installs missing ClawDev skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `CLAWDEV_API_URL`, `CLAWDEV_COMPANY_ID`, `CLAWDEV_AGENT_ID`, and `CLAWDEV_API_KEY`

Example for shortname-based local setup:

```sh
pnpm clawdev agent local-cli codexcoder --company-id <company-id>
pnpm clawdev agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm clawdev approval list --company-id <company-id> [--status pending]
pnpm clawdev approval get <approval-id>
pnpm clawdev approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm clawdev approval approve <approval-id> [--decision-note "..."]
pnpm clawdev approval reject <approval-id> [--decision-note "..."]
pnpm clawdev approval request-revision <approval-id> [--decision-note "..."]
pnpm clawdev approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm clawdev approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm clawdev activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm clawdev dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm clawdev heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.clawdev/instances/default`:

- config: `~/.clawdev/instances/default/config.json`
- embedded db: `~/.clawdev/instances/default/db`
- logs: `~/.clawdev/instances/default/logs`
- storage: `~/.clawdev/instances/default/data/storage`
- secrets key: `~/.clawdev/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
CLAWDEV_HOME=/custom/home CLAWDEV_INSTANCE_ID=dev pnpm clawdev run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm clawdev configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
