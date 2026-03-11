# ADR 004: Optimistic UI for Board Mutations

## Context

Board interactions (move, reorder, edit) should feel immediate during collaboration.

## Problem

Balance responsiveness with correctness when server mutation may fail or conflict.

## Decision

Apply optimistic updates on the client for move/reorder/edit flows and rollback (or refetch) on mutation failure.

## Alternatives Considered

- Strict server-ack UI (no optimistic update):
  - simpler correctness story, but poor UX under latency.
- Full operation queue with conflict resolution layer:
  - robust but significantly more complexity for current scope.

## Consequences

- Positive:
  - responsive drag/drop and edit experience
  - reduced perceived latency for common operations
- Negative:
  - transient divergence is possible until server acknowledgment
  - rollback handling must be tested for edge cases

## Trade-offs

Optimistic UI improves usability and portfolio realism while accepting controlled complexity in rollback and reconciliation.
