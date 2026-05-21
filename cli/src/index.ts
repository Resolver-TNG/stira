#!/usr/bin/env node
/**
 * Stira CLI — simulate persona state transitions
 *
 * Usage:
 *   stira simulate --persona <path> --stimuli <path> [--output <path>]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyEvent, decay, getFiredBreakers } from "@stira/engine";
import type { State, Matrix, Event, BreakerResult, BreakerRule, DecayConfig } from "@stira/engine";

// ─── Persona JSON shape ────────────────────────────────────────────────────

interface PersonaJSON {
  name: string;
  description?: string;
  params: Record<string, number>;
  matrix: Record<string, Record<string, number>>;
  decay?: { rules: Array<{ param: string; ratePerHour: number; floor: number }> };
  breakers?: BreakerRule[];
}

// ─── Stimulus JSONL line ───────────────────────────────────────────────────

interface StimulusLine {
  id: string;
  timestamp: string;
  category: string;
  intensity: number;
  rationale?: string;
}

// ─── Output JSONL line types ───────────────────────────────────────────────

interface InitLine {
  step: 0;
  type: "init";
  timestamp: string;
  params: Record<string, number>;
}

interface DecayLine {
  step: number;
  type: "decay";
  timestamp: string;
  elapsedMs: number;
  params: Record<string, number>;
}

interface EventLine {
  step: number;
  type: "event";
  eventId: string;
  category: string;
  intensity: number;
  params: Record<string, number>;
  breakers: BreakerResult[];
}

type OutputLine = InitLine | DecayLine | EventLine;

// ─── Argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv: string[]): { persona: string; stimuli: string; output?: string } {
  const args = argv.slice(2); // skip node + script

  // Expect: simulate --persona <p> --stimuli <s> [--output <o>]
  if (args[0] !== "simulate") {
    process.stderr.write("Usage: stira simulate --persona <path> --stimuli <path> [--output <path>]\n");
    process.exit(1);
  }

  let persona: string | undefined;
  let stimuli: string | undefined;
  let output: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--persona" && args[i + 1]) {
      persona = args[++i];
    } else if (args[i] === "--stimuli" && args[i + 1]) {
      stimuli = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[++i];
    }
  }

  if (!persona || !stimuli) {
    process.stderr.write("Error: --persona and --stimuli are required\n");
    process.exit(1);
  }

  return { persona: persona as string, stimuli: stimuli as string, output };
}

// ─── Load persona ──────────────────────────────────────────────────────────

function loadPersona(path: string): { state: State; matrix: Matrix; decay: DecayConfig; breakers: BreakerRule[] } {
  const raw = readFileSync(resolve(path), "utf-8");
  const p: PersonaJSON = JSON.parse(raw) as PersonaJSON;

  const state: State = {
    version: 1,
    params: { ...p.params },
    updated: new Date().toISOString(),
  };

  // Build matrix: triggers = matrix, baseline = same (initial)
  const matrix: Matrix = {
    version: 1,
    triggers: p.matrix,
    baseline: p.matrix,
  };

  const decayConfig: DecayConfig = p.decay ?? { rules: [] };
  const breakerRules: BreakerRule[] = p.breakers ?? [];

  return { state, matrix, decay: decayConfig, breakers: breakerRules };
}

// ─── Load stimuli JSONL ────────────────────────────────────────────────────

function loadStimuli(path: string): StimulusLine[] {
  const raw = readFileSync(resolve(path), "utf-8");
  return raw
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean)
    .map((l: string) => JSON.parse(l) as StimulusLine);
}

// ─── Main simulation ───────────────────────────────────────────────────────

function simulate(personaPath: string, stimuliPath: string, outputPath?: string): void {
  const { state: initialState, matrix, decay: decayConfig, breakers } = loadPersona(personaPath);

  const stimuli = loadStimuli(stimuliPath);

  const lines: OutputLine[] = [];
  let currentState = initialState;
  let lastTimestamp: number | null = null;

  // Step 0: init
  lines.push({
    step: 0,
    type: "init",
    timestamp: currentState.updated,
    params: { ...currentState.params },
  });

  for (let i = 0; i < stimuli.length; i++) {
    const stim = stimuli[i];
    const stepNum = i + 1;
    const stimTs = new Date(stim.timestamp).getTime();

    // Decay between timestamps
    if (lastTimestamp !== null && stimTs > lastTimestamp) {
      const elapsedMs = stimTs - lastTimestamp;
      const decayedState = decay(currentState, elapsedMs, decayConfig, stim.timestamp);
      lines.push({
        step: stepNum,
        type: "decay",
        timestamp: stim.timestamp,
        elapsedMs,
        params: { ...decayedState.params },
      });
      currentState = decayedState;
    }

    // Build Event
    const event: Event = {
      id: stim.id,
      timestamp: stim.timestamp,
      category: stim.category,
      intensity: stim.intensity,
      rationale: stim.rationale,
    };

    // Apply event
    const nextState = applyEvent(currentState, event, matrix);

    // Check breakers
    const fired = getFiredBreakers(nextState, breakers);

    lines.push({
      step: stepNum,
      type: "event",
      eventId: stim.id,
      category: stim.category,
      intensity: stim.intensity,
      params: { ...nextState.params },
      breakers: fired,
    });

    currentState = nextState;
    lastTimestamp = stimTs;
  }

  // Serialize
  const jsonl = lines.map((l) => JSON.stringify(l)).join("\n");

  if (outputPath) {
    writeFileSync(resolve(outputPath), jsonl + "\n", "utf-8");
    console.error(`Wrote ${lines.length} lines to ${outputPath}`);
  } else {
    console.log(jsonl);
  }
}

// ─── Entry point ───────────────────────────────────────────────────────────

const { persona, stimuli, output } = parseArgs(process.argv);
simulate(persona, stimuli, output);
