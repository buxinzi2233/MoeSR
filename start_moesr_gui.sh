#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_root"

export MOESR_HOST="${MOESR_HOST:-127.0.0.1}"
export MOESR_PORT="${MOESR_PORT:-10721}"
export WINEDEBUG="${WINEDEBUG:--all}"

backend_pid=""
cleanup() {
    if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
        kill "$backend_pid" 2>/dev/null || true
        wait "$backend_pid" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

if ! curl -fsS "http://127.0.0.1:${MOESR_PORT}/" >/dev/null 2>&1; then
    MOESR_EEL_MODE=none "$project_root/.venv/bin/python" "$project_root/moe_sr.py" \
        >"$project_root/moesr-server.log" 2>&1 &
    backend_pid=$!

    ready=0
    for _ in $(seq 1 30); do
        if curl -fsS "http://127.0.0.1:${MOESR_PORT}/" >/dev/null 2>&1; then
            ready=1
            break
        fi
        if ! kill -0 "$backend_pid" 2>/dev/null; then
            cat "$project_root/moesr-server.log"
            exit 1
        fi
        sleep 1
    done
    if [[ "$ready" -ne 1 ]]; then
        echo "MoeSR backend did not become ready on port ${MOESR_PORT}." >&2
        exit 1
    fi
fi

set +e
if [[ -x "$project_root/electron-linux/electron" ]]; then
    # The bundled Windows build renders a blank surface under Wine on Wayland.
    # Prefer the native runtime so the same Electron UI uses the host compositor.
    "$project_root/electron-linux/electron" \
        --no-sandbox \
        "$project_root/electron_app/main.js"
    status=$?
elif [[ -x "$project_root/electron/electron.exe" ]] && command -v wine >/dev/null 2>&1; then
    echo "Native Linux Electron runtime is missing; falling back to Wine." >&2
    wine "$project_root/electron/electron.exe" "$project_root/electron_app/main.js"
    status=$?
else
    echo "MoeSR GUI runtime is missing (expected electron-linux/electron or Wine)." >&2
    status=1
fi
set -e
exit "$status"
