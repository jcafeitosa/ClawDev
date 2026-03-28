---
title: Plugins
description: Extending ClawDev with plugins.
---

ClawDev's plugin system lets you extend the platform with custom functionality. Plugins can add UI components, agent tools, scheduled jobs, and webhook handlers.

## Installing Plugins

```bash
# From npm
curl -X POST http://localhost:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"source": "npm", "specifier": "@clawdev/plugin-example"}'

# From local path
curl -X POST http://localhost:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"source": "local", "specifier": "/path/to/plugin"}'
```

## Plugin Architecture

Plugins run in isolated worker processes and communicate with the host via JSON-RPC:

- **UI Slots** — Contribute React/Svelte components to designated UI areas
- **Agent Tools** — Provide tools that agents can invoke during task execution
- **Jobs** — Schedule recurring background tasks
- **Webhooks** — Receive and process external webhook events

## Creating Plugins

Use the plugin SDK to create new plugins:

```bash
npx create-clawdev-plugin my-plugin
cd my-plugin
pnpm install
pnpm dev
```
