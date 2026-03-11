export function shouldApplyRealtimeSequence(current: number, incoming: number) {
  return incoming > current
}

export function nextRealtimeSequence(current: number, incoming: number) {
  return Math.max(current, incoming)
}
