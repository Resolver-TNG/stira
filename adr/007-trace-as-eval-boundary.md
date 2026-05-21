# ADR-007: Trace as the Evaluation Boundary

**Status:** Accepted
**Date:** 2026-05-22
**Context:** PersonaArena (arXiv:2605.17044) establishes multi-turn dynamic simulation as the standard for persona evaluation. Stira needs a clean contract surface for external evaluators without coupling engine to eval-side schemas.

## Decision

`TraceRecord[]` is Stira's canonical output for any external evaluation system.

### Rules

1. **Engine produces TraceRecords.** The simulate CLI outputs JSONL where each line is a TraceRecord containing event, state-before, state-after, fired breakers, and drift report.

2. **Evaluators consume TraceRecords.** External eval systems (PersonaArena, custom judges, future benchmarks) read TraceRecords and score them. They never import or call engine functions directly.

3. **Engine MUST NOT depend on eval-side schemas.** No PersonaArena metric names, judge protocols, or eval result types inside `engine/`. The engine is eval-agnostic.

4. **Adapters bridge the gap.** `adapters/<evaluator>/` contains the translation logic (TraceRecord → eval input, eval result → Stira report). Adapters live outside the engine package.

5. **TraceRecord schema is append-only within a major version.** New optional fields may be added; existing fields are never removed or renamed.

## TraceRecord Shape

```typescript
interface TraceRecord {
  traceId: string;
  turn: number;
  event: Event;
  stateBefore: State;
  stateAfter: State;
  firedBreakers: BreakerResult[];
  drift: DriftReport | null;
}
```

## Consequences

- External evaluator integration becomes a matter of writing an adapter, not modifying the engine.
- The correlation between Stira internal state and external eval metrics (e.g., PersonaArena BC ↔ stability) is computed in the adapter layer, making it a first-class measurable artifact.
- Future evaluators (beyond PersonaArena) can integrate without engine changes.

## References

- PersonaArena (arXiv:2605.17044) §3: Evaluation Engine
- ADR-001: Why Pure Functions
- ADR-005: Breaker-Adapter Contract
