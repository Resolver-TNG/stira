import { describe, it, expect } from "vitest";
import { applyEvent } from "../src/apply-event.js";
import type { State, Event, Matrix } from "../src/types.js";

const state: State = {
  version: 1,
  params: { stability: 0.8, vigilance: 0.3, curiosity: 0.5, satisfaction: 0.6 },
  updated: "2026-01-01T00:00:00Z",
};

const matrix: Matrix = {
  version: 1,
  triggers: {
    joy: { curiosity: 0.7, vigilance: -0.2, satisfaction: 0.9, stability: 0.4 },
    threat: { vigilance: 0.9, stability: -0.4, curiosity: 0.2, satisfaction: -0.3 },
  },
  baseline: {
    joy: { curiosity: 0.7, vigilance: -0.2, satisfaction: 0.9, stability: 0.4 },
    threat: { vigilance: 0.9, stability: -0.4, curiosity: 0.2, satisfaction: -0.3 },
  },
};

describe("applyEvent", () => {
  it("should apply joy event with intensity 0.5", () => {
    const event: Event = {
      id: "test-1",
      timestamp: "2026-01-01T01:00:00Z",
      category: "joy",
      intensity: 0.5,
    };
    const result = applyEvent(state, event, matrix);
    expect(result.params.curiosity).toBeCloseTo(0.85, 2); // 0.5 + 0.7*0.5
    expect(result.params.vigilance).toBeCloseTo(0.2, 2); // 0.3 + (-0.2)*0.5
    expect(result.params.satisfaction).toBeCloseTo(1.0, 2); // 0.6 + 0.9*0.5 = 1.05 → clamped to 1.0
  });

  it("should apply threat event with full intensity", () => {
    const event: Event = {
      id: "test-2",
      timestamp: "2026-01-01T01:00:00Z",
      category: "threat",
      intensity: 1.0,
    };
    const result = applyEvent(state, event, matrix);
    expect(result.params.vigilance).toBeCloseTo(1.0, 2); // 0.3 + 0.9 = 1.2 → clamped
    expect(result.params.stability).toBeCloseTo(0.4, 2); // 0.8 + (-0.4)
  });

  it("should ignore unknown categories", () => {
    const event: Event = {
      id: "test-3",
      timestamp: "2026-01-01T01:00:00Z",
      category: "unknown_category",
      intensity: 1.0,
    };
    const result = applyEvent(state, event, matrix);
    expect(result.params).toEqual(state.params);
  });

  it("should clamp to [0, 1]", () => {
    const lowState: State = { ...state, params: { ...state.params, vigilance: 0.05 } };
    const event: Event = {
      id: "test-4",
      timestamp: "2026-01-01T01:00:00Z",
      category: "joy",
      intensity: 1.0, // vigilance delta = -0.2
    };
    const result = applyEvent(lowState, event, matrix);
    expect(result.params.vigilance).toBe(0); // 0.05 - 0.2 → clamped to 0
  });

  it("should reject state with wrong version", () => {
    const badState = { ...state, version: 2 } as unknown as State;
    const event: Event = {
      id: "test-5",
      timestamp: "2026-01-01T01:00:00Z",
      category: "joy",
      intensity: 0.5,
    };
    expect(() => applyEvent(badState, event, matrix)).toThrow("Version mismatch");
  });

  it("should reject matrix with wrong version", () => {
    const badMatrix = { ...matrix, version: 2 } as unknown as Matrix;
    const event: Event = {
      id: "test-6",
      timestamp: "2026-01-01T01:00:00Z",
      category: "joy",
      intensity: 0.5,
    };
    expect(() => applyEvent(state, event, badMatrix)).toThrow("Version mismatch");
  });
});
