#!/usr/bin/env node
/**
 * Stira OpenClaw adapter — status.ts
 *
 * Print the current persisted State as pretty JSON.
 *
 * Usage:
 *   node status.ts [--cwd <dir>]
 *
 * Reads:
 *   .stira/state.json
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { State } from "@stira/engine";

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

function main(): void {
  const { cwd } = parseArgs(process.argv);
  const statePath = join(resolve(cwd, ".stira"), "state.json");
  const raw = readFileSync(statePath, "utf-8");
  const state = JSON.parse(raw) as State;
  process.stdout.write(JSON.stringify(state, null, 2) + "\n");
}

main();
