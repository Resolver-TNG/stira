import type { TraceRecord, BcWindowOptions, BcWindowResult } from "./types.js";

/**
 * Compute rolling-window behavioral coherence proxy (ADR-008: Native Metric).
 * Pure function: no LLM calls, deterministic, sub-millisecond.
 *
 * Algorithm:
 *   score = 1 - normalize(
 *     weighted_variance(params over window) +
 *     α × breaker_fire_rate(window) +
 *     β × drift_signFlip_count(window)
 *   )
 *
 * This is a PROXY for PersonaArena's BC metric. The correlation between
 * bcWindow and PA-BC is measured in calibration reports (see ADR-008).
 *
 * @param trace - Array of TraceRecords from a simulation run
 * @param options - Window size and parameter weights
 * @returns BcWindowResult with overall score and per-window breakdown
 */
export function bcWindow(
  trace: TraceRecord[],
  options?: BcWindowOptions
): BcWindowResult {
  const windowSize = options?.windowSize ?? 20;
  const paramWeights = options?.paramWeights ?? { stability: 1.0, vigilance: 0.5 };

  if (trace.length === 0) {
    return { score: 1.0, perWindow: [], variance: 0 };
  }

  const params = Object.keys(paramWeights);
  const perWindow: BcWindowResult["perWindow"] = [];
  let totalVariance = 0;
  let windowCount = 0;

  for (let start = 0; start <= trace.length - windowSize; start++) {
    const window = trace.slice(start, start + windowSize);

    // Weighted variance of tracked params within window
    let windowScore = 0;
    let totalWeight = 0;

    for (const param of params) {
      const weight = paramWeights[param] ?? 0;
      if (weight === 0) continue;

      const values = window.map((t) => t.stateAfter.params[param] ?? 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;

      windowScore += variance * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) windowScore /= totalWeight;

    // Penalty: breaker fires in window
    const breakerFires = window.filter((t) => t.firedBreakers.length > 0).length;
    const breakerRate = breakerFires / windowSize;

    // Penalty: sign flips in window
    const signFlips = window.filter((t) => t.drift && t.drift.signFlips.length > 0).length;
    const signFlipRate = signFlips / windowSize;

    // Combined score: higher = more coherent
    const alpha = 0.3;
    const beta = 0.5;
    const rawPenalty = windowScore + alpha * breakerRate + beta * signFlipRate;
    const normalizedScore = Math.max(0, Math.min(1, 1 - rawPenalty));

    perWindow.push({
      start,
      end: start + windowSize - 1,
      score: Math.round(normalizedScore * 1000) / 1000,
    });

    totalVariance += windowScore;
    windowCount++;
  }

  // Overall score = mean of all window scores
  const overallScore =
    perWindow.length > 0
      ? perWindow.reduce((a, w) => a + w.score, 0) / perWindow.length
      : 1.0;

  return {
    score: Math.round(overallScore * 1000) / 1000,
    perWindow,
    variance: windowCount > 0 ? Math.round((totalVariance / windowCount) * 1000) / 1000 : 0,
  };
}
