# ADR-008: Native Metrics vs External Metrics

**Status:** Accepted
**Date:** 2026-05-22
**Context:** PersonaArena provides LLM-judged behavioral metrics (BC, AD, EE, etc.) with 0.683 human correlation. Stira can compute cheaper proxy metrics from TraceRecords alone (no LLM). The relationship between these two layers needs clear policy.

## Decision

Stira ships two tiers of metrics with explicitly different properties:

### Tier 1: Native Metrics (engine-side)

- **Pure functions over TraceRecord[].** No LLM calls, no network I/O.
- **Deterministic.** Same input → same output.
- **Cheap.** Sub-millisecond per trace.
- **Lives in:** `engine/src/metrics.ts`
- **Examples:** `bcWindow` (rolling coherence proxy), `driftRate`, `breakerFireRate`

### Tier 2: External Metrics (adapter-side)

- **May call LLMs** (judge models, debate protocols).
- **Non-deterministic.** Different runs may produce different scores.
- **Expensive.** Seconds to minutes per trace.
- **Lives in:** `adapters/<evaluator>/`
- **Examples:** PersonaArena BC/AD/EE/IR scores via Multi-Agent Debating Judge

### Calibration Reports

The correlation between Tier 1 and Tier 2 metrics is a **first-class artifact**:

```typescript
interface CalibrationReport {
  traceCount: number;
  personaCount: number;
  correlations: Record<string, Record<string, number>>; // native → external → Pearson r
  recommendations: {
    paramWeights?: Record<string, number>;
    thresholdAdjustments?: Record<string, number>;
  };
}
```

Calibration reports are committed to the repo as reproducible evidence.

### Rules

1. Never hard-code PersonaArena metric names in `engine/`.
2. Native metrics are "fast proxies." External metrics are "ground truth."
3. The value proposition is: "Stira's bcWindow correlates with PersonaArena-BC at r=X, but runs in 12ms instead of 8s."
4. Calibration is a periodic offline process, not a runtime dependency.

## Consequences

- Engine stays fast, testable, and LLM-free.
- External eval systems remain optional plugins.
- The correlation table becomes Stira's primary credibility artifact for academic/industry audiences.

## References

- PersonaArena (arXiv:2605.17044) §2.3: Evaluation Engine (8 metrics)
- ADR-007: Trace as the Evaluation Boundary
- ADR-001: Why Pure Functions
