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

### Symptom: high reconnect rate

1. Check `rate(syncboard_ws_reconnect_total[5m])`.
2. Check `syncboard_ws_active_connections` stability.
3. Inspect websocket close patterns and network instability.
4. Verify reconnect replay path (`fromSequence`) behavior.

### Symptom: elevated forbidden responses

1. Check `rate(syncboard_forbidden_total[5m])`.
2. Validate whether traffic comes from expected users/roles.
3. Confirm board membership setup in seed/test flows.

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
- Dashboards and alert rules are introduced in the next plan step.
