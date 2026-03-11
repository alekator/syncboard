# ADR 002: State Consistency Model

## Context

Board state is updated by both REST mutations and realtime events.

## Problem

Prevent stale or duplicate event application and guarantee deterministic convergence after reconnect.

## Decision

Use per-board monotonic `sequence` numbers in realtime envelopes and treat server state as source of truth.

Client rules:

- apply only events with `sequence > latestSeen`
- ignore duplicate/stale envelopes
- on reconnect send `fromSequence` in `board.join`

Server rules:

- keep per-board sequence progression
- replay missed events from in-memory replay log based on `fromSequence`

## Alternatives Considered

- Last-write-wins by timestamp only:
  - simpler but vulnerable to clock/order ambiguities.
- CRDT model:
  - stronger distributed guarantees, but much higher complexity for this scope.

## Consequences

- Positive:
  - deterministic stale-event rejection
  - explicit replay path after brief disconnects
- Negative:
  - replay buffer retention is bounded (in-memory)
  - long disconnects still require full snapshot refresh

## Trade-offs

Sequence-gated eventual consistency gives predictable behavior at low complexity, accepting bounded replay history.
