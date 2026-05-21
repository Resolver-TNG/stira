import type { State, Event, Matrix } from "./types.js";

/**
 * Apply an event to state using the stimulus-response matrix.
 * Pure function: no side effects, no LLM calls.
 *
 * delta[param] = matrix[event.category][param] * event.intensity
 * Result is clamped to [0.0, 1.0].
 *
 * @param state - Current state
 * @param event - Incoming event (category + intensity already determined by adapter)
 * @param matrix - Stimulus-response matrix
 * @returns New state after applying event deltas
 * @throws Error if state.version !== 1 or matrix.version !== 1
 */
export function applyEvent(state: State, event: Event, matrix: Matrix): State {
  if (state.version !== 1) {
    throw new Error(`Version mismatch: expected 1, got ${state.version as number} (state)`);
  }
  if (matrix.version !== 1) {
    throw new Error(`Version mismatch: expected 1, got ${matrix.version as number} (matrix)`);
  }
  const categoryWeights = matrix.triggers[event.category];
  if (!categoryWeights) return state; // Unknown category, no-op

  const newParams = { ...state.params };

  for (const [param, weight] of Object.entries(categoryWeights)) {
    if (!(param in newParams)) continue;

    const delta = weight * event.intensity;
    const newValue = Math.min(1.0, Math.max(0.0, newParams[param] + delta));
    newParams[param] = Math.round(newValue * 1000) / 1000;
  }

  return {
    ...state,
    params: newParams,
    updated: event.timestamp,
  };
}
