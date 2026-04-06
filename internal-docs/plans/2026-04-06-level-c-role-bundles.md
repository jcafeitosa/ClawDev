# Level C Role Bundles

## Goal

Make the level C onboarding bundle resolve to a dedicated level C template instead of the generic agent bundle.

## Scope

- Route all non-CEO level C roles to a shared `level-c` onboarding bundle.
- Keep CEO-specific onboarding behavior unchanged.
- Cover the bundle resolver with a unit test.

## Acceptance

- CTO, CMO, CFO, COO, and HR all load the level C bundle.
- CEO still loads the CEO bundle.
- Non-level-C roles still load the default bundle.

