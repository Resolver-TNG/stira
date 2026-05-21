# Contributing to Stira

Thanks for considering a contribution. This document explains how Stira is developed, what we expect from PRs, and the smaller workflows (adding a persona, adding an ADR).

## Development Model — Resident AI + Transient AI

Stira is built on a two-role split that we ask contributors to respect:

- **Resident AI / human maintainer** — owns design, architecture, and `spec/`. Decides _what_ should exist and _why_. Writes ADRs. Reviews PRs.
- **Transient AI** (e.g. ACP-delegated coding agents, ephemeral subagents, contributors) — owns implementation. Writes code _against_ the spec. Does not invent new design surface mid-PR.

The practical consequence: **`spec/` and existing engine semantics are not changed inside an implementation PR.** If a change requires a spec edit, that is its own PR with an ADR attached. This separation is what lets us hand work off to coding agents without losing coherence between sessions.

## PR Requirements

Every PR must satisfy:

1. **Tests pass.** `cd engine && npm ci && npm run build && npm test` succeeds locally and in CI.
2. **CLI builds.** `cd cli && npm ci && npm run build` succeeds.
3. **Spec is unchanged** unless the PR is explicitly a spec PR with a new ADR.
4. **Engine purity is preserved.** `engine/src/` stays free of I/O, time sources other than `elapsedMs` arguments, and LLM calls. Anything else belongs in an adapter.
5. **The "only stability/vigilance fire breakers" invariant holds** (ADR-005). Custom params can be tracked, but they cannot be wired into the breaker contract.
6. **Conventional-ish commits.** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` prefixes are appreciated.

Smaller niceties:

- One logical change per PR. If you find yourself writing "and also" in the PR description, split.
- Update `CHANGELOG.md` under `## [Unreleased]` for user-visible changes.
- Don't commit `node_modules/`, `dist/`, or `results/`.

## Local Development

```bash
# From the repo root
npm install                      # installs both workspaces
npm run build                    # builds engine + cli
npm test                         # runs engine tests via vitest

# Simulate a persona
node cli/dist/index.js simulate \
  --persona personas/restless-scout.json \
  --stimuli stimuli/stress-test.jsonl

# Sweep every persona × stimulus
npm run simulate:all
```

CI runs on Node 20 and 22. Stick to APIs available on Node 20.

## Adding a Persona

Personas live in `personas/<name>.json`. They are JSON, not code, and must be self-contained.

### Template

```json
{
  "name": "Your Persona Name",
  "description": "One or two sentences about what this persona is and what it is for.",
  "params": {
    "stability": 0.7,
    "vigilance": 0.3,
    "trust": 0.5,
    "curiosity": 0.6,
    "satisfaction": 0.5,
    "<your_custom_param>": 0.5
  },
  "matrix": {
    "joy":         { "trust": 0.0, "curiosity": 0.0, "vigilance": 0.0, "satisfaction": 0.0, "stability": 0.0, "<your_custom_param>": 0.0 },
    "threat":      { "trust": 0.0, "curiosity": 0.0, "vigilance": 0.0, "satisfaction": 0.0, "stability": 0.0, "<your_custom_param>": 0.0 },
    "achievement": { "trust": 0.0, "curiosity": 0.0, "vigilance": 0.0, "satisfaction": 0.0, "stability": 0.0, "<your_custom_param>": 0.0 },
    "loss":        { "trust": 0.0, "curiosity": 0.0, "vigilance": 0.0, "satisfaction": 0.0, "stability": 0.0, "<your_custom_param>": 0.0 },
    "uncertainty": { "trust": 0.0, "curiosity": 0.0, "vigilance": 0.0, "satisfaction": 0.0, "stability": 0.0, "<your_custom_param>": 0.0 },
    "connection":  { "trust": 0.0, "curiosity": 0.0, "vigilance": 0.0, "satisfaction": 0.0, "stability": 0.0, "<your_custom_param>": 0.0 }
  },
  "decay": {
    "rules": [
      { "param": "curiosity", "ratePerHour": 0.05, "floor": 0.2 }
    ]
  },
  "breakers": [
    { "id": "stability-warn", "param": "stability", "threshold": 0.5, "direction": "below", "action": "warn", "message": "..." }
  ],
  "notes": "What this persona is testing or demonstrating. Required for personas in the test fixtures set."
}
```

### Rules

- All six canonical categories (`joy`, `threat`, `achievement`, `loss`, `uncertainty`, `connection`) must be present in `matrix` per ADR-006. You may add more categories, but the canonical six are required.
- Every key under `matrix.<category>` must also be a key in `params` (no orphan parameters).
- All `params` values must be in `[0, 1]`. Matrix deltas should be in `[-1, 1]` — large values may be possible numerically but defeat the bounded-state assumption.
- **Breakers may only target `stability` or `vigilance`.** This is enforced by the engine and is intentional (ADR-005).
- **Originality / IP.** Personas in this repository must be original creations. Do not name a persona after, or directly reproduce parameters intended to imitate, a copyrighted character.
- For test fixtures, write a `notes` field that explains _what the persona is supposed to expose_ (a breaker mode, a decay edge case, a drift pattern).

Run your new persona through every stimulus before opening the PR:

```bash
npm run simulate:all
```

## Adding an ADR

Architecture Decision Records live under `adr/NNN-short-name.md`. To propose a new one:

1. Pick the next number.
2. Copy an existing ADR as a starting structure (Status / Date / Context / Decision / Consequences).
3. Open a PR titled `adr: NNN <short-name>`.
4. Discuss in the PR. Status starts as `Proposed`. A maintainer flips it to `Accepted` (or `Rejected`) on merge.

Spec changes (`spec/*`) require an accepted ADR. Implementation PRs that incidentally need a spec change should be split.

## Reporting Bugs / Asking Questions

Open a GitHub issue. For security-relevant issues, do not file a public issue — see `SECURITY.md` once it exists, otherwise reach the maintainer privately.

## License

By contributing, you agree your contributions are licensed under Apache-2.0 (the project license).
