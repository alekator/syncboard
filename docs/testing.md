# Testing Guide

This document describes the testing layers, local commands, and CI expectations for SyncBoard.

## Test Layers

- Unit tests
  - Scope: pure logic in `packages/shared`, API domain logic, and UI state logic.
- Integration tests
  - Scope: API routes, auth/ACL behavior, realtime sequencing/reconnect behavior.
- E2E tests
  - Scope: full user flows in browser via Playwright (`apps/web/e2e`).

## Local Test Commands

Run all quality checks in CI-like order:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @syncboard/shared test
pnpm --filter @syncboard/api test
pnpm --filter @syncboard/web test
pnpm --filter @syncboard/web test:e2e
```

Run subsets:

```bash
pnpm --filter @syncboard/api test
pnpm --filter @syncboard/web test
pnpm --filter @syncboard/web test:e2e
```

## CI Test Policy

- `quality` job must pass: lint + typecheck + shared/api/web tests + build.
- `performance` job must pass: `pnpm performance:ci` regression gate.
- `e2e` job must pass after `quality`, `security`, and `performance`.
- A PR is considered merge-ready only when all required jobs are green.

## High-Value Negative Scenarios

- Unauthorized REST/WS requests are rejected.
- Non-members cannot access board resources.
- `viewer` cannot perform write mutations.
- Reconnect with `fromSequence` restores missed events.
- Stale/duplicate realtime envelopes are ignored.

## Flaky Test Triage

1. Re-run the failing test locally in isolation.
2. Check deterministic setup assumptions (seed data, auth/session, timing).
3. For e2e, inspect Playwright trace/screenshots/videos from CI artifacts.
4. Fix root cause first; avoid adding retries as the primary mitigation.
5. Only after stabilization, adjust timeout/retry with documented rationale.

## Exit Criteria per Change

- New behavior is covered by at least one automated test.
- Regression-prone paths (auth, ACL, realtime, mutation errors) include negative assertions.
- Local checks pass before push, and CI remains fully green after push.
