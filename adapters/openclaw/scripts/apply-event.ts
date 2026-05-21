#!/usr/bin/env node
/**
 * Stira OpenClaw adapter — apply-event.ts
 *
 * Apply a categorized event to the persisted state.
 *
 * Usage:
 *   node apply-event.ts --category <cat> --intensity <0..1> [--rationale <text>] [--cwd <dir>]
 *
 * Reads:
 *   .stira/state.json
 *   .stira/matrix.json
 *   .stira/config.json
 *
 * Writes:
 *   .stira/state.json (new params + activeBreakers + updated timestamp = event timestamp)
 *
 * Stdout:
 *   JSON summary including new params and any fired breakers.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { applyEvent, getFiredBreakers } from "@stira/engine";
import type {
  State,
  Matrix,
  Event,
  Config,
  BreakerResult,
} from "@stira/engine";

interface ParsedArgs {
  category: string;
  intensity: number;
  rationale?: string;
  cwd: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let category: string | undefined;
  let intensityRaw: string | undefined;
  let rationale: string | undefined;
  let cwd: string = process.cwd();

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--category" && args[i + 1]) {
      category = args[++i];
    } else if (a === "--intensity" && args[i + 1]) {
      intensityRaw = args[++i];
    } else if (a === "--rationale" && args[i + 1]) {
      rationale = args[++i];
    } else if (a === "--cwd" && args[i + 1]) {
      cwd = args[++i];
    }
  }

  if (!category || intensityRaw === undefined) {
    process.stderr.write(
      "Usage: node apply-event.ts --category <cat> --intensity <0..1> [--rationale <text>] [--cwd <dir>]\n"
    );
    process.exit(1);
  }

  const intensity = Number.parseFloat(intensityRaw);
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) {
    process.stderr.write(
      `Error: --intensity must be a number in [0, 1], got ${intensityRaw}\n`
    );
    process.exit(1);
  }

  return { category: category as string, intensity, rationale, cwd };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

function generateEventId(): string {
  // Lightweight unique id: timestamp + random suffix. Avoids any external deps.
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `evt-${t}-${r}`;
}

function main(): void {
  const { category, intensity, rationale, cwd } = parseArgs(process.argv);

  const stiraDir = resolve(cwd, ".stira");
  const statePath = join(stiraDir, "state.json");
  const matrixPath = join(stiraDir, "matrix.json");
  const configPath = join(stiraDir, "config.json");

  const state = readJson<State>(statePath);
  const matrix = readJson<Matrix>(matrixPath);
  const config = readJson<Config>(configPath);

  const nowIso = new Date().toISOString();
  const event: Event = {
    id: generateEventId(),
    timestamp: nowIso,
    category,
    intensity,
    rationale,
    source: "system",
  };

  const next = applyEvent(state, event, matrix);
  const fired: BreakerResult[] = getFiredBreakers(next, config.breakers);
  const finalState: State = {
    ...next,
    activeBreakers: fired.map((f) => f.ruleId),
  };

  writeJson(statePath, finalState);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        event: { id: event.id, category, intensity, rationale, timestamp: nowIso },
        params: finalState.params,
        firedBreakers: fired,
      },
      null,
      2
    ) + "\n"
  );
}

main();
