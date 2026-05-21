import { describe, it, expect } from "vitest";
import { ensureDecayFresh, DEFAULT_STALENESS_MS } from "../src/lazy-decay.js";
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

describe("ensureDecayFresh", () => {
  it("returns the same state when within staleness window", () => {
    // 1 minute later → below the 5-minute default
    const result = ensureDecayFresh(baseState, config, {
      now: "2026-01-01T00:01:00Z",
    });
    expect(result.decayed).toBe(false);
    expect(result.reason).toBe("fresh");
    expect(result.state).toBe(baseState);
    expect(result.elapsedMs).toBe(60_000);
    expect(result.stalenessMs).toBe(DEFAULT_STALENESS_MS);
  });

  it("decays when state is older than the staleness window", () => {
    // 10 minutes later → past the 5-minute default
    const result = ensureDecayFresh(baseState, config, {
      now: "2026-01-01T00:10:00Z",
    });
    expect(result.decayed).toBe(true);
    expect(result.reason).toBe("stale");
    expect(result.elapsedMs).toBe(600_000);
    expect(result.state.updated).toBe("2026-01-01T00:10:00Z");
    // 10 minutes of curiosity decay at 0.05/h = ~0.0083
    expect(result.state.params.curiosity).toBeLessThan(baseState.params.curiosity);
  });

  it("respects an explicit stalenessMs override", () => {
    // 2 minutes elapsed, but override threshold to 1 minute → stale
    const result = ensureDecayFresh(baseState, config, {
      now: "2026-01-01T00:02:00Z",
      stalenessMs: 60_000,
    });
    expect(result.decayed).toBe(true);
    expect(result.reason).toBe("stale");
    expect(result.stalenessMs).toBe(60_000);
  });

  it("uses config.intervalMs as the default threshold when present", () => {
    const customConfig: DecayConfig = { ...config, intervalMs: 30_000 };
    // 1 minute elapsed > 30s threshold → stale
    const result = ensureDecayFresh(baseState, customConfig, {
      now: "2026-01-01T00:01:00Z",
    });
    expect(result.stalenessMs).toBe(30_000);
    expect(result.decayed).toBe(true);
  });

  it("forces decay regardless of staleness when force=true", () => {
    const result = ensureDecayFresh(baseState, config, {
      now: "2026-01-01T00:00:30Z", // only 30s elapsed
      force: true,
    });
    expect(result.decayed).toBe(true);
    expect(result.reason).toBe("forced");
    expect(result.elapsedMs).toBe(30_000);
  });

  it("does not mutate state when elapsedMs <= 0", () => {
    const result = ensureDecayFresh(baseState, config, {
      now: "2026-01-01T00:00:00Z", // identical to state.updated
    });
    expect(result.decayed).toBe(false);
    expect(result.reason).toBe("skipped");
    expect(result.state).toBe(baseState);
  });

  it("treats unparseable timestamps as a no-op", () => {
    const broken: State = { ...baseState, updated: "not-a-date" };
    const result = ensureDecayFresh(broken, config);
    expect(result.decayed).toBe(false);
    expect(result.reason).toBe("skipped");
    expect(result.state).toBe(broken);
  });
});
