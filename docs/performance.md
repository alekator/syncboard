# Performance Benchmarks

This document describes how to run reproducible local performance checks for SyncBoard and how to read their output.

## Goal

Validate API and realtime behavior under repeatable local load:

- REST latency for core board/card operations
- WebSocket join latency under concurrent clients
- WebSocket broadcast fanout timing
- Reconnect burst timing with `fromSequence` replay

## Benchmark Script

The benchmark runner lives at:

- `apps/api/src/scripts/bench.ts`

Run it from repo root:

```bash
pnpm bench:api
```

CI-friendly benchmark + regression gate:

```bash
pnpm performance:ci
```

Or directly from API package:

```bash
pnpm --filter @syncboard/api bench
```

## Prerequisites

1. Start API locally:

```bash
pnpm --filter @syncboard/api dev
```

2. Ensure API and WS endpoints are reachable (defaults):
- API: `http://localhost:3001`
- WS: `ws://localhost:3001/ws`

## Configurable Environment Variables

Defaults are selected for laptop-friendly runs:

- `BENCH_API_URL` default: `http://localhost:3001`
- `BENCH_WS_URL` default: `ws://localhost:3001/ws`
- `BENCH_REST_ITERATIONS` default: `40`
- `BENCH_REST_CONCURRENCY` default: `8`
- `BENCH_WS_CLIENTS` default: `20,50,100`

Example:

```bash
BENCH_REST_ITERATIONS=80 BENCH_REST_CONCURRENCY=16 BENCH_WS_CLIENTS=50,100 pnpm bench:api
```

## Scenarios

### REST

- `GET /boards/:id` repeated (`N` requests, configurable concurrency)
- `POST /columns/:id/cards` repeated
- `PATCH /cards/:id` (position update / move-style mutation) repeated

The script reports:

- min / avg / p50 / p95 / max latency per scenario

### WebSocket / Realtime

For each client-count set (for example 20, 50, 100):

- login + board membership provisioning
- connect all clients and `board.join`
- measure connect+join latency distribution
- trigger one `activity.update` and measure total fanout completion time
- close all clients and reconnect burst with `fromSequence`
- measure total reconnect burst time

## Metrics to Track Over Time

- REST: p50, p95, max latency
- WS: join p95 latency
- WS: broadcast fanout total time
- WS: reconnect burst total time

## CI Regression Gate

Performance gate inputs:

- Benchmark report: `ops/performance/bench-latest.json`
- Threshold baseline: `ops/performance/ci-thresholds.json`

Gate commands:

```bash
pnpm bench:ci
pnpm bench:gate
```

`pnpm performance:ci` runs both commands in sequence.

Current CI scenario profile:

- `BENCH_BOOT_API=1` (self-boot API in memory mode)
- `BENCH_REST_ITERATIONS=20`
- `BENCH_REST_CONCURRENCY=4`
- `BENCH_WS_CLIENTS=10,20`

## Results Table Template

Fill this table from the script output and update it when making major realtime or persistence changes.

| Date | Environment | REST GET p95 | REST POST p95 | REST PATCH p95 | WS 20 join p95 | WS 50 join p95 | WS 100 join p95 | WS 100 reconnect total | Notes |
|------|-------------|--------------|---------------|----------------|----------------|----------------|-----------------|-------------------------|-------|
| YYYY-MM-DD | local machine (CPU/RAM/OS) | - | - | - | - | - | - | - | baseline |

## Interpreting Local Results

- Local numbers are for regression detection, not absolute production capacity claims.
- Compare runs on the same machine and similar background load.
- Focus on p95 and max trends, not only averages.
- If reconnect/broadcast times regress, inspect event fanout and room/membership flow first.
