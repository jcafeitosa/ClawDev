---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `clawdev run`

One-command bootstrap and start:

```sh
pnpm clawdev run
```

Does:

1. Auto-onboards if config is missing
2. Runs `clawdev doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm clawdev run --instance dev
```

## `clawdev onboard`

Interactive first-time setup:

```sh
pnpm clawdev onboard
```

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm clawdev onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm clawdev onboard --yes
```

## `clawdev doctor`

Health checks with optional auto-repair:

```sh
pnpm clawdev doctor
pnpm clawdev doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `clawdev configure`

Update configuration sections:

```sh
pnpm clawdev configure --section server
pnpm clawdev configure --section secrets
pnpm clawdev configure --section storage
```

## `clawdev env`

Show resolved environment configuration:

```sh
pnpm clawdev env
```

## `clawdev allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm clawdev allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.clawdev/instances/default/config.json` |
| Database | `~/.clawdev/instances/default/db` |
| Logs | `~/.clawdev/instances/default/logs` |
| Storage | `~/.clawdev/instances/default/data/storage` |
| Secrets key | `~/.clawdev/instances/default/secrets/master.key` |

Override with:

```sh
CLAWDEV_HOME=/custom/home CLAWDEV_INSTANCE_ID=dev pnpm clawdev run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm clawdev run --data-dir ./tmp/clawdev-dev
pnpm clawdev doctor --data-dir ./tmp/clawdev-dev
```
