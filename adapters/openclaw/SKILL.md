---
name: stira
description: >
  Agent state machine with circuit breakers and phase drift detection.
  Manages persistent behavioral parameters that decay over time, detects
  personality drift, and enforces safety constraints on long-running sessions.
  Use when configuring agent emotional/behavioral state, running state decay,
  or checking agent personality stability.
metadata:
  openclaw:
    emoji: "⚡"
    requires:
      bins: ["node"]
---

# Stira — Agent State Engine

Persistent behavioral state with safety guarantees for AI agents.

## When to Use

✅ **USE this skill when:**
- Setting up agent behavioral parameters
- Running periodic state decay (cron)
- Checking circuit breakers after events
- Detecting personality drift
- Diagnosing agent behavior changes

❌ **DON'T use when:**
- Managing conversation memory (use MemGPT/Letta)
- Defining agent personality text (that's SOUL.md/CLAUDE.md)
- One-off stateless queries

## Integration Points

### 1. Session Start — Load State (~200 tokens)
Read `state.json` and inject into context:
```bash
cat .stira/state.json | jq '{params, activeBreakers}'
```

### 2. After Significant Events — Apply Event
When something emotionally significant happens:
```bash
node ${SKILL_DIR}/dist/apply-event.js \
  --category "achievement" \
  --intensity 0.7 \
  --rationale "Completed major task successfully"
```

### 3. Cron (every 5min) — Decay + Breakers + Drift
```bash
node ${SKILL_DIR}/dist/decay-cron.js
```

Register with OpenClaw:
```json
{
  "schedule": { "kind": "every", "everyMs": 300000 },
  "payload": { "kind": "agentTurn", "message": "Run Stira decay cycle" },
  "sessionTarget": "isolated"
}
```

### 4. Breaker Response
When `decay-cron` detects a fired breaker, it writes to `.stira/alerts.json`.
Main agent checks this on session start and acts accordingly.

## File Layout (per-agent)

```
.stira/
├── state.json          # Current state vector
├── matrix.json         # Stimulus-response matrix (+ baseline)
├── config.json         # Decay rules + breaker rules + drift config
├── events.jsonl        # Append-only event log (audit trail)
└── alerts.json         # Pending breaker alerts
```

## Setup

Build once after install:
```bash
npm install
npm run build --workspaces --if-present
```

Then initialize an agent state directory:
```bash
node ${SKILL_DIR}/dist/init.js --persona steady-guardian
```

This creates `.stira/` with state, matrix, and config from the chosen persona template.

## Customization

See [references/customization.md](references/customization.md) for:
- Adding custom parameters
- Modifying matrix topology
- Adjusting decay rates
- Creating custom breaker rules
