#!/usr/bin/env node
/**
 * Stira Claude Code / Kiro adapter — decay.ts
 *
 * Force a decay catch-up and re-evaluate breakers.
 *
 * In the new automatic-execution model, the lazy-decay floor in every CLI
 * command (and the SessionStart `tick` hook) means an explicit `decay`
 * call is rarely necessary. This command remains available for manual
 * audits, cron jobs, and the OpenClaw variant that wants to drive decay
 * on its own schedule.
 *
 * Usage:
 *   node decay.js [--force] [--quiet]
 *
 *   --force   Apply decay even if state is fresh (default behaviour for this
 *             command — kept for symmetry with `tick`).
 *   --quiet   Suppress stdout (for hook usage).
 *
 * Reads:
 *   .stira/state.json
 *   .stira/config.json
 *
 * Writes:
 *   .stira/state.json (decayed params + activeBreakers + updated timestamp)
 *
 * Stdout:
 *   JSON summary including elapsedMs, fired breakers, and new params
 *   (suppressed when --quiet).
 *
 * Exit code: 0 on success, 1 on error.
 */

import { resolveStiraPaths, ensureInitialized, refreshState } from "./_shared.js";

interface ParsedArgs {
  force: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let force = true; // explicit `decay` command defaults to force
  let quiet = false;
  for (const a of args) {
    if (a === "--force") force = true;
    else if (a === "--no-force") force = false;
    else if (a === "--quiet") quiet = true;
  }
  return { force, quiet };
}

function main(): void {
  try {
    const { force, quiet } = parseArgs(process.argv);

    const paths = resolveStiraPaths();
    ensureInitialized(paths);

    const { state, lazy, fired } = refreshState(paths, { force });

    if (!quiet) {
      process.stdout.write(
        JSON.stringify(
          {
            ok: true,
            decayed: lazy.decayed,
            reason: lazy.reason,
            elapsedMs: lazy.elapsedMs,
            updated: state.updated,
            params: state.params,
            firedBreakers: fired,
            activeBreakers: state.activeBreakers ?? [],
          },
          null,
          2
        ) + "\n"
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`decay failed: ${msg}\n`);
    process.exit(1);
  }
}

main();
