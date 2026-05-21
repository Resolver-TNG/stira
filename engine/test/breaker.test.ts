import { describe, it, expect } from "vitest";
import { checkBreakers, getFiredBreakers, resolveBreakers } from "../src/breaker.js";
import type { State, BreakerRule } from "../src/types.js";

const rules: BreakerRule[] = [
  {
    id: "stability-warn",
    param: "stability",
    threshold: 0.5,
    direction: "below",
    action: "warn",
    message: "Stability below 0.5 — self-modification restricted",
  },
  {
    id: "stability-critical",
    param: "stability",
    threshold: 0.3,
    direction: "below",
    action: "block",
    message: "Stability critical — all optimization halted",
  },
  {
    id: "vigilance-high",
    param: "vigilance",
    threshold: 0.9,
    direction: "above",
    action: "notify",
    message: "Vigilance spike — possible threat detected",
  },
];

describe("checkBreakers", () => {
  it("should not fire any breakers for healthy state", () => {
    const state: State = {
      version: 1,
      params: { stability: 0.8, vigilance: 0.3 },
      updated: "2026-01-01T00:00:00Z",
    };
    const results = checkBreakers(state, rules);
    expect(results.every((r) => !r.fired)).toBe(true);
  });

  it("should fire stability-warn when below 0.5", () => {
    const state: State = {
      version: 1,
      params: { stability: 0.45, vigilance: 0.3 },
      updated: "2026-01-01T00:00:00Z",
    };
    const fired = getFiredBreakers(state, rules);
    expect(fired.length).toBe(1);
    expect(fired[0].ruleId).toBe("stability-warn");
    expect(fired[0].action).toBe("warn");
  });

  it("should fire both stability breakers when below 0.3", () => {
    const state: State = {
      version: 1,
      params: { stability: 0.25, vigilance: 0.3 },
      updated: "2026-01-01T00:00:00Z",
    };
    const fired = getFiredBreakers(state, rules);
    expect(fired.length).toBe(2);
    expect(fired.map((r) => r.ruleId)).toContain("stability-warn");
    expect(fired.map((r) => r.ruleId)).toContain("stability-critical");
  });

  it("should fire vigilance-high when above 0.9", () => {
    const state: State = {
      version: 1,
      params: { stability: 0.8, vigilance: 0.95 },
      updated: "2026-01-01T00:00:00Z",
    };
    const fired = getFiredBreakers(state, rules);
    expect(fired.length).toBe(1);
    expect(fired[0].ruleId).toBe("vigilance-high");
  });
});

describe("resolveBreakers", () => {
  // Recovery test rules: warn=auto (default), block=manual, notify=auto.
  const recoveryRules: BreakerRule[] = [
    {
      id: "stability-warn",
      param: "stability",
      threshold: 0.5,
      direction: "below",
      action: "warn",
      message: "warn",
      // resetMode omitted — defaults to auto, hysteresis defaults to 0.05.
    },
    {
      id: "stability-block",
      param: "stability",
      threshold: 0.3,
      direction: "below",
      action: "block",
      message: "block",
      resetMode: "manual",
    },
    {
      id: "vigilance-high",
      param: "vigilance",
      threshold: 0.9,
      direction: "above",
      action: "notify",
      message: "notify",
      resetMode: "auto",
      hysteresis: 0.1,
    },
  ];

  it("should resolve warn breaker when value recovers past hysteresis", () => {
    // Threshold 0.5 below + default hysteresis 0.05 → recovers at >= 0.55.
    const state: State = {
      version: 1,
      params: { stability: 0.55, vigilance: 0.3 },
      updated: "2026-01-01T00:00:00Z",
      activeBreakers: ["stability-warn"],
    };
    const { resolved, stillActive } = resolveBreakers(state, recoveryRules);
    expect(resolved).toEqual(["stability-warn"]);
    expect(stillActive).toEqual([]);
  });

  it("should NOT resolve warn breaker when within hysteresis band", () => {
    // 0.52 < threshold(0.5) + hysteresis(0.05) → still active.
    const state: State = {
      version: 1,
      params: { stability: 0.52, vigilance: 0.3 },
      updated: "2026-01-01T00:00:00Z",
      activeBreakers: ["stability-warn"],
    };
    const { resolved, stillActive } = resolveBreakers(state, recoveryRules);
    expect(resolved).toEqual([]);
    expect(stillActive).toEqual(["stability-warn"]);
  });

  it("should NOT resolve block breaker (manual reset)", () => {
    // Even with stability fully restored, manual breaker stays active.
    const state: State = {
      version: 1,
      params: { stability: 0.9, vigilance: 0.3 },
      updated: "2026-01-01T00:00:00Z",
      activeBreakers: ["stability-block"],
    };
    const { resolved, stillActive } = resolveBreakers(state, recoveryRules);
    expect(resolved).toEqual([]);
    expect(stillActive).toEqual(["stability-block"]);
  });

  it("should respect custom hysteresis value", () => {
    // vigilance-high: threshold 0.9 above, hysteresis 0.1 → recovers at <= 0.8.
    const stillTripped: State = {
      version: 1,
      params: { stability: 0.8, vigilance: 0.85 }, // > 0.8 → not recovered yet
      updated: "2026-01-01T00:00:00Z",
      activeBreakers: ["vigilance-high"],
    };
    const a = resolveBreakers(stillTripped, recoveryRules);
    expect(a.resolved).toEqual([]);
    expect(a.stillActive).toEqual(["vigilance-high"]);

    const recovered: State = {
      version: 1,
      params: { stability: 0.8, vigilance: 0.8 }, // <= 0.8 → recovered
      updated: "2026-01-01T00:00:00Z",
      activeBreakers: ["vigilance-high"],
    };
    const b = resolveBreakers(recovered, recoveryRules);
    expect(b.resolved).toEqual(["vigilance-high"]);
    expect(b.stillActive).toEqual([]);
  });

  it("should handle empty activeBreakers", () => {
    const state: State = {
      version: 1,
      params: { stability: 0.8, vigilance: 0.3 },
      updated: "2026-01-01T00:00:00Z",
    };
    const r1 = resolveBreakers(state, recoveryRules);
    expect(r1).toEqual({ resolved: [], stillActive: [] });

    const stateWithEmpty: State = { ...state, activeBreakers: [] };
    const r2 = resolveBreakers(stateWithEmpty, recoveryRules);
    expect(r2).toEqual({ resolved: [], stillActive: [] });
  });

  it("should keep unknown active IDs in stillActive (no matching rule)", () => {
    const state: State = {
      version: 1,
      params: { stability: 0.9, vigilance: 0.3 },
      updated: "2026-01-01T00:00:00Z",
      activeBreakers: ["deprecated-rule-id"],
    };
    const { resolved, stillActive } = resolveBreakers(state, recoveryRules);
    expect(resolved).toEqual([]);
    expect(stillActive).toEqual(["deprecated-rule-id"]);
  });
});
