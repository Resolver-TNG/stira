// Stira Engine — Type Definitions
// All types are harness-agnostic. No LLM dependencies.

export interface State {
  version: 1;
  params: Record<string, number>;
  updated: string; // ISO8601
  transcription?: string;
  activeBreakers?: string[];
}

export interface Matrix {
  version: 1;
  triggers: Record<string, Record<string, number>>;
  baseline: Record<string, Record<string, number>>;
}

export interface Event {
  id: string;
  timestamp: string;
  category: string;
  intensity: number; // 0.0 - 1.0
  rationale?: string;
  source?: "user" | "system" | "tool" | "self";
  excerpt?: string;
  traceId?: string;
  turn?: number;
}

export interface DecayRule {
  param: string;
  ratePerHour: number;
  floor: number;
  condition?: string;
}

export interface DecayConfig {
  rules: DecayRule[];
  intervalMs?: number;
}

export interface BreakerRule {
  id: string;
  param: "stability" | "vigilance";
  threshold: number;
  direction: "below" | "above";
  action: "warn" | "block" | "notify";
  message: string;
  /**
   * Recovery mode for this breaker.
   * - "auto": breaker auto-resolves once value crosses back through threshold ± hysteresis (default for `warn`/`notify`).
   * - "manual": breaker stays active until explicitly cleared by an operator (recommended for `block`).
   * Default: "auto".
   */
  resetMode?: "auto" | "manual";
  /**
   * Margin around threshold for auto-recovery (prevents flapping).
   * For direction="below": resolved when currentValue >= threshold + hysteresis.
   * For direction="above": resolved when currentValue <= threshold - hysteresis.
   * Default: 0.05.
   */
  hysteresis?: number;
}

export interface BreakerResult {
  ruleId: string;
  fired: boolean;
  param: string;
  currentValue: number;
  threshold: number;
  action: "warn" | "block" | "notify";
  message: string;
  /**
   * True when a previously-active breaker is now resolved by this evaluation.
   * Only set by recovery checks (resolveBreakers); checkBreakers leaves it undefined.
   */
  recovered?: boolean;
}

export interface DriftDetail {
  trigger: string;
  param: string;
  baseline: number;
  current: number;
  delta: number;
}

export interface DriftReport {
  drifted: boolean;
  timestamp: string;
  details: DriftDetail[];
  signFlips: Array<{ trigger: string; param: string }>;
}

export interface Config {
  decay: DecayConfig;
  drift: {
    threshold: number;
    checkIntervalMs: number;
  };
  breakers: BreakerRule[];
}

// --- Trace & Metrics (ADR-007, ADR-008) ---

/**
 * A single step in a simulation trace.
 * This is Stira's canonical output for external evaluators (ADR-007).
 */
export interface TraceRecord {
  traceId: string;
  turn: number;
  event: Event;
  stateBefore: State;
  stateAfter: State;
  firedBreakers: BreakerResult[];
  drift: DriftReport | null;
}

/**
 * Options for the bcWindow native metric (ADR-008).
 * Computes rolling-window behavioral coherence proxy without LLM calls.
 */
export interface BcWindowOptions {
  /** Number of turns in sliding window. Default: 20 */
  windowSize?: number;
  /** Weight per parameter for coherence score. Default: stability=1.0, vigilance=0.5 */
  paramWeights?: Record<string, number>;
}

/**
 * Result from bcWindow computation.
 */
export interface BcWindowResult {
  /** Overall coherence score [0..1], higher = more consistent */
  score: number;
  /** Per-window breakdown */
  perWindow: Array<{ start: number; end: number; score: number }>;
  /** Raw weighted variance of tracked params across all turns */
  variance: number;
}
