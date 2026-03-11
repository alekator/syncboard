import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const reportPath = resolve(process.cwd(), process.env.BENCH_REPORT_FILE ?? 'ops/performance/bench-latest.json')
const thresholdsPath = resolve(process.cwd(), process.env.BENCH_THRESHOLDS_FILE ?? 'ops/performance/ci-thresholds.json')

const report = JSON.parse(readFileSync(reportPath, 'utf-8'))
const thresholds = JSON.parse(readFileSync(thresholdsPath, 'utf-8'))

const failures = []

function checkMax(label, value, max) {
  if (value > max) {
    failures.push(`${label}: ${value.toFixed(2)}ms > ${max.toFixed(2)}ms`)
  }
}

checkMax('REST GET /boards/:id p95', report.rest.getBoardMs.p95, thresholds.rest.getBoardP95Ms)
checkMax('REST POST /columns/:id/cards p95', report.rest.createCardMs.p95, thresholds.rest.createCardP95Ms)
checkMax('REST PATCH /cards/:id p95', report.rest.moveCardMs.p95, thresholds.rest.moveCardP95Ms)

const wsByClients = new Map(report.ws.map((entry) => [String(entry.clients), entry]))

for (const [clients, max] of Object.entries(thresholds.ws.joinP95MsByClients)) {
  const scenario = wsByClients.get(clients)
  if (!scenario) {
    failures.push(`WS join scenario missing for clients=${clients}`)
    continue
  }
  checkMax(`WS join p95 (${clients} clients)`, scenario.joinMs.p95, Number(max))
}

for (const [clients, max] of Object.entries(thresholds.ws.broadcastTotalMsByClients)) {
  const scenario = wsByClients.get(clients)
  if (!scenario) {
    failures.push(`WS broadcast scenario missing for clients=${clients}`)
    continue
  }
  checkMax(`WS broadcast total (${clients} clients)`, scenario.broadcastTotalMs, Number(max))
}

for (const [clients, max] of Object.entries(thresholds.ws.reconnectTotalMsByClients)) {
  const scenario = wsByClients.get(clients)
  if (!scenario) {
    failures.push(`WS reconnect scenario missing for clients=${clients}`)
    continue
  }
  checkMax(`WS reconnect total (${clients} clients)`, scenario.reconnectTotalMs, Number(max))
}

if (failures.length > 0) {
  console.error('Performance regression gate failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Performance regression gate passed.')
