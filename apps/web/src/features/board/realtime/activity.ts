import type { RealtimeEventEnvelope } from '@syncboard/shared'

export function applyActivityEvent(
  previous: Record<string, boolean>,
  envelope: RealtimeEventEnvelope,
) {
  if (envelope.event.type === 'activity.update') {
    return {
      ...previous,
      [envelope.event.payload.userId]: envelope.event.payload.dragging,
    }
  }

  if (envelope.event.type === 'presence.update' && !envelope.event.payload.online) {
    const next = { ...previous }
    delete next[envelope.event.payload.userId]
    return next
  }

  return previous
}
