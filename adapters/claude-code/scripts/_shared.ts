/**
 * Stira CC/Kiro adapter — internal shared helpers.
 *
 * Centralises filesystem boilerplate so individual scripts stay short.
 * NOT a public API — adapter-internal only.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { ensureDecayFresh, getFiredBreakers } from "@stira/engine";
import type {
  State,
  Config,
  Matrix,
  BreakerResult,
  LazyDecayResult,
} from "@stira/engine";

export interface StiraPaths {
  dir: string;
  state: string;
  matrix: string;
  config: string;
  events: string;
}

export function resolveStiraPaths(cwd: string = process.cwd()): StiraPaths {
  const dir = resolve(cwd, ".stira");
  return {
    dir,
    state: join(dir, "state.json"),
    matrix: join(dir, "matrix.json"),
    config: join(dir, "config.json"),
    events: join(dir, "events.jsonl"),
  };
}

export function ensureInitialized(paths: StiraPaths): void {
  if (!existsSync(paths.state)) {
    process.stderr.write(
      `Error: .stira/ not initialized. Run init first.\n  expected: ${paths.state}\n`
    );
    process.exit(1);
  }
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

export interface RefreshedSnapshot {
  state: State;
  config: Config;
  matrix: Matrix;
  lazy: LazyDecayResult;
  fired: BreakerResult[];
  /**
   * True when the refreshed state was actually persisted to disk.
   * (We only write when decay produced a change.)
   */
  persisted: boolean;
}

export interface RefreshOptions {
  /** Force decay regardless of staleness (used by `decay --force` and `tick`). */
  force?: boolean;
  /** Override staleness threshold in ms. */
  stalenessMs?: number;
  /**
   * When false, the refreshed state is computed but NOT written back.
   * Useful for read-only commands that still want a fresh view.
   * Default: true.
   */
  persist?: boolean;
}

/**
 * Standard "load + lazy-decay + re-evaluate breakers + persist" flow used by
 * every adapter command. Centralised so the floor stays consistent.
 */
export function refreshState(
  paths: StiraPaths,
  options: RefreshOptions = {}
): RefreshedSnapshot {
  const state = readJson<State>(paths.state);
  const config = readJson<Config>(paths.config);
  const matrix = readJson<Matrix>(paths.matrix);

  const lazy = ensureDecayFresh(state, config.decay, {
    force: options.force,
    stalenessMs: options.stalenessMs,
  });

  // Re-evaluate breakers against (possibly) decayed state and union with
  // any previously-active ones. This mirrors decay.ts's semantics.
  const fired = getFiredBreakers(lazy.state, config.breakers);
  const previouslyActive = lazy.state.activeBreakers ?? [];
  const activeBreakers = Array.from(
    new Set([...previouslyActive, ...fired.map((f) => f.ruleId)])
  );

  const finalState: State = lazy.decayed
    ? { ...lazy.state, activeBreakers }
    : lazy.state;

  const shouldPersist = options.persist !== false && lazy.decayed;
  if (shouldPersist) {
    writeJson(paths.state, finalState);
  }

  return {
    state: finalState,
    config,
    matrix,
    lazy,
    fired,
    persisted: shouldPersist,
  };
}
