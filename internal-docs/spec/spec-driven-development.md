# Spec-Driven Development (SDD)

Status: Canonical process
Last updated: 2026-04-03

ClawDev uses Spec-Driven Development as the default workflow for meaningful product and platform changes.
The goal is simple: every important change should be explainable before it is implemented, and every implementation should be traceable back to the spec that justified it.

## 1. Why this exists

Autonomous-agent systems accumulate hidden behavior quickly. If product intent, architecture, and implementation drift apart, the control plane becomes hard to reason about and harder to trust.

SDD keeps the work legible by forcing each meaningful change through a small chain of artifacts:

1. **Spec / PRD** — what we are building and why.
2. **Architecture plan / decision log** — how we are going to build it and which tradeoffs we accepted.
3. **Task breakdown** — the concrete implementation steps, dependencies, and verification plan.
4. **Implementation** — code, migrations, UI, tests, and supporting docs.
5. **Verification** — typecheck, tests, build, and any relevant smoke checks.

## 2. Inspiration from big-tech practice

This process follows patterns used by large engineering orgs:

- **Google** emphasizes self-contained changes and clear review discipline in its engineering practices documentation.
- **AWS** recommends architecture decision records as a decision log with context, alternatives, consequences, and ownership.
- **Microsoft** recommends starting ADRs at the beginning of a workload and keeping them as an append-only log of architectural decisions.

The shared idea is not the template itself. It is the discipline:

- write down the decision before or while you make it,
- keep the reasoning close to the code,
- and preserve the history instead of overwriting it.

## 3. Canonical artifact chain

### 3.1 Spec / PRD

Use the spec to capture:

- the problem being solved,
- the user outcome,
- non-goals,
- constraints,
- acceptance criteria,
- and what success looks like.

For ClawDev, this usually means updating one of the core product documents first:

- `internal-docs/GOAL.md`
- `internal-docs/PRODUCT.md`
- `internal-docs/SPEC.md`
- `internal-docs/SPEC-implementation.md`

### 3.2 Architecture plan / ADR

Use an architecture plan or ADR when the change affects:

- APIs or contracts,
- the database schema,
- background jobs or runtime behavior,
- permissions or governance,
- adapter selection or execution flow,
- or a UI surface that changes how operators think about the system.

Keep architecture records:

- pithy,
- factual,
- focused on the decision,
- and explicit about tradeoffs.

If a decision changes later, do not rewrite history. Create a new record that supersedes the old one.

### 3.3 Task breakdown

After the spec and architecture are stable enough, break the work into implementation tasks.

Each task should state:

- what file or subsystem it touches,
- what must not change,
- how to verify it,
- and what dependencies it has.

Task breakdowns should be specific enough that another contributor or agent can execute them without re-deriving the product decision.

### 3.4 Implementation

Implementation should stay aligned with the existing contract:

- company-scoped data model,
- single-assignee issues,
- governed actions with audit logs,
- adapter-aware execution,
- and synchronized contracts across DB, shared types, server, and UI.

When implementation changes behavior, update the docs in the same change.

## 4. Working rules

1. Do not jump directly into code for meaningful changes.
2. Capture the product intent first.
3. Record architecture decisions when the shape of the system changes.
4. Break the change into tasks before implementation.
5. Keep the spec, docs, and code synchronized.
6. Prefer additive documentation updates over wholesale rewrites.
7. Preserve history. If the design changes, supersede the old record instead of erasing it.

## 5. Where the process lives

- Product intent and long-horizon direction live in `internal-docs/GOAL.md`, `internal-docs/PRODUCT.md`, and `internal-docs/SPEC.md`.
- Build-ready V1 behavior lives in `internal-docs/SPEC-implementation.md`.
- Change-by-change rollout plans live in `internal-docs/plans/YYYY-MM-DD-slug.md`.
- Use `pnpm clawdev sdd new <slug> --title "Human readable title"` to scaffold a dated bundle with `spec.md`, `adr.md`, `tasks.md`, and `plan.md`.
- Use `pnpm clawdev spec new <slug> --title "Human readable title"` and `pnpm clawdev adr new <slug> --title "Human readable title"` for standalone spec and ADR scaffolds.
- Use `pnpm clawdev sdd init` when you want an interactive prompt flow that gathers the feature name and slug before generating the same bundle. Add `--yes` or use `pnpm sdd:init:yes` if you want to skip the last confirmation step.
- The SDD process itself lives here and should be linked from the main docs.

## 6. Default delivery sequence

For any meaningful feature or cross-layer fix:

1. Update the relevant product/spec document.
2. Write or update an architecture plan / ADR if the change affects contracts, data, runtime behavior, or UI flow.
3. Break the work into ordered tasks.
4. Implement the change.
5. Update tests and docs together with the code.
6. Run verification:
   - `pnpm -r typecheck`
   - `pnpm test:run`
   - `pnpm build`
7. If the change alters user flow, validate the result with a smoke test or browser check.

## 7. Practical examples

Use SDD when you are changing:

- onboarding or setup flow,
- adapter contracts,
- budget enforcement,
- approval gates,
- company export/import,
- plugin surfaces,
- documents or knowledge surfaces,
- or any UI that changes the operator's mental model of the system.

For tiny, self-evident fixes that stay inside one file and do not change behavior, a lightweight update may be enough. Even then, keep the change easy to trace.
