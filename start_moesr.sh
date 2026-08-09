#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_root"

export MOESR_HOST="${MOESR_HOST:-127.0.0.1}"
export MOESR_PORT="${MOESR_PORT:-10721}"
export MOESR_EEL_MODE="${MOESR_EEL_MODE:-default}"

exec "$project_root/.venv/bin/python" "$project_root/moe_sr.py" "$@"
