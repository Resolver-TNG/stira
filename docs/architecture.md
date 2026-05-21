# Architecture

## Design Principles

1. **Engine is pure** — No LLM calls, no I/O, no side effects. Just math.
2. **Adapter handles the world** — File I/O, LLM categorization, cron registration.
3. **Spec is the contract** — If it validates against the schema, it works.
4. **Breakers only on fixed-core** — Safety mechanisms can't be accidentally broken by users adding custom params.
5. **Baseline is immutable** — The original matrix is preserved for drift detection. Current matrix may evolve.

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ ADAPTER (harness-specific)                               │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Trigger  │    │ File I/O     │    │ Cron/Hook    │  │
│  │ Judgment │    │ (read/write) │    │ Registration │  │
│  │ (LLM)   │    │              │    │              │  │
│  └────┬─────┘    └──────┬───────┘    └──────┬───────┘  │
│       │                  │                    │          │
└───────┼──────────────────┼────────────────────┼──────────┘
        ↓                  ↓                    ↓
┌─────────────────────────────────────────────────────────┐
│ ENGINE (pure functions)                                   │
│                                                          │
│  applyEvent()  →  state transitions                      │
│  decay()       →  time-based parameter reduction         │
│  checkBreakers() → safety threshold evaluation           │
│  detectDrift() →  baseline comparison                    │
│                                                          │
│  Input: state + event + matrix + config                  │
│  Output: new state (or report)                           │
│  Side effects: NONE                                      │
└─────────────────────────────────────────────────────────┘
```

## Internal/External Boundary

### What lives in the LLM context (per-turn cost)
- `state.params` — 6-8 key-value pairs (~50 tokens)
- `activeBreakers` — array of IDs (~20 tokens)
- Optional: last `transcription` (~30 tokens)
- **Total: ~100-150 tokens per turn**

### What lives outside (file-based, loaded on demand)
- Full matrix (36+ cells) → loaded only during applyEvent
- Event history → append-only log, never loaded in full
- Config (decay rules, breakers) → loaded by cron script
- Baseline matrix → loaded only during drift check

### What runs as external process
- Decay calculation (cron every 5min)
- Drift detection (cron every 1h)
- Breaker checks (part of decay cron)

## Harness Minimum Requirements

To implement a Stira adapter, a harness needs:
1. **File read/write** — JSON state persistence
2. **Script execution** — Run Node.js (or equivalent)
3. **(Optional) Periodic execution** — Cron, hook, or manual trigger
4. **(Optional) Event hook** — Trigger after turns/tool-use

That's it. No special APIs needed.

## MVP vs Full

| Feature | MVP (Phase 0) | Full |
|---|---|---|
| State persistence | ✅ | ✅ |
| Time decay | ✅ | ✅ |
| Circuit breakers | ✅ | ✅ |
| Event application | ❌ | ✅ |
| Drift detection | ❌ | ✅ |
| Event audit log | ❌ | ✅ |
| Multi-persona | ❌ | ✅ |
| Matrix learning | ❌ | ❌ (explicitly out of scope) |

Phase 0 = decay + breakers only. Already useful for "does my agent degrade over time?"
