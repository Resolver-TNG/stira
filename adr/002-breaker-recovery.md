# ADR-002: Breaker Recovery Path

**Status:** Proposed
**Date:** 2026-05-21

## Context

Circuit breakers fire when stability/vigilance cross thresholds. Current design has no defined recovery path — once a breaker fires, it stays in `activeBreakers` indefinitely.

This creates a permanent lock risk: if stability drops below 0.3 and the "block" breaker fires, the agent is permanently restricted even if conditions improve.

## Options

1. **Auto-recovery**: Breaker clears when parameter rises above threshold + hysteresis margin
2. **Manual reset**: Operator must explicitly clear the breaker
3. **Cooldown timer**: Breaker stays active for N minutes, then re-evaluates
4. **State machine**: armed → tripped → cooling → reset (full lifecycle)

## Decision

TBD — leaning toward Option 1 (auto-recovery with hysteresis) for `warn` breakers, Option 2 (manual) for `block` breakers.

Rationale: `warn` is informational and should self-heal. `block` is a safety stop that requires human acknowledgment before resuming.

## Consequences

- Need a `hysteresis` field in BreakerRule (e.g., fire at 0.3, recover at 0.5)
- Need a `resetMode` field: "auto" | "manual" | "cooldown"
- `block` breakers with manual reset need a way for operator to signal "cleared"
- This affects the Adapter interface (must expose a reset command)
