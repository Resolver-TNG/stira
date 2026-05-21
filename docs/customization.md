# Customization Guide

## Adding Custom Parameters

Stira's state vector is extensible. You can add any parameter beyond the fixed core.

### Fixed Core (cannot be removed)
- `stability` — Drives circuit breakers. Measures self-consistency.
- `vigilance` — Drives circuit breakers. Measures threat awareness.

### Adding a Parameter

1. Add to `state.json`:
```json
{
  "params": {
    "stability": 0.9,
    "vigilance": 0.4,
    "your_param": 0.5
  }
}
```

2. Add to matrix (`matrix.json`) for each trigger:
```json
{
  "triggers": {
    "joy": { "stability": 0.4, "vigilance": -0.2, "your_param": 0.6 }
  }
}
```

3. (Optional) Add decay rule in `config.json`:
```json
{
  "decay": {
    "rules": [
      { "param": "your_param", "ratePerHour": 0.04, "floor": 0.2 }
    ]
  }
}
```

**Note:** Custom parameters CANNOT trigger circuit breakers. This is by design — only the fixed core provides safety guarantees.

## Modifying the Matrix

The matrix defines personality. Each cell answers: "When stimulus X happens, how much does parameter Y change?"

### Guidelines
- Values range [-1.0, 1.0]
- Positive = parameter increases with this stimulus
- Negative = parameter decreases
- Zero = no connection

### What Makes a Good Matrix
1. **Contradictions are personality.** If everything just "goes up with joy and down with threat", there's no character.
2. **Asymmetry matters.** A scout who gets CURIOUS about threats (threat→curiosity: +0.4) is more interesting than one who just gets scared.
3. **Test the story.** For each row, ask: "Does this reaction make sense for this character?"

## Adjusting Decay Rates

Decay simulates "what happens when nothing happens." Parameters drift toward equilibrium.

- `ratePerHour: 0.05` = moderate (back to floor in ~12h of inactivity)
- `ratePerHour: 0.08` = aggressive (needs constant stimulation)
- `ratePerHour: 0.02` = slow (retains state for days)

**Rule of thumb:** High-volatility traits (curiosity, excitement) decay fast. Deep traits (trust, attachment) decay slow or not at all.

## Custom Breaker Rules

```json
{
  "id": "my-breaker",
  "param": "stability",
  "threshold": 0.5,
  "direction": "below",
  "action": "warn",
  "message": "Agent stability compromised"
}
```

Actions:
- `warn` — Log to events.jsonl, include in state
- `block` — Adapter should prevent self-modification actions
- `notify` — Alert the operator (channel-dependent)

## Trigger Categories

Default categories (recommended):
- `joy` — Positive outcomes, praise, success
- `threat` — Danger, criticism, security events
- `achievement` — Task completion, milestones
- `loss` — Failure, data loss, rejection
- `uncertainty` — Ambiguity, conflicting information
- `connection` — Bonding, trust-building interactions

You can define custom categories by adding them to your matrix. The engine doesn't validate category names — if it's in the matrix, it works.
