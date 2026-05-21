#!/usr/bin/env node
/**
 * Stira Claude Code / Kiro adapter — apply-event.ts
 *
 * Apply a categorized event to the persisted state.
 *
 * Usage:
 *   node apply-event.js --category <cat> --intensity <0..1> [--rationale <text>]
 *
 * Reads:
 *   .stira/state.json
 *   .stira/matrix.json
 *   .stira/config.json
 *
 * Writes:
 *   .stira/state.json   (new params + activeBreakers + updated timestamp)
 *   .stira/events.jsonl (one JSON line appended for audit trail)
 *
 * Stdout:
 *   JSON summary including new params and any fired breakers.
 *
 * Behaviour:
 *   Before applying the event we run a lazy-decay catch-up so the event is
 *   applied on top of a state that already reflects the time elapsed since
 *   the last write. This keeps the CC/Kiro flow honest even when no other
 *   automatic tick has happened yet.
 *
 * Exit code: 0 on success, 1 on error.
 */

import { appendFileSync } from "node:fs";
import { applyEvent, getFiredBreakers } from "@stira/engine";
import type { Event, BreakerResult, State } from "@stira/engine";
import {
  resolveStiraPaths,
  ensureInitialized,
  refreshState,
  writeJson,
} from "./_shared.js";

interface ParsedArgs {
  category: string;
  intensity: number;
  rationale?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let category: string | undefined;
  let intensityRaw: string | undefined;
  let rationale: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--category" && args[i + 1]) {
      category = args[++i];
    } else if (a === "--intensity" && args[i + 1]) {
      intensityRaw = args[++i];
    } else if (a === "--rationale" && args[i + 1]) {
      rationale = args[++i];
    }
  }

  if (!category || intensityRaw === undefined) {
    process.stderr.write(
      "Usage: node apply-event.js --category <cat> --intensity <0..1> [--rationale <text>]\n"
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

  return { category: category as string, intensity, rationale };
}

function generateEventId(): string {
  // Lightweight unique id: timestamp + random suffix. Avoids any external deps.
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `evt-${t}-${r}`;
}

function main(): void {
  try {
    const { category, intensity, rationale } = parseArgs(process.argv);

    const paths = resolveStiraPaths();
    ensureInitialized(paths);

    // Lazy-decay floor: ensure we apply the event on a fresh state. The
    // shared helper persists the decayed state if it actually changed,
    // which keeps `events.jsonl` paramsAfter aligned with state.json.
    const { state: refreshed, config, matrix, lazy } = refreshState(paths);

    const nowIso = new Date().toISOString();
    const event: Event = {
      id: generateEventId(),
      timestamp: nowIso,
      category,
      intensity,
      rationale,
      source: "system",
    };

    const next = applyEvent(refreshed, event, matrix);
    const fired: BreakerResult[] = getFiredBreakers(next, config.breakers);
    const finalState: State = {
      ...next,
      activeBreakers: fired.map((f) => f.ruleId),
    };

    writeJson(paths.state, finalState);

    // Append audit-trail entry. Failure to append is fatal: the audit trail
    // is part of the contract advertised by SKILL.md.
    const auditLine =
      JSON.stringify({
        event,
        paramsAfter: finalState.params,
        firedBreakers: fired.map((f) => f.ruleId),
        lazyDecay: {
          decayed: lazy.decayed,
          elapsedMs: lazy.elapsedMs,
          reason: lazy.reason,
        },
      }) + "\n";
    appendFileSync(paths.events, auditLine, "utf-8");

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          event: { id: event.id, category, intensity, rationale, timestamp: nowIso },
          params: finalState.params,
          firedBreakers: fired,
          lazyDecay: {
            decayed: lazy.decayed,
            elapsedMs: lazy.elapsedMs,
            reason: lazy.reason,
          },
        },
        null,
        2
      ) + "\n"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`apply-event failed: ${msg}\n`);
    process.exit(1);
  }
}

main();
