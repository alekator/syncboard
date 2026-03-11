# ADR 001: Realtime Transport

## Context

SyncBoard requires low-latency collaborative updates for board state, presence, and ephemeral activity.

## Problem

Choose a transport that supports bidirectional messages, room-style fanout, and reconnect behavior without introducing high operational complexity.

## Decision

Use WebSocket (`@fastify/websocket`) as the primary realtime transport.

## Alternatives Considered

- HTTP polling:
  - simpler infra, but poor latency and high request overhead.
- Server-Sent Events (SSE):
  - good for server-to-client streaming, but weak fit for bidirectional client activity events.

## Consequences

- Positive:
  - efficient bidirectional communication
  - natural fit for board rooms and activity fanout
  - reconnect flow can carry `fromSequence` for gap replay
- Negative:
  - connection lifecycle management required
  - scaling fanout and connection count requires careful instrumentation and load testing

## Trade-offs

WebSocket increases server complexity versus polling/SSE, but delivers the interaction quality needed for collaborative drag/drop and presence.
