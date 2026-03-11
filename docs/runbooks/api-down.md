# Runbook: API Down

## Trigger

- Alert: `SyncboardApiDown`
- Condition: Prometheus scrape target `syncboard-api` is down for 2 minutes.

## Immediate Checks

1. Verify API process/container is running.
2. Check `GET /health` from host and inside Docker network.
3. Confirm `APP_ORIGIN`, `PORT`, and database/redis dependencies are healthy.

## Diagnosis

1. Inspect API logs for startup failures, dependency connection errors, or crashes.
2. Validate DB/Redis health:
   - `docker compose ps`
   - `docker compose logs postgres redis`
3. Validate metrics endpoint path:
   - `curl -s http://localhost:3001/metrics`

## Mitigation

1. Restart API service:
   - `docker compose restart api`
2. If DB or Redis is down, restore dependencies first.
3. If recent deploy caused failure, rollback to previous known-good revision.

## Exit Criteria

- `up{job="syncboard-api"} == 1`
- `GET /health` returns `{"status":"ok"}`.
- No recurrent restart loop within 15 minutes.
