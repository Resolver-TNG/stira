# ADR-001: Why Pure Functions (No LLM in Engine)

**Status:** Accepted
**Date:** 2026-05-21

## Context

Engine layer needs to compute state transitions (decay, applyEvent, breaker checks, drift detection). Two options:
1. Engine calls LLM for nuanced judgment (e.g., "is this event really 'threat'?")
2. Engine is pure math — LLM judgment is Adapter's responsibility

## Decision

Engine is pure functions. No LLM calls. No I/O. No side effects.

## Reasons

- **Testability**: Pure functions have deterministic output. Unit tests are trivial.
- **ACP compatibility**: When implementation is delegated to coding agents (Kiro/CC), pure functions have clear contracts. LLM-calling code is ambiguous to test.
- **Harness independence**: Different harnesses have different LLM access patterns. Keeping Engine pure means it works anywhere with a JS runtime.
- **Cost predictability**: Engine runs on cron. If it called LLM, cron costs would be unbounded.
- **Separation of concerns**: "What category is this event?" is a judgment call (Adapter). "Given category X with intensity Y, what's the new state?" is math (Engine).

## Consequences

- Adapter must handle all LLM-dependent logic (trigger categorization, transcription)
- Engine cannot make "smart" decisions — it's deliberately dumb
- Category must be determined before Engine is called — garbage in, garbage out
