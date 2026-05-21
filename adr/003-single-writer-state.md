# ADR-003: Single-Writer File-Based State

**Status:** Accepted
**Date:** 2026-05-21

## Context

State is persisted as JSON files. Multiple processes may want to update state:
- Main agent (applyEvent after conversation)
- Cron job (decay every 5 min)
- Operator (manual reset)

## Decision

**Single-writer model**: Only one process writes state.json at a time. No concurrent writes.

For the reference implementations:
- **OpenClaw**: Cron runs in isolated session = separate process, but state writes are serialized by file system (last-write-wins acceptable for decay; events are append-only to events.jsonl)
- **Claude Code**: Hook runs synchronously after stop = no concurrency issue

## Constraints

- `state.json` writes: last-write-wins (acceptable because decay is monotonic and events are rare)
- `events.jsonl`: append-only, no locking needed
- If future multi-agent support is needed, move to SQLite or similar

## Consequences

- No file locking mechanism in MVP
- Adapters MUST NOT run applyEvent and decay simultaneously on the same state file
- Document this as a constraint in spec
