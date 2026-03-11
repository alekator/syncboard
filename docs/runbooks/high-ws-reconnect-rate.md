# Runbook: High WS Reconnect Rate

## Trigger

- Alert: `SyncboardHighWsReconnectRate`
- Condition: `rate(syncboard_ws_reconnect_total[5m]) > 0.2` for 10 minutes.

## Immediate Checks

1. Check current active connections trend:
   - `syncboard_ws_active_connections`
2. Validate API/WS pod or container restart frequency.
3. Confirm no network/proxy timeouts changed recently.

## Diagnosis

1. Inspect WS close codes and reconnect bursts in server logs.
2. Validate `board.join` replay path with `fromSequence` for impacted boards.
3. Check if reconnects correlate with deploy windows or infrastructure churn.
4. Validate client-side exponential backoff behavior.

## Mitigation

1. Stabilize API instance restarts and dependency health first.
2. Tune proxy idle timeout / keepalive for WebSocket traffic.
3. If replay path regressed, ship rollback/hotfix and trigger client full resync fallback.

## Exit Criteria

- `rate(syncboard_ws_reconnect_total[5m])` returns to baseline.
- Reconnect recovery remains within SLO target (`p95 < 3s`).
- No sustained connection churn in active user sessions.
