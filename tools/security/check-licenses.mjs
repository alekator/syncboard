import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const allowlistPath = resolve(process.cwd(), 'ops/security/license-allowlist.json')
const allowlistRaw = readFileSync(allowlistPath, 'utf-8')
const allowlistConfig = JSON.parse(allowlistRaw)

if (!Array.isArray(allowlistConfig.allowedLicenses)) {
  throw new Error('ops/security/license-allowlist.json must contain "allowedLicenses" array')
}

const allowed = new Set(allowlistConfig.allowedLicenses)

function runPnpm(args) {
  if (process.env.npm_execpath) {
    return execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }

  const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  return execFileSync(pnpmBin, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
}

const licensesRaw = runPnpm(['licenses', 'list', '--json'])

const licensesBySpdx = JSON.parse(licensesRaw)
const observedLicenses = Object.keys(licensesBySpdx).sort()
const unexpected = observedLicenses.filter((license) => !allowed.has(license))

if (unexpected.length > 0) {
  console.error('Disallowed licenses detected:')
  for (const license of unexpected) {
    const packages = Array.isArray(licensesBySpdx[license]) ? licensesBySpdx[license] : []
    const names = packages.slice(0, 5).map((item) => item.name).join(', ')
    const suffix = packages.length > 5 ? ', ...' : ''
    console.error(`- ${license}: ${names}${suffix}`)
  }
  process.exit(1)
}

console.log(`License check passed. Observed SPDX licenses: ${observedLicenses.join(', ')}`)
