# Runbook: High Failed Mutations

## Trigger

- Alert: `SyncboardHighFailedMutationRate`
- Condition: `rate(syncboard_failed_mutations_total[5m]) > 0.2` for 10 minutes.

## Immediate Checks

1. Validate current mutation endpoints availability and latency.
2. Correlate with recent deploys/migrations in API.
3. Check if errors are concentrated on one board or one user cohort.

## Diagnosis

1. Inspect API logs filtered by non-2xx mutation responses.
2. Segment by endpoint (`/boards/*`, `/cards/*`, `/columns/*`) and status code.
3. Verify ACL and auth token validity for failing requests.
4. Validate DB health and lock/contention symptoms.

## Mitigation

1. Revert or hotfix recent API changes if regression is confirmed.
2. Reduce client retry pressure for known non-retriable errors.
3. Repair data inconsistencies if failures are tied to specific entities.

## Exit Criteria

- `rate(syncboard_failed_mutations_total[5m])` returns below threshold.
- Error logs stabilize to baseline.
- Smoke-test critical mutation flows (create/update/move/delete card) passes.
