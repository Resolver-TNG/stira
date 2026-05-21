#!/usr/bin/env node
/**
 * Stira Claude Code / Kiro adapter — tick.ts
 *
 * Lightweight "heartbeat" command. Refreshes state via lazy-decay and emits
 * a compact JSON summary intended for two consumers:
 *
 *   1. Claude Code SessionStart hook (stdout → injected into Claude's context).
 *      Run without flags to get a state summary printed to stdout.
 *
 *   2. Stop hook (`tick --quiet`) to persist a final decay catch-up without
 *      polluting the transcript.
 *
 * Differences from `status.js`:
 *   - `tick` always force-decays (the SessionStart hook fires at most once
 *     per session, so we want the freshest possible numbers).
 *   - Output is a SUMMARY (params + active breakers + reason), not the full
 *     State document. This keeps the context-injected payload small.
 *   - `--reason <text>` is appended to events.jsonl as an audit note for
 *     traceability of automatic ticks.
 *
 * Usage:
 *   node tick.js [--quiet] [--reason <text>]
 *
 * Exit code: 0 on success, 1 on error.
 */

import { appendFileSync } from "node:fs";
import {
  resolveStiraPaths,
  ensureInitialized,
  refreshState,
} from "./_shared.js";

interface ParsedArgs {
  quiet: boolean;
  reason?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let quiet = false;
  let reason: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--quiet") quiet = true;
    else if (a === "--reason" && args[i + 1]) reason = args[++i];
  }
  return { quiet, reason };
}

function main(): void {
  try {
    const { quiet, reason } = parseArgs(process.argv);

    const paths = resolveStiraPaths();
    ensureInitialized(paths);

    // tick always forces — we want a fresh snapshot at session start even
    // if "less than 5 minutes" has passed since the last write.
    const { state, lazy, fired } = refreshState(paths, { force: true });

    if (lazy.decayed && reason) {
      // Best-effort audit. Failure here is non-fatal: the hook should never
      // fail Claude's session start over a missed audit line.
      try {
        const line =
          JSON.stringify({
            kind: "tick",
            timestamp: new Date().toISOString(),
            reason,
            elapsedMs: lazy.elapsedMs,
            paramsAfter: state.params,
            activeBreakers: state.activeBreakers ?? [],
          }) + "\n";
        appendFileSync(paths.events, line, "utf-8");
      } catch {
        // ignore
      }
    }

    if (!quiet) {
      // Compact summary suitable for SessionStart context injection.
      process.stdout.write(
        JSON.stringify(
          {
            ok: true,
            kind: "stira-tick",
            updated: state.updated,
            params: state.params,
            activeBreakers: state.activeBreakers ?? [],
            firedBreakers: fired.map((f) => ({
              ruleId: f.ruleId,
              param: f.param,
              currentValue: f.currentValue,
              threshold: f.threshold,
              action: f.action,
              message: f.message,
            })),
            decay: {
              decayed: lazy.decayed,
              elapsedMs: lazy.elapsedMs,
              reason: lazy.reason,
            },
          },
          null,
          2
        ) + "\n"
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`tick failed: ${msg}\n`);
    process.exit(1);
  }
}

main();
