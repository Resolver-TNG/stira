#!/usr/bin/env node
/**
 * Stira Claude Code / Kiro adapter — status.ts
 *
 * Print the current persisted State as pretty JSON.
 *
 * Lazy-decay runs before printing so the snapshot reflects time elapsed
 * since the last write — `status` is the most common "what does Stira
 * think right now?" query and stale numbers would be misleading.
 *
 * Usage:
 *   node status.js
 *
 * Reads:
 *   .stira/state.json
 *
 * Stdout:
 *   The full State document (post-lazy-decay), pretty-printed.
 *
 * Exit code: 0 on success, 1 on error.
 */

import { resolveStiraPaths, ensureInitialized, refreshState } from "./_shared.js";

function main(): void {
  try {
    const paths = resolveStiraPaths();
    ensureInitialized(paths);

    const { state } = refreshState(paths);
    process.stdout.write(JSON.stringify(state, null, 2) + "\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`status failed: ${msg}\n`);
    process.exit(1);
  }
}

main();
