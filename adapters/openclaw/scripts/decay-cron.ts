#!/usr/bin/env node
/**
 * Stira OpenClaw adapter — decay-cron.ts
 *
 * Apply time-based decay since `state.updated` and check breakers.
 *
 * Usage:
 *   node decay-cron.ts [--cwd <dir>]
 *
 * Reads:
 *   .stira/state.json
 *   .stira/config.json
 *
 * Writes:
 *   .stira/state.json (updated params + activeBreakers + updated timestamp)
 *
 * Stdout:
 *   JSON summary including elapsedMs, fired breakers, and new params.
 *   Adapters can grep this for the `firedBreakers` array to surface alerts.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { decay, getFiredBreakers, resolveBreakers } from "@stira/engine";
import type {
  State,
  Config,
  BreakerResult,
} from "@stira/engine";

interface ParsedArgs {
  cwd: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let cwd: string = process.cwd();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cwd" && args[i + 1]) {
      cwd = args[++i];
    }
  }
  return { cwd };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

function main(): void {
  const { cwd } = parseArgs(process.argv);
  const stiraDir = resolve(cwd, ".stira");
  const statePath = join(stiraDir, "state.json");
  const configPath = join(stiraDir, "config.json");

  const state = readJson<State>(statePath);
  const config = readJson<Config>(configPath);

  const nowIso = new Date().toISOString();
  const previousUpdated = new Date(state.updated).getTime();
  const nowMs = new Date(nowIso).getTime();
  const elapsedMs = Math.max(0, nowMs - previousUpdated);

  // Decay (no-op when elapsedMs <= 0)
  const decayed: State = decay(state, elapsedMs, config.decay, nowIso);

  // Resolve previously-active breakers that have recovered (auto-reset only).
  // Manual-reset breakers stay in stillActive until an operator clears them.
  const { resolved, stillActive } = resolveBreakers(decayed, config.breakers);

  // Re-evaluate breakers against the freshly decayed state. Newly-fired IDs
  // are added; previously-active IDs that did NOT auto-recover (manual or
  // still tripped) are preserved via stillActive.
  const fired: BreakerResult[] = getFiredBreakers(decayed, config.breakers);
  const firedIds = fired.map((f) => f.ruleId);

  // Union of stillActive and newly-fired, deduped, with resolved IDs excluded.
  //
  // Logical guarantee: with hysteresis > 0 a single rule cannot appear in both
  // `resolved` and `firedIds` in the same tick (resolveBreakers requires the
  // value to have crossed past threshold ± hysteresis, which is mutually
  // exclusive with `getFiredBreakers` re-firing on the same threshold). The
  // `!resolvedSet.has(id)` filter therefore acts as a defensive belt-and-braces
  // guard against future hysteresis=0 configurations or rule edits.
  const resolvedSet = new Set(resolved);
  const activeBreakers = Array.from(
    new Set([...stillActive, ...firedIds])
  ).filter((id) => !resolvedSet.has(id));

  const next: State = {
    ...decayed,
    activeBreakers,
  };

  writeJson(statePath, next);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        elapsedMs,
        updated: next.updated,
        params: next.params,
        firedBreakers: fired,
        resolvedBreakers: resolved,
        activeBreakers,
      },
      null,
      2
    ) + "\n"
  );
}

main();
