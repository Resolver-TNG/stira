# ADR-009: DPO Export Pathway (Future-Work Fence)

**Status:** Proposed (implementation deferred to v0.3+)
**Date:** 2026-05-22
**Context:** PersonaArena (arXiv:2605.17044) proved DPO > SFT for persona consistency enhancement (DPO-Qwen3-8B surpasses GPT-4.1 on 6/8 dimensions). Stira's state trajectories can theoretically serve as reward signals for DPO pair generation. This ADR documents the *planned shape* without committing implementation, to prevent scope creep in v0.1/v0.2.

## Decision

DPO export will eventually live in `tools/dpo-export/`, separate from engine and adapters.

### Planned Contract (DO NOT IMPLEMENT YET)

```typescript
// tools/dpo-export/src/types.ts (future)
interface DpoPair {
  prompt: string;
  chosen: {
    response: string;
    trace: TraceRecord[];
    reward: number;
  };
  rejected: {
    response: string;
    trace: TraceRecord[];
    reward: number;
  };
  metadata: {
    personaId: string;
    stimuliId: string;
    rewardFormula: string;
  };
}

// Reward signal composition:
// reward = α·external_BC + β·(1 - breaker_fire_rate) + γ·(1 - phase_drift_magnitude)
// Where: external_BC comes from PersonaArena adapter, breaker/drift from engine
```

### Pair Generation Rule

Given the same persona × similar stimuli:
- Generate N candidate responses per turn
- Score each with Stira state trajectory + external eval
- Select (highest_reward, lowest_reward) as preference pair

### Rules

1. DPO export is **read-only** over committed traces + calibration reports.
2. It lives in `tools/`, never in `engine/` or `adapters/`.
3. Engine must not be modified to support DPO (no "reward-mode" flags).
4. This ADR exists to **reject premature PRs** that add DPO logic before Phase 2 calibration is validated.

### Prerequisites (must be done first)

- [ ] Phase 1: `stira eval` working end-to-end
- [ ] Phase 2: `stira calibrate` producing stable correlation tables
- [ ] Phase 2: bcWindow validated against PersonaArena BC (r > 0.6 required)
- [ ] Sufficient trace data (>500 traces across >10 personas)

## Consequences

- v0.1 and v0.2 stay focused on control + eval.
- DPO becomes v0.3's headline feature with proper empirical backing.
- Contributors have a clear roadmap without ambiguity about timing.

## References

- PersonaArena (arXiv:2605.17044) §5: DPO enhancement results
- ADR-007: Trace as the Evaluation Boundary
- ADR-008: Native Metrics vs External Metrics
