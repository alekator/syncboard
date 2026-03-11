type CounterName = 'wsReconnectTotal' | 'failedMutationsTotal' | 'forbiddenTotal'
type GaugeName = 'wsActiveConnections'

type Snapshot = {
  wsActiveConnections: number
  wsReconnectTotal: number
  failedMutationsTotal: number
  forbiddenTotal: number
}

export class MetricsRegistry {
  private readonly counters: Record<CounterName, number> = {
    wsReconnectTotal: 0,
    failedMutationsTotal: 0,
    forbiddenTotal: 0,
  }

  private readonly gauges: Record<GaugeName, number> = {
    wsActiveConnections: 0,
  }

  private readonly seenWsUsers = new Set<string>()

  incrementCounter(name: CounterName, amount = 1) {
    this.counters[name] += amount
  }

  addWsConnection(userId: string) {
    this.gauges.wsActiveConnections += 1
    if (this.seenWsUsers.has(userId)) {
      this.incrementCounter('wsReconnectTotal')
      return
    }

    this.seenWsUsers.add(userId)
  }

  removeWsConnection() {
    this.gauges.wsActiveConnections = Math.max(0, this.gauges.wsActiveConnections - 1)
  }

  snapshot(): Snapshot {
    return {
      wsActiveConnections: this.gauges.wsActiveConnections,
      wsReconnectTotal: this.counters.wsReconnectTotal,
      failedMutationsTotal: this.counters.failedMutationsTotal,
      forbiddenTotal: this.counters.forbiddenTotal,
    }
  }
}

export function renderPrometheusMetrics(snapshot: Snapshot) {
  return [
    '# HELP syncboard_ws_active_connections Current active WebSocket connections.',
    '# TYPE syncboard_ws_active_connections gauge',
    `syncboard_ws_active_connections ${snapshot.wsActiveConnections}`,
    '# HELP syncboard_ws_reconnect_total Total WebSocket reconnects (same user connected again).',
    '# TYPE syncboard_ws_reconnect_total counter',
    `syncboard_ws_reconnect_total ${snapshot.wsReconnectTotal}`,
    '# HELP syncboard_failed_mutations_total Total failed mutation requests (POST/PATCH/DELETE with status >= 400).',
    '# TYPE syncboard_failed_mutations_total counter',
    `syncboard_failed_mutations_total ${snapshot.failedMutationsTotal}`,
    '# HELP syncboard_forbidden_total Total HTTP 403 responses.',
    '# TYPE syncboard_forbidden_total counter',
    `syncboard_forbidden_total ${snapshot.forbiddenTotal}`,
    '',
  ].join('\n')
}
