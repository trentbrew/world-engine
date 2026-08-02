# Dev orchestration — `just` or `just run` starts the full local stack:
#   Vite (:9292) + Trellis DB (:8230) + realtime relay (:8231)
# Ctrl-C stops all services.

default: run

# Coordination health check across the multi-agent Trellis state.
# `just triage` reports; `just triage --fix` also drops stale zero-op lanes.
# Leading `-`: don't treat "recommendations pending" (exit 1) as a recipe failure;
# hooks/CI that want to gate call `node scripts/triage.mjs` directly.
triage *args:
    -node scripts/triage.mjs {{args}}

vite_port := '9292'
trellis_port := '8230'
relay_port := '8231'

# Vite + SvelteKit — proxies /trellis-db → Trellis DB (see vite.config.ts)
vite port=vite_port trellis_port=trellis_port:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}"
    export TRELLIS_DB_URL="http://localhost:{{trellis_port}}"
    pnpm exec vite dev --port {{port}}

# Trellis realtime relay — cross-client MP via ?net=relay
relay port=relay_port:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}"
    RELAY_PORT={{port}} pnpm dev:relay

# Trellis durable DB — persisted edits via ?durable=trellis
trellis port=trellis_port:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}"
    # Auto-init the local manifest if absent (gitignored, per-clone setup).
    [ -f .trellis-db.json ] || pnpm exec trellis db init
    pnpm exec trellis db serve --port {{port}}

# All dev services concurrently; Ctrl-C stops all
run vite_port=vite_port trellis_port=trellis_port relay_port=relay_port:
    #!/usr/bin/env bash
    set -uo pipefail
    cd "{{justfile_directory()}}"

    # pnpm enforces package.json engines (>=20 <24); Playwright e2e also needs Node 22.
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck disable=SC1090
        . "$NVM_DIR/nvm.sh"
        nvm use 2>/dev/null || true
    fi

    export TRELLIS_DB_URL="http://localhost:{{trellis_port}}"
    export RELAY_PORT="{{relay_port}}"

    PIDS=()

    cleanup() {
        echo ""
        echo "Stopping dev stack..."
        for pid in "${PIDS[@]}"; do
            kill "$pid" 2>/dev/null || true
        done
        wait 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM

    prefix() {
        local tag="$1"
        while IFS= read -r line || [[ -n "$line" ]]; do
            printf '[%s] %s\n' "$tag" "$line"
        done
    }

    port_open() {
        nc -z 127.0.0.1 "$1" 2>/dev/null || nc -z ::1 "$1" 2>/dev/null
    }

    wait_port() {
        local port="$1"
        local label="$2"
        local tries=0
        while (( tries < 120 )); do
            if port_open "$port"; then
                echo "[just] ${label} ready on :${port}"
                return 0
            fi
            tries=$((tries + 1))
            sleep 0.25
        done
        echo "[just] ERROR: ${label} did not start on :${port}" >&2
        return 1
    }

    echo "Starting dev stack..."
    echo "  app       http://localhost:{{vite_port}}"
    echo "  durable   http://localhost:{{trellis_port}}  (?durable=trellis)"
    echo "  relay     ws://localhost:{{relay_port}}/rt   (?net=relay)"
    echo ""

    if port_open {{vite_port}}; then
        echo "[just] vite already on :{{vite_port}} — reusing"
    else
        pnpm exec vite dev --port {{vite_port}} 2>&1 | prefix vite &
        PIDS+=($!)
    fi

    if port_open {{relay_port}}; then
        echo "[just] relay already on :{{relay_port}} — reusing"
    else
        pnpm dev:relay 2>&1 | prefix relay &
        PIDS+=($!)
    fi

    if port_open {{trellis_port}}; then
        echo "[just] trellis already on :{{trellis_port}} — reusing"
    else
        # Auto-init the local manifest if absent (gitignored, per-clone setup).
        [ -f .trellis-db.json ] || pnpm exec trellis db init 2>&1 | prefix trellis
        pnpm exec trellis db serve --port {{trellis_port}} 2>&1 | prefix trellis &
        PIDS+=($!)
    fi

    wait_port {{trellis_port}} trellis || exit 1
    wait_port {{relay_port}} relay || exit 1
    wait_port {{vite_port}} vite || exit 1

    echo ""
    echo "Dev stack ready:"
    echo "  http://localhost:{{vite_port}}/?game=orbit"
    echo "  http://localhost:{{vite_port}}/?game=orbit&durable=trellis"
    echo "  http://localhost:{{vite_port}}/?game=orbit&net=relay"
    echo ""

    wait

# E2E — requires dev stack on :9292 (fail-fast via scripts/test-e2e.mjs)
e2e *args:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}"
    # Playwright 1.52 hangs on Node 24+; prefer .nvmrc (22).
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck disable=SC1090
        . "$NVM_DIR/nvm.sh"
        nvm use 2>/dev/null || true
    fi
    pnpm test:e2e {{args}}
