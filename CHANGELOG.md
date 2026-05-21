# Changelog

All notable changes to Stira are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-21

Initial public release. Pre-alpha.

### Added
- **Engine** (`@stira/engine`, pure functions, no I/O, no LLM):
  - `applyEvent(state, event, matrix)` — `state += matrix[category] * intensity`, clamped to [0, 1]
  - `decay(state, elapsedMs, decayConfig)` — time-based drift toward per-param floors
  - `checkBreakers(state, rules)` — predicate evaluation against threshold rules
  - `getFiredBreakers(state, rules)` — convenience wrapper returning fired rules
  - `resolveBreakers(...)` — auto/manual recovery with hysteresis (ADR-002)
  - `detectDrift(...)` — phase-distortion detection against immutable matrix baseline
- **CLI** (`@stira/cli`):
  - `stira simulate --persona <file> --stimuli <file.jsonl> [--output <file>]` — runs a persona through a stimulus stream and emits JSONL records (`init`, `decay`, `event`)
- **OpenClaw Adapter** (`adapters/openclaw/`):
  - `init`, `decay-cron`, `apply-event`, `status` scripts demonstrating single-writer state per ADR-003
- **Personas** (`personas/`, 7 total):
  - 3 baseline: `cautious-archivist`, `restless-scout`, `steady-guardian`
  - 4 pathological (test fixtures): `volatile-artist`, `paranoid-sentinel`, `apathetic-observer`, `bipolar-oscillator`
- **Stimuli** (`stimuli/`, 3 scenarios):
  - `normal-day.jsonl`, `stress-test.jsonl`, `rapid-fire.jsonl`
- **Safety**:
  - Breaker recovery (auto/manual + hysteresis) — ADR-002
  - Only `stability` and `vigilance` may fire breakers (operator-protected core) — ADR-005
- **Research**:
  - Latent-compression evaluation; rejected for the engine layer (kept in `docs/research/` as a tabled idea)
- **ADRs** (Architecture Decision Records):
  - ADR-001: Why pure functions
  - ADR-002: Breaker recovery (hysteresis + manual reset)
  - ADR-003: Single-writer state
  - ADR-004: Schema versioning
  - ADR-005: Breaker / adapter contract
  - ADR-006: Canonical stimulus categories
- **CI**: GitHub Actions matrix on Node 20 / 22 (`engine` build + test, `cli` build)
- **Tooling**:
  - Root npm workspaces (`engine`, `cli`)
  - `scripts/run-all-simulations.sh` — exhaustive persona × stimuli sweep

### Design Decisions

- **Engine is pure functions.** No LLM calls, no I/O, no time source other than the `elapsedMs` argument. Test in isolation.
- **Only `stability` and `vigilance` can trigger breakers.** Custom params (e.g., `protectiveness`, `suspicion`) cannot. Operators control the safety surface; persona authors cannot widen it.
- **Matrix baseline is immutable.** Drift detection compares against the persona's original matrix; mutating the matrix at runtime defeats the anchor.
- **Adapters absorb harness differences.** OpenClaw, Claude Code, custom — all sit outside the engine boundary.

### Known Limitations

- No tests are run as part of this release's local development loop (environment not yet set up); CI is the source of truth for test status going forward.
- No multi-agent coordination, no automated matrix learning, no opinion on "the right" agent design.

[Unreleased]: https://github.com/Resolver-TNG/stira/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Resolver-TNG/stira/releases/tag/v0.1.0
