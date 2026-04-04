#!/bin/bash
set -euo pipefail

: "${BASELINE_REPO_PATH:?set BASELINE_REPO_PATH to the baseline repo path}"
BASELINE_DEV_CMD="${BASELINE_DEV_CMD:-pnpm dev}"

cd "$BASELINE_REPO_PATH"
PORT=3200 sh -lc "$BASELINE_DEV_CMD"
