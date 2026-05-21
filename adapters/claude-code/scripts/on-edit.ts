#!/usr/bin/env node
/**
 * Stira Claude Code / Kiro adapter — on-edit.ts
 *
 * PostToolUse hook target for Write/Edit/MultiEdit. Receives the edited
 * file path via `--path` (Claude Code exposes this as $CLAUDE_TOOL_FILE_PATH)
 * and runs a drift check IFF the path matches one of the watched glob
 * patterns. Otherwise it exits silently — most tool edits are irrelevant
 * to Stira and we don't want every code edit to trigger work.
 *
 * Watched patterns are read from `.stira/config.json` under
 * `watchedPaths` (string[]) — falls back to a sensible default that
 * covers the canonical persona/memory layout:
 *
 *   - **\/SOUL.md
 *   - **\/memory/**
 *   - **\/.stira/**
 *
 * Usage:
 *   node on-edit.js --path <filepath> [--quiet]
 *
 * Exit code: 0 on success or no-op (path not watched). 1 on error.
 */

import { existsSync } from "node:fs";
import { detectDrift } from "@stira/engine";
import type { Matrix, Config, DriftReport } from "@stira/engine";
import {
  resolveStiraPaths,
  refreshState,
} from "./_shared.js";

interface ParsedArgs {
  path?: string;
  quiet: boolean;
}

const DEFAULT_WATCHED: string[] = [
  "**/SOUL.md",
  "**/memory/**",
  "**/.stira/**",
];

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let path: string | undefined;
  let quiet = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--path" && args[i + 1]) {
      path = args[++i];
    } else if (a === "--quiet") {
      quiet = true;
    }
  }
  return { path, quiet };
}

/**
 * Tiny glob matcher supporting `**` (any path segments incl. zero),
 * `*` (any chars within a segment except `/`), and `?` (single char).
 * Sufficient for the path-classification cases this hook needs and avoids
 * pulling in a runtime dependency.
 */
function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    const next = glob[i + 1];
    if (c === "*" && next === "*") {
      // `**` (optionally surrounded by `/`) matches any path including empty
      re += ".*";
      i++; // consume second *
      // swallow trailing `/` so `**/foo` matches `foo` too
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
    } else if (c === "?") {
      re += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegExp(p).test(path));
}

interface ConfigWithWatched extends Config {
  watchedPaths?: string[];
}

function main(): void {
  try {
    const { path, quiet } = parseArgs(process.argv);

    if (!path) {
      // No path supplied — this can happen if the hook misfires or the user
      // ran the script manually. Treat as a no-op to keep hooks resilient.
      if (!quiet) {
        process.stdout.write(
          JSON.stringify({ ok: true, skipped: true, reason: "no-path" }) + "\n"
        );
      }
      return;
    }

    const paths = resolveStiraPaths();
    if (!existsSync(paths.state)) {
      // .stira/ not initialized in this project — silently no-op so the hook
      // doesn't break sessions for projects that don't use Stira.
      if (!quiet) {
        process.stdout.write(
          JSON.stringify({ ok: true, skipped: true, reason: "not-initialized" }) +
            "\n"
        );
      }
      return;
    }

    // Pull config to get watched globs (and to leverage refreshState's
    // lazy-decay floor). We don't need to refresh state for the drift
    // computation itself, but persisting the catch-up is consistent with
    // every other adapter command.
    const { config, matrix } = refreshState(paths);
    const watched =
      (config as ConfigWithWatched).watchedPaths ?? DEFAULT_WATCHED;

    if (!matchesAny(path, watched)) {
      if (!quiet) {
        process.stdout.write(
          JSON.stringify({
            ok: true,
            skipped: true,
            reason: "path-not-watched",
            path,
          }) + "\n"
        );
      }
      return;
    }

    // Path is watched — run drift check.
    const baselineMatrix: Matrix = {
      version: matrix.version,
      triggers: matrix.baseline,
      baseline: matrix.baseline,
    };
    const report: DriftReport = detectDrift(
      matrix,
      baselineMatrix,
      config.drift.threshold
    );

    if (report.drifted) {
      // Always surface drift, even in quiet mode — this is the whole point
      // of running the hook. Goes to stderr so SessionStart-style stdout
      // injection isn't accidentally affected if a runtime reuses this output.
      process.stderr.write(
        `stira: drift detected after edit to ${path} ` +
          `(${report.details.length} param(s), ${report.signFlips.length} sign flip(s))\n`
      );
    }

    if (!quiet) {
      process.stdout.write(
        JSON.stringify(
          {
            ok: true,
            path,
            watched: true,
            drifted: report.drifted,
            details: report.details,
            signFlips: report.signFlips,
          },
          null,
          2
        ) + "\n"
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`on-edit failed: ${msg}\n`);
    // Hooks should rarely block the user — exit 0 on internal errors so
    // Claude Code doesn't refuse the edit. Use stderr to surface the failure.
    process.exit(0);
  }
}

main();
