# Incident Response Guide

This guide defines how to detect, triage, mitigate, and close incidents in SyncBoard.

## Severity Model

- `SEV-1`: Full outage or major user-impacting failure (API down, core flows unusable).
- `SEV-2`: Partial degradation (high error rates, reconnect storms, elevated forbiddens with user impact).
- `SEV-3`: Minor degradation, no major user-facing outage.

## Detection Sources

- Alerts from Prometheus rules (`ops/observability/prometheus/alerts.yml`)
- Health/metrics endpoints (`/health`, `/metrics`)
- CI/CD or deployment smoke checks
- User-reported failures

## First 15 Minutes (Triage Checklist)

1. Confirm severity and impacted scope (API, WS, auth, specific board flows).
2. Assign incident commander and record start timestamp.
3. Check:
   - `GET /health`
   - reconnect rate
   - failed mutation rate
   - forbidden response rate
4. Compare with recent deploy/change window.
5. Choose immediate mitigation (rollback, traffic reduction, temporary feature disable).

## Runbook Mapping

- API unavailable: `docs/runbooks/api-down.md`
- High failed mutations: `docs/runbooks/high-failed-mutations.md`
- High forbidden rate: `docs/runbooks/high-forbidden-rate.md`
- High websocket reconnects: `docs/runbooks/high-ws-reconnect-rate.md`

Runbooks index: `docs/runbooks/README.md`

## Communication Protocol

- Open incident channel/thread with:
  - start time
  - severity
  - affected systems/users
  - current mitigation
- Send status updates every 15-30 minutes until stable.
- Declare resolved only after metrics and user flows are back to baseline.

## Resolution and Recovery

1. Verify primary symptom cleared.
2. Verify secondary effects (auth, board mutation, realtime fanout/reconnect).
3. Keep heightened monitoring for at least one observation window.
4. Close incident with exact resolution timestamp.

## Post-Incident Review

Complete within 48 hours:

1. Timeline (detection -> mitigation -> resolution).
2. Root cause and contributing factors.
3. What worked / what did not.
4. Corrective actions with owners and due dates.
5. Tests/alerts/runbooks/docs updates to prevent recurrence.

## Exit Criteria

- Production behavior is stable and confirmed by telemetry.
- Affected user journey is manually validated end-to-end.
- Follow-up actions are tracked in backlog with clear ownership.
