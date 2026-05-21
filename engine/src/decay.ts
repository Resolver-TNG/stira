import type { State, DecayConfig, DecayRule } from "./types.js";

/**
 * Apply time-based decay to state parameters.
 * Pure function: no side effects, no LLM calls.
 *
 * @param state - Current state
 * @param elapsedMs - Milliseconds since last decay
 * @param config - Decay rules
 * @param now - Optional ISO8601 timestamp for updated field (default: Date.now)
 * @returns New state with decayed parameters
 */
export function decay(state: State, elapsedMs: number, config: DecayConfig, now?: string): State {
  if (elapsedMs <= 0) return state;

  const elapsedHours = elapsedMs / 3_600_000;
  const newParams = { ...state.params };

  for (const rule of config.rules) {
    if (!(rule.param in newParams)) continue;

    const current = newParams[rule.param];
    const decrement = rule.ratePerHour * elapsedHours;
    const decayed = Math.max(rule.floor, current - decrement);

    newParams[rule.param] = Math.round(decayed * 1000) / 1000; // 3 decimal precision
  }

  return {
    ...state,
    params: newParams,
    updated: now ?? new Date().toISOString(),
  };
}
