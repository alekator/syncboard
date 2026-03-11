# ADR 005: Presence Store and Redis

## Context

Presence signals (`online`, `activity.update`) require lightweight shared state and room coordination.

## Problem

Support presence across process boundaries while keeping local development simple.

## Decision

Use a pluggable presence store:

- in-memory presence store for local/default mode
- Redis-backed presence store when `REDIS_URL` is configured

## Alternatives Considered

- In-memory only:
  - simplest, but not process-safe for scaled instances.
- Redis mandatory everywhere:
  - production-ready by default, but raises local setup barrier.

## Consequences

- Positive:
  - low-friction local dev path
  - clear upgrade path for multi-instance coordination
- Negative:
  - behavioral differences between memory and Redis modes must be understood
  - no full distributed pub/sub backplane yet for all realtime events

## Trade-offs

The hybrid mode keeps onboarding lightweight while preserving a practical production-oriented path.
