import { describe, it, expect } from "vitest";
import { decay } from "../src/decay.js";
import type { State, DecayConfig } from "../src/types.js";

const baseState: State = {
  version: 1,
  params: { stability: 0.9, vigilance: 0.5, curiosity: 0.8, satisfaction: 0.7 },
  updated: "2026-01-01T00:00:00Z",
};

const config: DecayConfig = {
  rules: [
    { param: "curiosity", ratePerHour: 0.05, floor: 0.3 },
    { param: "satisfaction", ratePerHour: 0.05, floor: 0.2 },
    { param: "vigilance", ratePerHour: 0.025, floor: 0.1 },
  ],
};

describe("decay", () => {
  it("should not change state for zero elapsed time", () => {
    const result = decay(baseState, 0, config);
    expect(result.params).toEqual(baseState.params);
  });

  it("should decay parameters proportionally to elapsed time", () => {
    // 2 hours elapsed
    const result = decay(baseState, 7_200_000, config, "2026-01-01T02:00:00Z");
    expect(result.params.curiosity).toBeCloseTo(0.7, 2); // 0.8 - 0.05*2
    expect(result.params.satisfaction).toBeCloseTo(0.6, 2); // 0.7 - 0.05*2
    expect(result.params.vigilance).toBeCloseTo(0.45, 2); // 0.5 - 0.025*2
    expect(result.updated).toBe("2026-01-01T02:00:00Z");
  });

  it("should respect floor values", () => {
    // 24 hours elapsed — curiosity should hit floor
    const result = decay(baseState, 86_400_000, config, "2026-01-02T00:00:00Z");
    expect(result.params.curiosity).toBe(0.3); // floor
    expect(result.params.satisfaction).toBe(0.2); // floor
  });

  it("should not decay parameters without rules", () => {
    const result = decay(baseState, 86_400_000, config, "2026-01-02T00:00:00Z");
    expect(result.params.stability).toBe(0.9); // no decay rule
  });

  it("should not modify original state (immutability)", () => {
    const original = JSON.parse(JSON.stringify(baseState));
    decay(baseState, 7_200_000, config, "2026-01-01T02:00:00Z");
    expect(baseState).toEqual(original);
  });

  it("should be deterministic (same input → same output)", () => {
    const now = "2026-06-15T12:00:00Z";
    const a = decay(baseState, 3_600_000, config, now);
    const b = decay(baseState, 3_600_000, config, now);
    expect(a).toEqual(b);
  });
});
