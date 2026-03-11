# SLO and SLI Targets

This document defines initial reliability objectives for SyncBoard.

## Scope

SLOs apply to the API + realtime backend in local/standard deployment mode.

## SLO 1: API Availability

- Objective: `>= 99.9%` successful API responses.
- SLI:
  - numerator: count of non-5xx API responses
  - denominator: count of all API responses
- Measurement window: rolling 30 days.

## SLO 2: API Latency (Read Path)

- Objective: `p95 < 250ms` for `GET /boards/:boardId`.
- SLI:
  - p95 latency of successful responses for board snapshot reads
- Measurement window: rolling 7 days.

## SLO 3: Mutation Reliability

- Objective: failed mutation ratio `< 1.0%`.
- SLI:
  - numerator: failed mutation requests (`POST/PATCH/DELETE`, status `>= 400`)
  - denominator: all mutation requests (`POST/PATCH/DELETE`)
- Measurement window: rolling 7 days.

## SLO 4: Realtime Reconnect Recovery

- Objective: `p95 < 3s` reconnect-to-resync completion.
- SLI:
  - time from websocket reconnect to successful board resync (join + replay/snapshot consistency)
- Measurement window: rolling 7 days.

## Error Budget Policy

- Availability error budget (30 days): `0.1%`.
- If budget burn exceeds 50% mid-window:
  - freeze non-critical feature work
  - prioritize reliability fixes and incident follow-ups

## Instrumentation Notes

- Existing runtime metrics:
  - `syncboard_ws_active_connections`
  - `syncboard_ws_reconnect_total`
  - `syncboard_failed_mutations_total`
  - `syncboard_forbidden_total`
- Additional metrics needed for full SLO compliance:
  - request duration histogram by route
  - reconnect recovery duration histogram

## Reporting Cadence

- Weekly review of SLI trends.
- Monthly SLO compliance summary and threshold adjustment decision.
