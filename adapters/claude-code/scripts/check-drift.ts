#!/usr/bin/env node
/**
 * Stira Claude Code / Kiro adapter — check-drift.ts
 *
 * Compare the current matrix triggers against the frozen baseline and emit
 * a DriftReport. The threshold is read from .stira/config.json.
 *
 * Before running the comparison we apply lazy-decay so any breaker output
 * embedded in the report reflects current parameter values rather than
 * a stale snapshot.
 *
 * Usage:
 *   node check-drift.js [--threshold <n>] [--quiet]
 *
 * Reads:
 *   .stira/state.json
 *   .stira/matrix.json    (contains both `triggers` and `baseline`)
 *   .stira/config.json    (drift.threshold)
 *
 * Stdout:
 *   JSON DriftReport. `drifted: true` indicates at least one parameter
 *   exceeded the threshold or one trigger flipped sign vs baseline.
 *
 * Exit code:
 *   0 on success regardless of drifted/clean (the report itself is the answer).
 *   1 on read or parse error.
 */

import { detectDrift } from "@stira/engine";
import type { Matrix, DriftReport } from "@stira/engine";
import { resolveStiraPaths, ensureInitialized, refreshState } from "./_shared.js";

interface ParsedArgs {
  thresholdOverride?: number;
  quiet: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let thresholdOverride: number | undefined;
  let quiet = false;
  for (let i = 0; i < args.length; i++) {
    const cur = args[i];
    if (cur === "--threshold" && args[i + 1]) {
      const raw = args[++i];
      const v = Number.parseFloat(raw);
      if (!Number.isFinite(v) || v < 0) {
        process.stderr.write(
          `Error: --threshold must be a non-negative number, got ${raw}\n`
        );
        process.exit(1);
      }
      thresholdOverride = v;
    } else if (cur === "--quiet") {
      quiet = true;
    }
  }
  return { thresholdOverride, quiet };
}

function main(): void {
  try {
    const { thresholdOverride, quiet } = parseArgs(process.argv);

    const paths = resolveStiraPaths();
    ensureInitialized(paths);

    // Lazy-decay floor before evaluating drift. We don't need the refreshed
    // state for the comparison itself, but persisting the catch-up keeps
    // the rest of the system honest.
    const { matrix, config } = refreshState(paths);

    const baselineMatrix: Matrix = {
      version: matrix.version,
      triggers: matrix.baseline,
      baseline: matrix.baseline,
    };

    const threshold = thresholdOverride ?? config.drift.threshold;
    const report: DriftReport = detectDrift(matrix, baselineMatrix, threshold);

    if (!quiet) {
      process.stdout.write(
        JSON.stringify(
          {
            ok: true,
            threshold,
            drifted: report.drifted,
            timestamp: report.timestamp,
            details: report.details,
            signFlips: report.signFlips,
          },
          null,
          2
        ) + "\n"
      );
    } else if (report.drifted) {
      // Even in quiet mode we want a one-liner to stderr when drift fires,
      // so Stop hooks surface the warning without polluting Claude's context
      // on success.
      process.stderr.write(
        `stira: drift detected (${report.details.length} param(s), ${report.signFlips.length} sign flip(s))\n`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`check-drift failed: ${msg}\n`);
    process.exit(1);
  }
}

main();
