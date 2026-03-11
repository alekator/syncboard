# Observability Guide

This document explains how to inspect SyncBoard runtime health, metrics, and logs during development and incident triage.

## Signals Overview

### Health

- Endpoint: `GET /health`
- Purpose: liveness check for API process.
- Expected response:

```json
{ "status": "ok" }
```

### Metrics

- Endpoint: `GET /metrics`
- Format: Prometheus text exposition.
- Current metrics:
  - `syncboard_ws_active_connections` (gauge)
  - `syncboard_ws_reconnect_total` (counter)
  - `syncboard_failed_mutations_total` (counter)
  - `syncboard_forbidden_total` (counter)

### Logs

- Logger: Fastify built-in structured logging.
- Correlation key: `reqId` in logs, mirrored to client via `x-request-id` response header.

## Quick Checks

### 1) API is alive

```bash
curl -s http://localhost:3001/health
```

### 2) Metrics endpoint responds

```bash
curl -s http://localhost:3001/metrics
```

### 3) Request correlation works

```bash
curl -i http://localhost:3001/health
```

Verify `x-request-id` is present in response headers.

## Local Prometheus + Grafana

Start stack:

```bash
pnpm obs:up
```

Stop stack:

```bash
pnpm obs:down
```

Default local URLs:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3002` (admin/admin)

Pre-provisioned dashboard:

- `SyncBoard Observability` (`ops/observability/grafana/dashboards/syncboard-overview.json`)

Prometheus alert rules:

- `ops/observability/prometheus/alerts.yml`

## Metric Query Cheatsheet

Use these expressions in Prometheus/Grafana once scraping is enabled.

### Failed mutation rate (5m)

```promql
rate(syncboard_failed_mutations_total[5m])
```

### Forbidden response rate (5m)

```promql
rate(syncboard_forbidden_total[5m])
```

### WS reconnect rate (5m)

```promql
rate(syncboard_ws_reconnect_total[5m])
```

### Active websocket connections

```promql
syncboard_ws_active_connections
```

## Log Examples

### Normal request

```json
{
  "level": 30,
  "reqId": "req-1",
  "req": { "method": "GET", "url": "/health" },
  "msg": "incoming request"
}
```

### Completed request

```json
{
  "level": 30,
  "reqId": "req-1",
  "res": { "statusCode": 200 },
  "responseTime": 1.2,
  "msg": "request completed"
}
```

## Diagnostic Playbooks

### Symptom: high failed mutations

1. Check `rate(syncboard_failed_mutations_total[5m])`.
2. Correlate with logs containing `statusCode >= 400`.
3. Split by endpoint (auth, board mutations, card mutations).
4. Validate auth/session state and membership ACL assumptions.
5. Use runbook: `docs/runbooks/high-failed-mutations.md`

### Symptom: high reconnect rate

1. Check `rate(syncboard_ws_reconnect_total[5m])`.
2. Check `syncboard_ws_active_connections` stability.
3. Inspect websocket close patterns and network instability.
4. Verify reconnect replay path (`fromSequence`) behavior.
5. Use runbook: `docs/runbooks/high-ws-reconnect-rate.md`

### Symptom: elevated forbidden responses

1. Check `rate(syncboard_forbidden_total[5m])`.
2. Validate whether traffic comes from expected users/roles.
3. Confirm board membership setup in seed/test flows.
4. Use runbook: `docs/runbooks/high-forbidden-rate.md`

### Symptom: API scrape target down

1. Check `up{job="syncboard-api"}` in Prometheus.
2. Validate `GET /health` and dependency health.
3. Use runbook: `docs/runbooks/api-down.md`

## Alert Rules

Current rule set in `ops/observability/prometheus/alerts.yml`:

- `SyncboardApiDown` (critical)
- `SyncboardHighFailedMutationRate` (warning)
- `SyncboardHighForbiddenRate` (warning)
- `SyncboardHighWsReconnectRate` (warning)

Each alert includes `runbook_url` pointing to local runbook docs.

## Coverage Map by Subsystem

- API
  - liveness: `/health`
  - per-request structured logs + `reqId`
  - failed mutation and forbidden counters
- WebSocket
  - active connections gauge
  - reconnect counter
- Auth/Authorization
  - forbidden counter
  - request logs with status code and request id

## Current Gaps

- Route-level latency histograms are not exposed yet.
- Reconnect recovery duration histogram is not exposed yet.
