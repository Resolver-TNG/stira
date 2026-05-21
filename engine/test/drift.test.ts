import { describe, it, expect } from "vitest";
import { detectDrift } from "../src/drift.js";
import type { Matrix } from "../src/types.js";

const baseline: Matrix = {
  version: 1,
  triggers: {
    joy: { curiosity: 0.7, vigilance: -0.2, stability: 0.4 },
    threat: { vigilance: 0.9, stability: -0.4, curiosity: 0.2 },
  },
  baseline: {
    joy: { curiosity: 0.7, vigilance: -0.2, stability: 0.4 },
    threat: { vigilance: 0.9, stability: -0.4, curiosity: 0.2 },
  },
};

describe("detectDrift", () => {
  it("should report no drift for identical matrices", () => {
    const report = detectDrift(baseline, baseline);
    expect(report.drifted).toBe(false);
    expect(report.details).toHaveLength(0);
    expect(report.signFlips).toHaveLength(0);
  });

  it("should detect drift above threshold", () => {
    const drifted: Matrix = {
      ...baseline,
      triggers: {
        ...baseline.triggers,
        joy: { curiosity: 0.1, vigilance: -0.2, stability: 0.4 }, // curiosity: 0.7→0.1, delta=0.6
      },
    };
    const report = detectDrift(drifted, baseline, 0.5);
    expect(report.drifted).toBe(true);
    expect(report.details).toHaveLength(1);
    expect(report.details[0].param).toBe("curiosity");
    expect(report.details[0].delta).toBeCloseTo(0.6);
  });

  it("should detect sign flips as phase collapse risk", () => {
    const flipped: Matrix = {
      ...baseline,
      triggers: {
        ...baseline.triggers,
        joy: { curiosity: -0.3, vigilance: -0.2, stability: 0.4 }, // curiosity flipped: +0.7 → -0.3
      },
    };
    const report = detectDrift(flipped, baseline, 0.5);
    expect(report.drifted).toBe(true);
    expect(report.signFlips).toHaveLength(1);
    expect(report.signFlips[0]).toEqual({ trigger: "joy", param: "curiosity" });
  });

  it("should not flag zero values as sign flips", () => {
    const zeroed: Matrix = {
      ...baseline,
      triggers: {
        ...baseline.triggers,
        joy: { curiosity: 0, vigilance: -0.2, stability: 0.4 },
      },
    };
    const report = detectDrift(zeroed, baseline, 0.5);
    expect(report.signFlips).toHaveLength(0);
  });
});
