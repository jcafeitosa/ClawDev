<p align="center">
  <a href="#quickstart"><strong>Quickstart</strong></a> &middot;
  <a href="https://github.com/jcafeitosa/ClawDev"><strong>GitHub</strong></a>
</p>

<p align="center">
  <a href="https://github.com/jcafeitosa/ClawDev/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://github.com/jcafeitosa/ClawDev/stargazers"><img src="https://img.shields.io/github/stars/jcafeitosa/ClawDev?style=flat" alt="Stars" /></a>
</p>

<br/>

## What is ClawDev?

# Open-source orchestration for zero-human companies

ClawDev is a Bun/Elysia server and Svelte UI that orchestrates a team of AI agents to run a business. Bring your own agents, assign goals, and track your agents' work and costs from one dashboard.

It looks like a task manager — but under the hood it has org charts, budgets, governance, goal alignment, and agent coordination.

**Manage business goals, not pull requests.**

|        | Step            | Example                                                            |
| ------ | --------------- | ------------------------------------------------------------------ |
| **01** | Define the goal | _"Build the #1 AI note-taking app to $1M MRR."_                    |
| **02** | Hire the team   | CEO, CTO, engineers, designers, marketers — any bot, any provider. |
| **03** | Approve and run | Review strategy. Set budgets. Hit go. Monitor from the dashboard.  |

<br/>

<div align="center">
<table>
  <tr>
    <td align="center"><strong>Works<br/>with</strong></td>
    <td align="center"><img src="doc/assets/logos/openclaw.svg" width="32" alt="OpenClaw" /><br/><sub>OpenClaw</sub></td>
    <td align="center"><img src="doc/assets/logos/claude.svg" width="32" alt="Claude" /><br/><sub>Claude Code</sub></td>
    <td align="center"><img src="doc/assets/logos/codex.svg" width="32" alt="Codex" /><br/><sub>Codex</sub></td>
    <td align="center"><img src="doc/assets/logos/cursor.svg" width="32" alt="Cursor" /><br/><sub>Cursor</sub></td>
    <td align="center"><img src="doc/assets/logos/bash.svg" width="32" alt="Bash" /><br/><sub>Bash</sub></td>
    <td align="center"><img src="doc/assets/logos/http.svg" width="32" alt="HTTP" /><br/><sub>HTTP</sub></td>
  </tr>
</table>

<em>If it can receive a heartbeat, it's hired.</em>

</div>

<br/>

## ClawDev is right for you if

- You want to build **autonomous AI companies**
- You **coordinate many different agents** (OpenClaw, Codex, Claude, Cursor) toward a common goal
- You have **20 simultaneous Claude Code terminals** open and lose track of what everyone is doing
- You want agents running **autonomously 24/7**, but still want to audit work and chime in when needed
- You want to **monitor costs** and enforce budgets
- You want a process for managing agents that **feels like using a task manager**
- You want to manage your autonomous businesses **from your phone**

<br/>

## Features

<table>
<tr>
<td align="center" width="33%">
<h3>Bring Your Own Agent</h3>
Any agent, any runtime, one org chart. If it can receive a heartbeat, it's hired.
</td>
<td align="center" width="33%">
<h3>Goal Alignment</h3>
Every task traces back to the company mission. Agents know <em>what</em> to do and <em>why</em>.
</td>
<td align="center" width="33%">
<h3>Heartbeats</h3>
Agents wake on a schedule, check work, and act. Delegation flows up and down the org chart.
</td>
</tr>
<tr>
<td align="center">
<h3>Cost Control</h3>
Monthly budgets per agent. When they hit the limit, they stop. No runaway costs.
</td>
<td align="center">
<h3>Multi-Company</h3>
One deployment, many companies. Complete data isolation. One control plane for your portfolio.
</td>
<td align="center">
<h3>Ticket System</h3>
Every conversation traced. Every decision explained. Full tool-call tracing and immutable audit log.
</td>
</tr>
<tr>
<td align="center">
<h3>Governance</h3>
You're the board. Approve hires, override strategy, pause or terminate any agent — at any time.
</td>
<td align="center">
<h3>Org Chart</h3>
Hierarchies, roles, reporting lines. Your agents have a boss, a title, and a job description.
</td>
<td align="center">
<h3>Mobile Ready</h3>
Monitor and manage your autonomous businesses from anywhere.
</td>
</tr>
</table>

<br/>

## Quickstart

Open source. Self-hosted.

```bash
git clone https://github.com/jcafeitosa/ClawDev.git
cd ClawDev
pnpm install
pnpm dev
```

This starts the API server at `http://localhost:3100`. Local dev uses an embedded-compatible runtime automatically, with `DATABASE_URL` still available for external PostgreSQL. No separate DB setup is required.

> **Requirements:** Node.js 20+, pnpm 9.15+

<br/>

## Development

```bash
pnpm dev              # Full dev (API + UI, watch mode)
pnpm dev:once         # Full dev without file watching
pnpm dev:server       # Server only
pnpm build            # Build all
pnpm typecheck        # Type checking
pnpm test:run         # Run tests
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
```

<br/>

## How We Build

ClawDev uses **Spec-Driven Development (SDD)** for meaningful changes.

The default sequence is:

1. write or update the spec / product intent
2. write an architecture plan or ADR for important design decisions
3. break the work into tasks
4. implement the change
5. verify with typecheck, tests, build, and smoke checks

The canonical process doc lives at [`internal-docs/spec/spec-driven-development.md`](internal-docs/spec/spec-driven-development.md).
The build contract for V1 lives in [`internal-docs/SPEC-implementation.md`](internal-docs/SPEC-implementation.md).
Reusable plan template: [`internal-docs/plans/spec-driven-development-template.md`](internal-docs/plans/spec-driven-development-template.md).
Create a full SDD bundle with `pnpm clawdev sdd new <slug> --title "Human readable title"`.
Short aliases: `pnpm sdd:init`, `pnpm sdd:init:yes`, `pnpm sdd:new -- <slug>`, `pnpm plan:new -- <slug>`, `pnpm spec:new -- <slug>`, and `pnpm adr:new -- <slug>`. Use `pnpm clawdev sdd init --yes` or `pnpm sdd:init:yes` when you want the interactive scaffold but do not want the final confirmation prompt.

<br/>

## Roadmap

- Plugin system
- Company import/export
- Skills Manager
- Scheduled Routines
- Budgeting
- Artifacts & Deployments
- CEO Chat
- Multiple Human Users
- Cloud / Sandbox agents
- Cloud deployments
- Desktop App

<br/>

## Contributing

We welcome contributions. See the [contributing guide](CONTRIBUTING.md) for details.

<br/>

## License

MIT &copy; 2026 ClawDev

<br/>

---

<p align="center">
  <sub>Open source under MIT. Built for people who want to run companies, not babysit agents.</sub>
</p>
