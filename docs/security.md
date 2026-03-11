# Security Automation

This project enforces a minimum security baseline in CI through two automated checks.

## 1) Vulnerability Audit

- Command: `pnpm security:audit`
- Internals: `pnpm audit --prod --audit-level high --ignore-registry-errors`
- Policy: fail CI on `high`/`critical` production vulnerabilities.

## 2) License Allowlist Check

- Command: `pnpm security:licenses`
- Internals: `tools/security/check-licenses.mjs`
- Source of truth: `ops/security/license-allowlist.json`
- Policy: fail CI if any dependency reports a SPDX license outside allowlist.

## Run Locally

```bash
pnpm security:ci
```

This runs both checks in the same order as CI.
