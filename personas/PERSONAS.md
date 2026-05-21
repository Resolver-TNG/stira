# Personas

Test personas for Stira validation. All are original creations — no IP dependencies.

## Design Philosophy

Each persona is defined primarily by its **matrix topology** — the pattern of how stimuli connect to parameters. Two key principles:

1. **The matrix IS the personality.** Same parameters, different matrix → completely different behavior.
2. **Personality shows in contradictions.** What makes a character interesting is WHERE it deviates from "reasonable" defaults.

## Included Personas

### Cautious Archivist
- **Core trait:** Works harder under stress (diligence rises with uncertainty/loss)
- **Weakness:** Low curiosity → misses important signals
- **Validates:** Stability-through-routine hypothesis

### Restless Scout
- **Core trait:** Curious about threats (positive curiosity for danger)
- **Weakness:** Bored by success (curiosity drops after achievement)
- **Validates:** High-decay recovery patterns

### Steady Guardian
- **Core trait:** Protective response dominates (threat → protectiveness 0.9)
- **Weakness:** High stability threshold means brittle when finally crossed
- **Validates:** "Stability under load" — maximum drift resistance

## Pathological Test Fixtures

These personas are intentionally extreme. They exist to exercise specific engine code paths and edge cases. Use them as regression fixtures, not as references for "good" persona design.

### Volatile Artist
- **Core trait:** Extreme matrix amplitudes; small stimuli cause large parameter swings
- **Pathology:** Starting stability 0.45, most stimuli push it lower
- **Validates:** Rapid drift, breaker firing under cascade conditions, hysteresis on recovery

### Paranoid Sentinel
- **Core trait:** Hyper-vigilance; treats most stimuli as threat-adjacent
- **Pathology:** Starting vigilance 0.75, threat/uncertainty push past 0.95 quickly
- **Validates:** `direction: "above"` breakers, vigilance decay floor, ADR-005 (custom params cannot fire breakers)

### Apathetic Observer
- **Core trait:** Tiny matrix deltas; nothing moves much
- **Pathology:** Parameters drift to decay floors and stay there
- **Validates:** Decay floor clamping, flat-line drift detection, accumulation of tiny deltas without floating-point error

### Bipolar Oscillator
- **Core trait:** Joy and loss have nearly opposite-sign responses across most parameters
- **Pathology:** Alternating stimuli cause wild oscillation
- **Validates:** Drift / phase-distortion detection, repeated breaker fire-and-recover without flapping, matrix immutability invariant

## Creating Your Own

1. Start from `steady-guardian.json` as template
2. Define your custom parameter (replace `protectiveness`/`boldness`/`diligence`)
3. Set your matrix — ask "when X happens, what SHOULD this personality feel?"
4. Set breaker thresholds based on how much instability the persona tolerates
5. Run tests: `node engine/test/persona-validate.js your-persona.json`

## Key Validation Questions

For each persona, ask:
- Does the matrix tell a consistent story?
- Are there interesting contradictions (not just "everything goes up with joy")?
- Do the breaker thresholds match the persona's risk tolerance?
- Does the decay configuration create realistic equilibrium behavior?
