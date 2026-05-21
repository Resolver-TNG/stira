# Getting Started

## Quick Setup (OpenClaw)

### 1. Install the skill
```bash
# Copy stira adapter to your skills directory
cp -r adapters/openclaw ~/.openclaw/skills/stira
```

### 2. Initialize state
```bash
cd ~/.openclaw/workspace
node ~/.openclaw/skills/stira/scripts/init.ts --persona steady-guardian
```

This creates `.stira/` in your workspace with:
- `state.json` — Initial parameter values
- `matrix.json` — Stimulus-response matrix (+ frozen baseline)
- `config.json` — Decay rules and breaker thresholds

### 3. Register decay cron
```
/cron add --name "stira-decay" --every 300000 --isolated \
  "Run Stira decay: read .stira/state.json, apply time decay, check breakers, write back"
```

### 4. Add to your AGENTS.md
```markdown
## State Engine
On session start, read `.stira/state.json` and note:
- Current params (especially stability)
- Any active breakers

After significant emotional events, run the Stira apply-event script.
```

## Quick Setup (Claude Code)

### 1. Install the skill
```bash
cp -r adapters/claude-code ~/.claude/skills/stira
```

### 2. Initialize
```bash
node ~/.claude/skills/stira/scripts/init.js --persona steady-guardian
```

### 3. Add hook (optional)
Add to `.claude/settings.json`:
```json
{
  "hooks": {
    "Stop": [{
      "command": "node .claude/skills/stira/scripts/decay.js --quiet"
    }]
  }
}
```

## Verifying It Works

```bash
# Check current state
cat .stira/state.json | jq '.params'

# Simulate 2 hours of decay
node engine/src/decay.js --elapsed 7200000

# Apply a test event
node scripts/apply-event.js --category joy --intensity 0.8

# Check for drift
node scripts/check-drift.js
```

## Next Steps

- [Customization Guide](customization.md) — Modify parameters, matrix, thresholds
- [Architecture](architecture.md) — Understand the internals
- [Personas](../personas/PERSONAS.md) — Create your own test persona
