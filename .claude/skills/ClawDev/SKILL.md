```markdown
# ClawDev Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill introduces the core development patterns and conventions used in the ClawDev TypeScript codebase. It covers file naming, import/export styles, commit message conventions, and testing patterns. Whether you're contributing new features or maintaining existing code, following these guidelines will ensure consistency and code quality throughout the project.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `dataFetcher.test.ts`

### Import Style
- Use **relative imports** for referencing other modules.
  - Example:
    ```typescript
    import { fetchData } from './dataFetcher';
    ```

### Export Style
- Use **named exports** instead of default exports.
  - Example:
    ```typescript
    // dataFetcher.ts
    export function fetchData() { /* ... */ }
    ```

### Commit Messages
- Follow **conventional commit** format.
- Use the `chore` prefix for maintenance tasks.
  - Example: `chore: update dependencies to latest versions`

## Workflows

_No automated workflows detected in this repository._

## Testing Patterns

- Test files use the `*.test.*` naming convention.
  - Example: `userProfile.test.ts`
- The specific testing framework is **unknown**, but tests are expected to be colocated with the code they cover.
- Example test file structure:
  ```typescript
  // userProfile.test.ts
  import { getUserProfile } from './userProfile';

  describe('getUserProfile', () => {
    it('returns user data for valid ID', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command | Purpose |
|---------|---------|
| /test   | Run all test files matching `*.test.*` |
| /commit | Create a conventional commit (e.g., `chore: ...`) |
```