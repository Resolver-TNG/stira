#!/usr/bin/env bash
# run-all-simulations.sh
#
# Run every persona × stimuli combination through the Stira CLI and write
# results under ./results/<persona>__<stimuli>.jsonl.
#
# Exit codes:
#   0 — every combination ran to completion (CLI exit 0)
#   1 — at least one combination failed (CLI non-zero exit)
#
# Summary printed to stdout: breaker firing counts and final params per run.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PERSONA_DIR="personas"
STIMULI_DIR="stimuli"
RESULTS_DIR="results"
CLI_ENTRY="cli/dist/index.js"

if [[ ! -f "$CLI_ENTRY" ]]; then
  echo "ERROR: $CLI_ENTRY not found. Build first: (cd cli && npm run build)" >&2
  exit 2
fi

mkdir -p "$RESULTS_DIR"

shopt -s nullglob
PERSONAS=( "$PERSONA_DIR"/*.json )
STIMULI=( "$STIMULI_DIR"/*.jsonl )
shopt -u nullglob

if (( ${#PERSONAS[@]} == 0 )); then
  echo "ERROR: no personas under $PERSONA_DIR" >&2
  exit 2
fi
if (( ${#STIMULI[@]} == 0 )); then
  echo "ERROR: no stimuli under $STIMULI_DIR" >&2
  exit 2
fi

total=0
failed=0
declare -a SUMMARY_LINES

for persona in "${PERSONAS[@]}"; do
  pname="$(basename "$persona" .json)"
  for stim in "${STIMULI[@]}"; do
    sname="$(basename "$stim" .jsonl)"
    out="$RESULTS_DIR/${pname}__${sname}.jsonl"
    total=$((total + 1))

    echo "[run] persona=$pname stimuli=$sname -> $out"

    if ! node "$CLI_ENTRY" simulate \
        --persona "$persona" \
        --stimuli "$stim" \
        --output "$out" >/dev/null; then
      failed=$((failed + 1))
      SUMMARY_LINES+=("FAIL  $pname × $sname")
      continue
    fi

    # Count breaker firings: any event line with a non-empty breakers array.
    breaker_count=$(grep -c '"breakers":\[{' "$out" 2>/dev/null || true)
    breaker_count=${breaker_count:-0}

    # Pull the last event line's params for the final state summary.
    final_params=$(grep '"type":"event"' "$out" | tail -n 1 \
      | sed -E 's/.*"params":(\{[^}]*\}).*/\1/' \
      || echo '{}')

    SUMMARY_LINES+=("OK    $pname × $sname  breakers=$breaker_count  final=$final_params")
  done
done

echo
echo "========== Stira simulation summary =========="
printf '%s\n' "${SUMMARY_LINES[@]}"
echo "----------------------------------------------"
echo "total=$total  failed=$failed"
echo "=============================================="

if (( failed > 0 )); then
  exit 1
fi
exit 0
