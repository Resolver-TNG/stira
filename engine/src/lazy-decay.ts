import type { State, DecayConfig } from "./types.js";
import { decay } from "./decay.js";

/**
 * Default staleness threshold before lazy-decay actually fires.
 * Five minutes balances "freshness" against churning state.json on every
 * CLI invocation. Override per-call or via DecayConfig.intervalMs.
 */
export const DEFAULT_STALENESS_MS = 5 * 60 * 1000;

export interface LazyDecayOptions {
  /**
   * Threshold in milliseconds. If state.updated is older than this, decay
   * is applied. Defaults to {@link DEFAULT_STALENESS_MS} (5 minutes), or
   * `config.intervalMs` when present.
   */
  stalenessMs?: number;
  /**
   * When true, decay is applied regardless of staleness. Useful for the
   * explicit `decay` command and for the SessionStart hook which always
   * wants a refreshed snapshot.
   */
  force?: boolean;
  /**
   * Optional ISO8601 timestamp injected as "now". When omitted the helper
   * uses Date.now() at call time.
   */
  now?: string;
}

export interface LazyDecayResult {
  /** New state — equal to input when no decay was applied. */
  state: State;
  /** True when {@link decay} was actually invoked and produced a new state. */
  decayed: boolean;
  /** Milliseconds between previous `state.updated` and "now". */
  elapsedMs: number;
  /** Resolved staleness threshold actually used for the decision. */
  stalenessMs: number;
  /**
   * "fresh"   → state newer than threshold, no decay applied.
   * "stale"   → state older than threshold, decay applied.
   * "forced"  → caller passed `force: true`, decay applied unconditionally.
   * "skipped" → elapsedMs <= 0 (clock skew or future-stamped state).
   */
  reason: "fresh" | "stale" | "forced" | "skipped";
}

/**
 * Catch-up decay: cheaply ensure persisted state reflects the time elapsed
 * since `state.updated`. Designed to be called at the start of every CLI
 * command (lazy-decay floor) and from the SessionStart hook (`stira tick`).
 *
 * Pure function — no I/O, no clocks beyond the optional `now` parameter
 * (falls back to Date.now()). Engine remains harness-agnostic.
 *
 * Internally delegates to {@link decay}; this helper only adds the
 * "should we decay right now?" decision and a small audit envelope.
 */
export function ensureDecayFresh(
  state: State,
  config: DecayConfig,
  options: LazyDecayOptions = {}
): LazyDecayResult {
  const stalenessMs =
    options.stalenessMs ??
    (typeof config.intervalMs === "number" && config.intervalMs > 0
      ? config.intervalMs
      : DEFAULT_STALENESS_MS);

  const nowIso = options.now ?? new Date().toISOString();
  const previousUpdated = Date.parse(state.updated);
  const nowMs = Date.parse(nowIso);

  // Defensive: if either timestamp is unparseable, treat the gap as zero
  // and do nothing. This keeps lazy-decay safe for malformed state files.
  const elapsedMs =
    Number.isFinite(previousUpdated) && Number.isFinite(nowMs)
      ? Math.max(0, nowMs - previousUpdated)
      : 0;

  if (elapsedMs <= 0 && !options.force) {
    return {
      state,
      decayed: false,
      elapsedMs: 0,
      stalenessMs,
      reason: "skipped",
    };
  }

  if (!options.force && elapsedMs < stalenessMs) {
    return {
      state,
      decayed: false,
      elapsedMs,
      stalenessMs,
      reason: "fresh",
    };
  }

  // For a forced run with zero elapsed time, decay() is still a no-op for
  // params but bumps `updated`. We only call it when elapsedMs > 0 to keep
  // the returned state byte-identical when nothing should change.
  if (elapsedMs <= 0) {
    return {
      state,
      decayed: false,
      elapsedMs: 0,
      stalenessMs,
      reason: "forced",
    };
  }

  const next = decay(state, elapsedMs, config, nowIso);

  return {
    state: next,
    decayed: true,
    elapsedMs,
    stalenessMs,
    reason: options.force ? "forced" : "stale",
  };
}
