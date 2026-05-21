import type { State, BreakerRule, BreakerResult } from "./types.js";

/**
 * Check all circuit breaker rules against current state.
 * Pure function: returns which breakers fired. Does NOT execute actions.
 *
 * Only fixed-core params (stability, vigilance) can have breakers.
 *
 * @param state - Current state
 * @param rules - Array of breaker rules
 * @returns Array of results indicating which breakers fired
 */
export function checkBreakers(state: State, rules: BreakerRule[]): BreakerResult[] {
  return rules.map((rule) => {
    const currentValue = state.params[rule.param] ?? 1.0;
    const fired =
      rule.direction === "below"
        ? currentValue < rule.threshold
        : currentValue > rule.threshold;

    return {
      ruleId: rule.id,
      fired,
      param: rule.param,
      currentValue,
      threshold: rule.threshold,
      action: rule.action,
      message: rule.message,
    };
  });
}

/**
 * Get only the fired breakers.
 */
export function getFiredBreakers(state: State, rules: BreakerRule[]): BreakerResult[] {
  return checkBreakers(state, rules).filter((r) => r.fired);
}

/**
 * Default hysteresis margin around the threshold for auto-recovery.
 * Prevents breakers from flapping when the parameter hovers near the threshold.
 */
const DEFAULT_HYSTERESIS = 0.05;

/**
 * Check whether currently-active breakers have recovered.
 *
 * Pure function: inspects state.activeBreakers and returns which IDs are now
 * resolved (auto-recovery only) and which remain active. Manual-reset breakers
 * are NEVER auto-resolved here — the caller / adapter must clear them
 * explicitly via an operator-driven reset path.
 *
 * Recovery semantics (auto only):
 *  - direction "below": resolved when currentValue >= threshold + hysteresis
 *  - direction "above": resolved when currentValue <= threshold - hysteresis
 *
 * Edge cases:
 *  - Active IDs without a matching rule are kept in stillActive (cannot decide).
 *  - Missing param values default to 1.0 (consistent with checkBreakers).
 *
 * @param state - Current state (after decay/applyEvent).
 * @param rules - Full set of breaker rules (used to look up direction/threshold).
 * @returns resolved IDs (auto-recovered) and stillActive IDs (manual or still tripped).
 */
export function resolveBreakers(
  state: State,
  rules: BreakerRule[]
): { resolved: string[]; stillActive: string[] } {
  const active = state.activeBreakers ?? [];
  if (active.length === 0) {
    return { resolved: [], stillActive: [] };
  }

  const ruleById = new Map<string, BreakerRule>();
  for (const rule of rules) {
    ruleById.set(rule.id, rule);
  }

  const resolved: string[] = [];
  const stillActive: string[] = [];

  for (const id of active) {
    const rule = ruleById.get(id);
    if (!rule) {
      // Unknown rule — cannot evaluate; keep it active to be safe.
      stillActive.push(id);
      continue;
    }

    const resetMode = rule.resetMode ?? "auto";
    if (resetMode === "manual") {
      stillActive.push(id);
      continue;
    }

    const hysteresis = rule.hysteresis ?? DEFAULT_HYSTERESIS;
    const currentValue = state.params[rule.param] ?? 1.0;

    const recovered =
      rule.direction === "below"
        ? currentValue >= rule.threshold + hysteresis
        : currentValue <= rule.threshold - hysteresis;

    if (recovered) {
      resolved.push(id);
    } else {
      stillActive.push(id);
    }
  }

  return { resolved, stillActive };
}
