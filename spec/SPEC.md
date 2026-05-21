# Stira Specification v0.1.0

## Overview

Stira defines a **constrained state machine** for AI agents. It provides:
- A parameterized behavioral state vector
- A stimulus-response matrix defining personality topology
- Time-based decay toward equilibrium
- Circuit breakers for safety enforcement
- Phase drift detection for personality stability monitoring

## Core Concepts

### State Vector
An ordered set of named parameters, each bounded [0.0, 1.0].

**Fixed Core (cannot be removed):**
- `stability` — Self-consistency measure. Circuit breaker anchor.
- `vigilance` — Threat awareness level. Security breaker anchor.

**Recommended Extensions (user may modify/replace):**
- `trust`, `curiosity`, `satisfaction`, `attachment`

**Custom Parameters:**
- Users may add arbitrary parameters. Breakers can only bind to fixed core.

### Stimulus-Response Matrix
A mapping: `trigger_category → parameter_deltas`

Each cell `matrix[category][param]` is a float [-1.0, 1.0] representing how strongly a stimulus of that category affects that parameter.

The matrix IS the personality. Two agents with identical parameters but different matrices will respond differently to the same stimuli.

### Events
An event represents something that happened which may affect state:
- `category`: Which trigger category (from matrix columns)
- `intensity`: How strong (0.0-1.0)
- `rationale`: Why this category was chosen (audit trail)
- `source`: Origin ("user", "system", "tool", "self")

### Decay
Parameters drift toward a configured baseline over time. Rate is per-parameter, configurable. Decay happens externally (cron/hook), not inside the LLM context.

### Circuit Breakers
Rules that fire when a parameter crosses a threshold:
- `warn`: Log a warning
- `block`: Prevent specific actions
- `notify`: Alert the operator

Only fixed-core parameters (`stability`, `vigilance`) can trigger breakers. This prevents users from accidentally creating unstable safety mechanisms.

### Phase Drift Detection
Compares the current effective matrix against a baseline:
- Absolute deviation > threshold → drift warning
- Sign flip on any cell → phase collapse risk (personality inversion)

## Data Flow

```
Event occurs (in conversation)
    ↓
Adapter: categorize event (LLM or rules)
    ↓
Engine: applyEvent(state, event, matrix) → new state
    ↓
Engine: checkBreakers(state, rules) → actions
    ↓
Adapter: persist state, execute breaker actions

─── separately (cron/hook) ───

Engine: decay(state, elapsed, config) → decayed state
Engine: detectDrift(current, baseline) → report
```

## File Formats

See individual schema files:
- `state.schema.json` — State vector + metadata
- `matrix.schema.json` — Stimulus-response matrix
- `event.schema.json` — Event log entries
- `breaker.schema.json` — Circuit breaker rules
- `config.schema.json` — Decay rates, thresholds, options
