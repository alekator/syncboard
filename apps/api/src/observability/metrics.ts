type CounterName = 'wsReconnectTotal' | 'failedMutationsTotal' | 'forbiddenTotal'
type GaugeName = 'wsActiveConnections'
type HttpStatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'other'

const HTTP_REQUEST_DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000]
const WS_RECONNECT_RECOVERY_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1_000, 2_000, 5_000]

type HistogramSeriesSnapshot = {
  buckets: number[]
  counts: number[]
  sum: number
  count: number
}

type HistogramSeries = HistogramSeriesSnapshot

type HttpRequestDurationSnapshot = {
  buckets: number[]
  entries: Array<{
    method: string
    route: string
    statusClass: HttpStatusClass
    counts: number[]
    sum: number
    count: number
  }>
}

type Snapshot = {
  wsActiveConnections: number
  wsReconnectTotal: number
  failedMutationsTotal: number
  forbiddenTotal: number
  httpRequestDurationMs: HttpRequestDurationSnapshot
  wsReconnectRecoveryMs: HistogramSeriesSnapshot
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

  private readonly httpRequestDurationMs = new Map<string, HistogramSeries>()
  private readonly wsReconnectRecoveryMs = createHistogramSeries(WS_RECONNECT_RECOVERY_BUCKETS_MS)
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

  observeHttpRequestDuration(method: string, route: string, statusCode: number, durationMs: number) {
    const statusClass = toHttpStatusClass(statusCode)
    const key = `${method}|${route}|${statusClass}`
    const existing = this.httpRequestDurationMs.get(key)
    const series = existing ?? createHistogramSeries(HTTP_REQUEST_DURATION_BUCKETS_MS)
    observeHistogram(series, durationMs)
    this.httpRequestDurationMs.set(key, series)
  }

  observeWsReconnectRecovery(durationMs: number) {
    observeHistogram(this.wsReconnectRecoveryMs, durationMs)
  }

  snapshot(): Snapshot {
    const httpEntries = Array.from(this.httpRequestDurationMs.entries())
      .map(([key, series]) => {
        const [method, route, statusClass] = key.split('|')
        return {
          method,
          route,
          statusClass: statusClass as HttpStatusClass,
          ...cloneHistogramSeries(series),
        }
      })
      .sort((left, right) =>
        `${left.method}${left.route}${left.statusClass}`.localeCompare(
          `${right.method}${right.route}${right.statusClass}`,
        ),
      )

    return {
      wsActiveConnections: this.gauges.wsActiveConnections,
      wsReconnectTotal: this.counters.wsReconnectTotal,
      failedMutationsTotal: this.counters.failedMutationsTotal,
      forbiddenTotal: this.counters.forbiddenTotal,
      httpRequestDurationMs: {
        buckets: [...HTTP_REQUEST_DURATION_BUCKETS_MS],
        entries: httpEntries,
      },
      wsReconnectRecoveryMs: cloneHistogramSeries(this.wsReconnectRecoveryMs),
    }
  }
}

export function renderPrometheusMetrics(snapshot: Snapshot) {
  const metricLines = [
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
    '# HELP syncboard_http_request_duration_ms HTTP request duration in milliseconds by method, route, and status class.',
    '# TYPE syncboard_http_request_duration_ms histogram',
    ...renderLabeledHistogram(
      'syncboard_http_request_duration_ms',
      snapshot.httpRequestDurationMs.buckets,
      snapshot.httpRequestDurationMs.entries,
      (entry) => `method="${entry.method}",route="${entry.route}",status_class="${entry.statusClass}"`,
    ),
    '# HELP syncboard_ws_reconnect_recovery_duration_ms Duration in milliseconds for reconnect join replay recovery.',
    '# TYPE syncboard_ws_reconnect_recovery_duration_ms histogram',
    ...renderHistogramSeries(
      'syncboard_ws_reconnect_recovery_duration_ms',
      snapshot.wsReconnectRecoveryMs.buckets,
      snapshot.wsReconnectRecoveryMs.counts,
      snapshot.wsReconnectRecoveryMs.sum,
      snapshot.wsReconnectRecoveryMs.count,
    ),
  ]

  return [...metricLines, ''].join('\n')
}

function createHistogramSeries(buckets: number[]): HistogramSeries {
  return {
    buckets: [...buckets],
    counts: buckets.map(() => 0),
    sum: 0,
    count: 0,
  }
}

function observeHistogram(series: HistogramSeries, value: number) {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0
  series.sum += safeValue
  series.count += 1

  for (let index = 0; index < series.buckets.length; index += 1) {
    if (safeValue <= series.buckets[index]) {
      series.counts[index] += 1
    }
  }
}

function cloneHistogramSeries(series: HistogramSeries): HistogramSeriesSnapshot {
  return {
    buckets: [...series.buckets],
    counts: [...series.counts],
    sum: series.sum,
    count: series.count,
  }
}

function toHttpStatusClass(statusCode: number): HttpStatusClass {
  if (statusCode >= 200 && statusCode < 300) {
    return '2xx'
  }
  if (statusCode >= 300 && statusCode < 400) {
    return '3xx'
  }
  if (statusCode >= 400 && statusCode < 500) {
    return '4xx'
  }
  if (statusCode >= 500 && statusCode < 600) {
    return '5xx'
  }
  return 'other'
}

function renderLabeledHistogram<T extends { counts: number[]; sum: number; count: number }>(
  metricName: string,
  buckets: number[],
  entries: T[],
  labelRenderer: (entry: T) => string,
) {
  const lines: string[] = []

  for (const entry of entries) {
    const labels = labelRenderer(entry)
    lines.push(...renderHistogramSeries(metricName, buckets, entry.counts, entry.sum, entry.count, labels))
  }

  return lines
}

function renderHistogramSeries(
  metricName: string,
  buckets: number[],
  counts: number[],
  sum: number,
  count: number,
  labels?: string,
) {
  const lines: string[] = []

  for (let index = 0; index < buckets.length; index += 1) {
    lines.push(`${metricName}${withLabels(labels, `le="${buckets[index]}"`)} ${counts[index]}`)
  }
  lines.push(`${metricName}${withLabels(labels, 'le="+Inf"')} ${count}`)
  lines.push(`${metricName}_sum${withLabels(labels)} ${sum}`)
  lines.push(`${metricName}_count${withLabels(labels)} ${count}`)

  return lines
}

function withLabels(primary?: string, extra?: string) {
  if (!primary && !extra) {
    return ''
  }
  if (!primary && extra) {
    return `{${extra}}`
  }
  if (primary && !extra) {
    return `{${primary}}`
  }
  return `{${primary},${extra}}`
}
