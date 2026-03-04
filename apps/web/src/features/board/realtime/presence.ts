import type { RealtimeEventEnvelope } from '@syncboard/shared'

export function applyPresenceEvent(
  previous: string[],
  envelope: RealtimeEventEnvelope,
): string[] {
  if (envelope.event.type !== 'presence.update') {
    return previous
  }

  const { userId, online } = envelope.event.payload
  const set = new Set(previous)

  if (online) {
    set.add(userId)
  } else {
    set.delete(userId)
  }

  return [...set].sort((a, b) => a.localeCompare(b))
}
