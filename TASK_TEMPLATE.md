# Task Template — ACP Implementation Delegate

Use this template when delegating implementation tasks to coding agents (Kiro, Claude Code, etc.) via ACP.

---

## Task: [Module Name]

### Context
You are implementing a module for Stira, an agent state machine library. The engine is **pure functions only** — no LLM calls, no I/O, no side effects.

### Files to Read First
- `spec/[relevant].schema.json` — The data contract
- `engine/src/types.ts` — Type definitions (do not modify)
- `engine/test/[module].test.ts` — Tests you must pass (do not modify)
- `adr/` — Architecture decisions (read for context on "why")

### Your Task
Implement `engine/src/[module].ts` such that all tests in `engine/test/[module].test.ts` pass.

### Constraints
- **Pure function**: No `fetch`, no `fs`, no `console.log`, no side effects
- **Types**: Import from `./types.js` only. Do not create new type files.
- **Style**: ESM imports, no default exports, explicit return types
- **Precision**: Use `Math.round(x * 1000) / 1000` for 3-decimal precision
- **Immutability**: Never mutate input arguments. Return new objects.
- **Do not modify**: `types.ts`, test files, spec files, other modules
- **Spec is always right**: If spec and existing code disagree, follow spec
- **No spec changes**: Never modify files under `spec/`. If spec seems wrong, return a question instead of implementing.

### If You're Stuck
Do not guess. Return a structured question:
```
QUESTION: [what you need clarified]
CONTEXT: [what you've understood so far]
OPTIONS: [approaches you considered]
```

### Verification
```bash
cd engine && npm test -- --run [module]
```

All tests must pass. No skipped tests. No `any` types.

### What NOT to Do
- Do not add dependencies
- Do not refactor existing code
- Do not add "helpful" utilities beyond what tests require
- Do not write code that "might be useful later"

---

_Adjust [Module Name], file paths, and specifics per task._
