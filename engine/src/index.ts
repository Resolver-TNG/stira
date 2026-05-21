export type {
  State,
  Matrix,
  Event,
  DecayConfig,
  DecayRule,
  BreakerRule,
  BreakerResult,
  DriftReport,
  DriftDetail,
  Config,
  TraceRecord,
  BcWindowOptions,
  BcWindowResult,
} from "./types.js";

export { decay } from "./decay.js";
export { ensureDecayFresh, DEFAULT_STALENESS_MS } from "./lazy-decay.js";
export type { LazyDecayOptions, LazyDecayResult } from "./lazy-decay.js";
export { applyEvent } from "./apply-event.js";
export { checkBreakers, getFiredBreakers, resolveBreakers } from "./breaker.js";
export { detectDrift } from "./drift.js";
export { bcWindow } from "./metrics.js";
