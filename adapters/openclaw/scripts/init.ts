#!/usr/bin/env node
/**
 * Stira OpenClaw adapter — init.ts
 *
 * Initialize a `.stira/` directory from a persona JSON.
 *
 * Usage:
 *   node init.ts <path-to-persona.json> [--cwd <dir>]
 *
 * Effect:
 *   Creates `.stira/` (in --cwd or process.cwd()) containing:
 *     - state.json   : initial State (params from persona, version 1)
 *     - matrix.json  : initial Matrix (triggers + frozen baseline, version 1)
 *     - config.json  : DecayConfig + breakers (+ drift defaults)
 *
 * Side effects: filesystem only. No engine mutations.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type {
  State,
  Matrix,
  Config,
  BreakerRule,
  DecayConfig,
} from "@stira/engine";

interface PersonaJSON {
  name: string;
  description?: string;
  params: Record<string, number>;
  matrix: Record<string, Record<string, number>>;
  decay?: { rules: Array<{ param: string; ratePerHour: number; floor: number }> };
  breakers?: BreakerRule[];
  notes?: string;
}

interface ParsedArgs {
  personaPath: string;
  cwd: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  if (args.length === 0) {
    process.stderr.write(
      "Usage: node init.ts <path-to-persona.json> [--cwd <dir>]\n"
    );
    process.exit(1);
  }

  let personaPath: string | undefined;
  let cwd: string = process.cwd();

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--cwd" && args[i + 1]) {
      cwd = args[++i];
    } else if (a === "--persona" && args[i + 1]) {
      personaPath = args[++i];
    } else if (!a.startsWith("--") && personaPath === undefined) {
      personaPath = a;
    }
  }

  if (!personaPath) {
    process.stderr.write("Error: persona path is required\n");
    process.exit(1);
  }

  return { personaPath, cwd };
}

function loadPersona(path: string): PersonaJSON {
  const raw = readFileSync(resolve(path), "utf-8");
  return JSON.parse(raw) as PersonaJSON;
}

function buildState(persona: PersonaJSON, now: string): State {
  return {
    version: 1,
    params: { ...persona.params },
    updated: now,
  };
}

function buildMatrix(persona: PersonaJSON): Matrix {
  // Deep-clone so triggers and baseline are independent objects.
  // (Sharing is safe for pure-function engine but breaks the
  // "baseline never changes" guarantee if a future tool edits triggers.)
  const cloned = JSON.parse(JSON.stringify(persona.matrix)) as Matrix["triggers"];
  const baseline = JSON.parse(JSON.stringify(persona.matrix)) as Matrix["baseline"];
  return {
    version: 1,
    triggers: cloned,
    baseline,
  };
}

function buildConfig(persona: PersonaJSON): Config {
  const decayConfig: DecayConfig = persona.decay ?? { rules: [] };
  const breakers: BreakerRule[] = persona.breakers ?? [];
  return {
    decay: decayConfig,
    drift: {
      threshold: 0.5,
      checkIntervalMs: 3_600_000, // 1 hour
    },
    breakers,
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

function main(): void {
  const { personaPath, cwd } = parseArgs(process.argv);

  const persona = loadPersona(personaPath);

  const stiraDir = resolve(cwd, ".stira");
  if (!existsSync(stiraDir)) {
    mkdirSync(stiraDir, { recursive: true });
  }

  const now = new Date().toISOString();

  const state = buildState(persona, now);
  const matrix = buildMatrix(persona);
  const config = buildConfig(persona);

  writeJson(join(stiraDir, "state.json"), state);
  writeJson(join(stiraDir, "matrix.json"), matrix);
  writeJson(join(stiraDir, "config.json"), config);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        persona: persona.name,
        path: stiraDir,
        params: state.params,
      },
      null,
      2
    ) + "\n"
  );
}

main();
