# Deployment Guide

This document defines a practical deployment flow for SyncBoard API + Web and its dependencies.

## Runtime Components

- Web app (`apps/web`)
- API service (`apps/api`)
- PostgreSQL (when `PERSISTENCE_MODE=postgres`)
- Redis (recommended for distributed presence)

## Required Environment Variables

- `VITE_API_URL`
- `VITE_WS_URL`
- `PORT`
- `HOST`
- `APP_ORIGIN`
- `PERSISTENCE_MODE`
- `DATABASE_URL`
- `REDIS_URL`

Use `.env.example` as baseline and inject secrets from deployment platform, not from committed files.

## Pre-Deploy Checklist

1. CI is green on `main` (security, quality, performance, e2e).
2. Migration/client generation status is valid for target DB schema.
3. SLO-impacting changes are reviewed (latency, error rate, reconnect behavior).
4. Rollback plan is prepared for this release.

## Standard Deployment Flow

1. Build artifacts:
```bash
pnpm install --frozen-lockfile
pnpm build
```
2. Generate Prisma client for API image/runtime:
```bash
pnpm --filter @syncboard/api db:generate
```
3. Apply database migrations in controlled step (if any).
4. Deploy API, then Web.
5. Run post-deploy smoke checks.

## Post-Deploy Smoke Checks

```bash
curl -s http://<api-host>/health
curl -s http://<api-host>/metrics
```

Manual checks:

- Login and open boards list.
- Open board and perform create/move/update card flow.
- Verify second client receives realtime updates.

## Rollback Triggers

- Error rate spike (`failed_mutations_total`) beyond acceptable threshold.
- Sustained reconnect spikes after deploy.
- Critical API unavailability.

If triggered, execute rollback checklist from release docs and incident runbook references.

## Deployment Risks and Mitigations

- Schema/runtime mismatch
  - Mitigation: run migration and Prisma generation as explicit steps.
- Config drift between environments
  - Mitigation: central env var template and startup validation.
- Realtime instability under load
  - Mitigation: observe reconnect/connection metrics immediately after release.
