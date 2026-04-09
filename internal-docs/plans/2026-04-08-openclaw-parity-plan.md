# OpenClaw Parity Plan

Date: 2026-04-08

## Objective

Bring ClawDev closer to the parts of OpenClaw that materially improve execution quality:
- provider-first model selection
- auth-aware routing and failover
- session stickiness for model/profile choice
- explicit cooldown and billing semantics
- CEO-first onboarding with hierarchy hiring after wake-up
- materialized instruction bundles for local CLI agents

## What We Already Aligned

- Provider directory/runtime is visible in the dashboard.
- OAuth vs API key billing classification is exposed.
- Unprobed models are not promoted to `available`.
- Probe classification distinguishes auth, quota, timeout, CLI missing, and degraded outputs.
- Onboarding creates only the CEO.
- Cursor now participates in bundle materialization like the other local CLI adapters.
- A per-agent session model pin now persists in runtime state.

## TODO

1. Finalize provider/model routing semantics
   - keep `available` tied to real probe success
   - preserve cooldown per model, not per provider
   - use sticky model pins when they still match the current adapter

2. Improve auth-aware failover
   - treat OAuth and API key credentials as separate usable profiles
   - keep provider-level auth metadata distinct from secret storage
   - surface auth-required and quota/billing states explicitly

3. Keep session behavior stable across runs
   - reuse pinned model selection when the session is still valid
   - only rotate on failure, cooldown, or explicit reset
   - avoid bouncing between models on every heartbeat

4. Maintain CEO-first hire flow
   - onboarding stays minimal
   - CEO hires hierarchy members after wake-up
   - approval flow keeps bundle materialization intact

5. Validate end-to-end
   - typecheck
   - test
   - build
   - smoke the execution path for model fallback and session stickiness

## Notes

- This plan is intentionally narrow: it only tracks parity work that improves the current product model.
- It avoids copying OpenClaw's gateway architecture wholesale because ClawDev remains a company-scoped control plane.
