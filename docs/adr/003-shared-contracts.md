# ADR 003: Shared Contracts Package

## Context

Both API and web client exchange typed REST payloads and realtime envelopes.

## Problem

Avoid contract drift and duplicate schema logic across apps.

## Decision

Centralize schemas/types in `packages/shared` and consume them from both `apps/api` and `apps/web`.

## Alternatives Considered

- Independent frontend/backend typings:
  - lower coupling, but higher drift risk and duplicate maintenance.
- Code generation from OpenAPI only:
  - useful for REST, weaker fit for custom WS event unions currently used.

## Consequences

- Positive:
  - single source of truth for payload validation and TypeScript inference
  - faster refactors with compile-time feedback across apps
- Negative:
  - tighter coupling between app releases
  - contract changes can break both apps simultaneously if unmanaged

## Trade-offs

Shared contracts prioritize correctness and velocity over independent deployment flexibility.
