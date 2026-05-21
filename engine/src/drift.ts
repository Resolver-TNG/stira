import type { Matrix, DriftReport } from "./types.js";

/**
 * Detect phase drift between current matrix and baseline.
 * Pure function: compares every cell and reports deviations.
 *
 * A sign flip (positive→negative or vice versa) indicates
 * potential personality inversion — the most dangerous form of drift.
 *
 * @param current - Current effective matrix (may have been modified)
 * @param baseline - Original matrix at initialization (never modified)
 * @param threshold - Absolute deviation that counts as "drifted" (default 0.5)
 * @returns Drift report with details and sign flips
 */
export function detectDrift(
  current: Matrix,
  baseline: Matrix,
  threshold: number = 0.5
): DriftReport {
  const details: DriftReport["details"] = [];
  const signFlips: DriftReport["signFlips"] = [];

  for (const [trigger, baseWeights] of Object.entries(baseline.triggers)) {
    const curWeights = current.triggers[trigger];
    if (!curWeights) continue;

    for (const [param, baseVal] of Object.entries(baseWeights)) {
      const curVal = curWeights[param] ?? 0;
      const delta = Math.abs(curVal - baseVal);

      if (delta >= threshold) {
        details.push({ trigger, param, baseline: baseVal, current: curVal, delta });
      }

      // Sign flip detection (excluding zero values)
      if (baseVal !== 0 && curVal !== 0 && Math.sign(baseVal) !== Math.sign(curVal)) {
        signFlips.push({ trigger, param });
      }
    }
  }

  return {
    drifted: details.length > 0 || signFlips.length > 0,
    timestamp: new Date().toISOString(),
    details,
    signFlips,
  };
}
