import { execFileSync } from 'node:child_process'

const env = {
  ...process.env,
  BENCH_BOOT_API: '1',
  BENCH_REST_ITERATIONS: '20',
  BENCH_REST_CONCURRENCY: '4',
  BENCH_WS_CLIENTS: '10,20',
  BENCH_OUTPUT_FILE: '../../ops/performance/bench-latest.json',
}

if (process.env.npm_execpath) {
  execFileSync(process.execPath, [process.env.npm_execpath, '--filter', '@syncboard/api', 'bench'], {
    stdio: 'inherit',
    env,
  })
} else {
  const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  execFileSync(pnpmBin, ['--filter', '@syncboard/api', 'bench'], {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  })
}
