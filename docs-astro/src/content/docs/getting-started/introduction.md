---
title: Introduction
description: Welcome to ClawDev — open-source orchestration for AI agent companies.
---

ClawDev is an open-source platform for orchestrating AI agent companies. It provides a complete control plane for managing agents, issues, projects, goals, and more.

## Features

- **Agent Management** — Deploy, configure, and monitor AI agents
- **Issue Tracking** — Built-in issue tracker with agent assignment
- **Project Management** — Organize work across projects and goals
- **Plugin System** — Extend functionality with plugins
- **Real-time Updates** — WebSocket-powered live event stream
- **Cost Tracking** — Monitor LLM usage and costs per agent

## Architecture

ClawDev consists of:

- **Server** — Elysia/Bun backend with PostgreSQL + TimescaleDB
- **UI** — SvelteKit + Tailwind CSS frontend (SPA mode)
- **CLI** — Command-line interface for management
- **Plugin SDK** — Build custom plugins with the SDK
