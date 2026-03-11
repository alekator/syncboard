# Runbook: High Forbidden Rate

## Trigger

- Alert: `SyncboardHighForbiddenRate`
- Condition: `rate(syncboard_forbidden_total[5m]) > 0.1` for 10 minutes.

## Immediate Checks

1. Determine if the spike is expected (new permissions rollout, pentest, traffic anomaly).
2. Confirm auth provider/session issuance is healthy.
3. Check whether failures are tied to a single board/workspace.

## Diagnosis

1. Inspect logs by `statusCode=403` and endpoint.
2. Verify board membership ACL records for impacted users.
3. Ensure client is not sending stale board IDs after reconnect/navigation.
4. Verify that no legacy role-header behavior is being relied on.

## Mitigation

1. Fix membership data for affected users/boards.
2. Roll back problematic auth/ACL changes if a regression is detected.
3. Add temporary client guardrails if stale route state causes repeated forbidden calls.

## Exit Criteria

- `rate(syncboard_forbidden_total[5m])` returns near normal baseline.
- Impacted users can read/write according to their real ACL role.
- Negative ACL tests remain green.
