#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[openclaw-sse-standalone] $*"
}

fail() {
  echo "[openclaw-sse-standalone] ERROR: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
}

require_cmd curl
require_cmd jq
require_cmd grep

OPENCLAW_URL="${OPENCLAW_URL:-}"
OPENCLAW_METHOD="${OPENCLAW_METHOD:-POST}"
OPENCLAW_AUTH_HEADER="${OPENCLAW_AUTH_HEADER:-}"
OPENCLAW_TIMEOUT_SEC="${OPENCLAW_TIMEOUT_SEC:-180}"
OPENCLAW_MODEL="${OPENCLAW_MODEL:-openclaw}"
OPENCLAW_USER="${OPENCLAW_USER:-clawdev-smoke}"

CLAWDEV_RUN_ID="${CLAWDEV_RUN_ID:-smoke-run-$(date +%s)}"
CLAWDEV_AGENT_ID="${CLAWDEV_AGENT_ID:-openclaw-smoke-agent}"
CLAWDEV_COMPANY_ID="${CLAWDEV_COMPANY_ID:-openclaw-smoke-company}"
CLAWDEV_API_URL="${CLAWDEV_API_URL:-http://localhost:3100}"
CLAWDEV_TASK_ID="${CLAWDEV_TASK_ID:-openclaw-smoke-task}"
CLAWDEV_WAKE_REASON="${CLAWDEV_WAKE_REASON:-openclaw_smoke_test}"
CLAWDEV_WAKE_COMMENT_ID="${CLAWDEV_WAKE_COMMENT_ID:-}"
CLAWDEV_APPROVAL_ID="${CLAWDEV_APPROVAL_ID:-}"
CLAWDEV_APPROVAL_STATUS="${CLAWDEV_APPROVAL_STATUS:-}"
CLAWDEV_LINKED_ISSUE_IDS="${CLAWDEV_LINKED_ISSUE_IDS:-}"
OPENCLAW_TEXT_PREFIX="${OPENCLAW_TEXT_PREFIX:-Standalone OpenClaw SSE smoke test.}"

[[ -n "$OPENCLAW_URL" ]] || fail "OPENCLAW_URL is required"

read -r -d '' TEXT_BODY <<EOF || true
${OPENCLAW_TEXT_PREFIX}

CLAWDEV_RUN_ID=${CLAWDEV_RUN_ID}
CLAWDEV_AGENT_ID=${CLAWDEV_AGENT_ID}
CLAWDEV_COMPANY_ID=${CLAWDEV_COMPANY_ID}
CLAWDEV_API_URL=${CLAWDEV_API_URL}
CLAWDEV_TASK_ID=${CLAWDEV_TASK_ID}
CLAWDEV_WAKE_REASON=${CLAWDEV_WAKE_REASON}
CLAWDEV_WAKE_COMMENT_ID=${CLAWDEV_WAKE_COMMENT_ID}
CLAWDEV_APPROVAL_ID=${CLAWDEV_APPROVAL_ID}
CLAWDEV_APPROVAL_STATUS=${CLAWDEV_APPROVAL_STATUS}
CLAWDEV_LINKED_ISSUE_IDS=${CLAWDEV_LINKED_ISSUE_IDS}

Run your ClawDev heartbeat procedure now.
EOF

PAYLOAD="$(jq -nc \
  --arg text "$TEXT_BODY" \
  --arg model "$OPENCLAW_MODEL" \
  --arg user "$OPENCLAW_USER" \
  --arg runId "$CLAWDEV_RUN_ID" \
  --arg agentId "$CLAWDEV_AGENT_ID" \
  --arg companyId "$CLAWDEV_COMPANY_ID" \
  --arg apiUrl "$CLAWDEV_API_URL" \
  --arg taskId "$CLAWDEV_TASK_ID" \
  --arg wakeReason "$CLAWDEV_WAKE_REASON" \
  --arg wakeCommentId "$CLAWDEV_WAKE_COMMENT_ID" \
  --arg approvalId "$CLAWDEV_APPROVAL_ID" \
  --arg approvalStatus "$CLAWDEV_APPROVAL_STATUS" \
  --arg linkedIssueIds "$CLAWDEV_LINKED_ISSUE_IDS" \
  '{
    model: $model,
    user: $user,
    input: $text,
    stream: true,
    metadata: {
      CLAWDEV_RUN_ID: $runId,
      CLAWDEV_AGENT_ID: $agentId,
      CLAWDEV_COMPANY_ID: $companyId,
      CLAWDEV_API_URL: $apiUrl,
      CLAWDEV_TASK_ID: $taskId,
      CLAWDEV_WAKE_REASON: $wakeReason,
      CLAWDEV_WAKE_COMMENT_ID: $wakeCommentId,
      CLAWDEV_APPROVAL_ID: $approvalId,
      CLAWDEV_APPROVAL_STATUS: $approvalStatus,
      CLAWDEV_LINKED_ISSUE_IDS: $linkedIssueIds,
      clawdev_session_key: ("clawdev:run:" + $runId)
    }
  }')"

headers_file="$(mktemp)"
body_file="$(mktemp)"
cleanup() {
  rm -f "$headers_file" "$body_file"
}
trap cleanup EXIT

args=(
  -sS
  -N
  --max-time "$OPENCLAW_TIMEOUT_SEC"
  -X "$OPENCLAW_METHOD"
  -H "content-type: application/json"
  -H "accept: text/event-stream"
  -H "x-openclaw-session-key: clawdev:run:${CLAWDEV_RUN_ID}"
  -D "$headers_file"
  -o "$body_file"
  --data "$PAYLOAD"
  "$OPENCLAW_URL"
)

if [[ -n "$OPENCLAW_AUTH_HEADER" ]]; then
  args=(-H "Authorization: $OPENCLAW_AUTH_HEADER" "${args[@]}")
fi

log "posting SSE wake payload to ${OPENCLAW_URL}"
http_code="$(curl "${args[@]}" -w "%{http_code}")"
log "http status: ${http_code}"

if [[ ! "$http_code" =~ ^2 ]]; then
  tail -n 80 "$body_file" >&2 || true
  fail "non-success HTTP status: ${http_code}"
fi

if ! grep -Eqi '^content-type:.*text/event-stream' "$headers_file"; then
  tail -n 40 "$body_file" >&2 || true
  fail "response content-type was not text/event-stream"
fi

if grep -Eqi 'event:\s*(error|failed|cancel)|"status":"(failed|cancelled|error)"|"type":"[^"]*(failed|cancelled|error)"' "$body_file"; then
  tail -n 120 "$body_file" >&2 || true
  fail "stream reported a failure event"
fi

if ! grep -Eqi 'event:\s*(done|completed|response\.completed)|\[DONE\]|"status":"(completed|succeeded|done)"|"type":"response\.completed"' "$body_file"; then
  tail -n 120 "$body_file" >&2 || true
  fail "stream ended without a terminal completion marker"
fi

event_count="$(grep -Ec '^event:' "$body_file" || true)"
log "stream completed successfully (events=${event_count})"
echo
tail -n 40 "$body_file"
