---
description: >
  Agent state machine with circuit breakers and drift detection.
  Manages persistent behavioral parameters, detects personality drift,
  and enforces safety constraints. Use when you need persistent agent
  state across sessions or want to monitor behavioral stability.
disable-model-invocation: true
---

# Stira — Agent State Engine

Persistent behavioral state with safety guarantees.

## Setup

```bash
node ${CLAUDE_SKILL_DIR}/scripts/init.js --persona steady-guardian
```

Creates `.stira/` directory with initial state from chosen persona.

## Current State

!`cat .stira/state.json 2>/dev/null | jq '{params, activeBreakers}' 2>/dev/null || echo "Not initialized. Run /stira init first."`

## Commands

### Apply Event
After significant interactions:
```bash
node ${CLAUDE_SKILL_DIR}/scripts/apply-event.js \
  --category "achievement" \
  --intensity 0.7 \
  --rationale "Task completed successfully"
```

### Check Status
```bash
node ${CLAUDE_SKILL_DIR}/scripts/status.js
```

### Run Decay (manual)
```bash
node ${CLAUDE_SKILL_DIR}/scripts/decay.js
```

### Check Drift
```bash
node ${CLAUDE_SKILL_DIR}/scripts/check-drift.js
```

## Hook Integration

Add to `.claude/settings.json` for automatic decay after tool use:

```json
{
  "hooks": {
    "Stop": [{
      "command": "node .claude/skills/stira/scripts/decay.js --quiet",
      "description": "Run Stira decay on session pause"
    }]
  }
}
```

## File Layout

```
.stira/
├── state.json       # Current parameters
├── matrix.json      # Personality topology
├── config.json      # Decay + breaker rules
└── events.jsonl     # Audit log
```
