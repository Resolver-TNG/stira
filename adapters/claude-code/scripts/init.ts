#!/usr/bin/env node
/**
 * Stira Claude Code / Kiro adapter — init.ts
 *
 * Initialize a `.stira/` directory from a persona JSON.
 *
 * Usage:
 *   node init.js --persona <name-or-path>
 *
 * Persona resolution:
 *   1. If `--persona` looks like a path (contains `/` or ends with `.json`)
 *      it is resolved relative to process.cwd() (or used as-is if absolute).
 *   2. Otherwise it is treated as a bundled persona name and resolved from
 *      `<adapter>/../../personas/<name>.json` (the shared personas/ dir at
 *      the project root).
 *
 * Effect:
 *   Creates `.stira/` (in process.cwd()) containing:
 *     - state.json   : initial State (params from persona, version 1)
 *     - matrix.json  : initial Matrix (triggers + frozen baseline, version 1)
 *     - config.json  : DecayConfig + breakers (+ drift defaults)
 *
 * Exit code: 0 on success, 1 on error.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
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
  persona: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let persona: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--persona" && args[i + 1]) {
      persona = args[++i];
    } else if (!a.startsWith("--") && persona === undefined) {
      persona = a;
    }
  }

  if (!persona) {
    process.stderr.write(
      "Usage: node init.js --persona <name-or-path>\n"
    );
    process.exit(1);
  }

  return { persona };
}

function looksLikePath(input: string): boolean {
  return input.includes("/") || input.endsWith(".json") || isAbsolute(input);
}

function resolvePersonaPath(input: string): string {
  if (looksLikePath(input)) {
    return isAbsolute(input) ? input : resolve(process.cwd(), input);
  }
  // Bundled persona: scripts/init.ts → ../personas/<name>.json after build,
  // but at build time scripts live under dist/, so we walk up two dirs from
  // this file's directory to reach the adapter root, then up two more to
  // reach the project root, then into personas/.
  //
  // Layout:
  //   adapters/claude-code/dist/init.js   ← __filename at runtime
  //   adapters/claude-code/               ← adapter root
  //   ../../personas/<name>.json
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..", "personas", `${input}.json`);
}

function loadPersona(path: string): PersonaJSON {
  if (!existsSync(path)) {
    process.stderr.write(`Error: persona not found at ${path}\n`);
    process.exit(1);
  }
  const raw = readFileSync(path, "utf-8");
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
  try {
    const { persona: personaArg } = parseArgs(process.argv);
    const personaPath = resolvePersonaPath(personaArg);
    const persona = loadPersona(personaPath);

    const stiraDir = resolve(process.cwd(), ".stira");
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

    // Initialize an empty events.jsonl audit trail (touch only; do not clobber
    // an existing one if init is re-run).
    const eventsPath = join(stiraDir, "events.jsonl");
    if (!existsSync(eventsPath)) {
      writeFileSync(eventsPath, "", "utf-8");
    }

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          persona: persona.name,
          personaPath,
          path: stiraDir,
          params: state.params,
        },
        null,
        2
      ) + "\n"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`init failed: ${msg}\n`);
    process.exit(1);
  }
}

main();
