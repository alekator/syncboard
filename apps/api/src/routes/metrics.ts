import type { FastifyInstance } from 'fastify'

import { renderPrometheusMetrics, type MetricsRegistry } from '../observability/metrics.js'

export async function registerMetricsRoute(app: FastifyInstance, metrics: MetricsRegistry) {
  app.get('/metrics', async (_request, reply) => {
    const body = renderPrometheusMetrics(metrics.snapshot())
    reply.header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
    return body
  })
}
