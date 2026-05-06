# Backend Testing Framework Guide

**Part of:** [INIT-PROMPT-FULL.md](INIT-PROMPT-FULL.md#backend-tests-powershell-smoke-tests)

This guide covers the two backend test layers:

1. **PHPUnit** — Drupal unit and kernel tests written in PHP, living in `backend/tests/`. These test PHP logic in isolation (custom module business rules, field validation, service behavior) without requiring a running HTTP server.
2. **PowerShell smoke tests** — Cross-platform HTTP-level tests that run against the Dockerized Drupal backend and validate API contracts, auth/session behavior, and CRUD operations. These are the subject of most of this document.

For high-level testing strategy and CI integration, see the [INIT-PROMPT-FULL.md](INIT-PROMPT-FULL.md) documentation.

## PHPUnit (Drupal Backend Unit Tests)

PHPUnit tests live under `backend/tests/` and follow Drupal's standard testing conventions.

**Structure:**
```
backend/
  tests/
    src/
      Unit/          — Pure PHP unit tests (no database)
      Kernel/        — Drupal kernel tests (database, no browser)
```

**Running PHPUnit tests** (inside the backend container):
```bash
docker compose exec backend /var/www/html/vendor/bin/phpunit \
  --configuration /var/www/html/phpunit.xml \
  /var/www/html/web/modules/custom
```

**Guidelines:**
- Test custom module logic, field formatters, service classes, and validators with PHPUnit.
- Keep Unit tests free of Drupal bootstrap where possible (fast and isolated).
- Use Kernel tests for tests that require entity/field API or configuration.
- Do not test API surface contracts with PHPUnit; use the smoke tests for that.

---

## PowerShell Smoke Tests

### Goal

Build a fast, deterministic backend smoke-test layer that:

- runs against the Dockerized Drupal backend
- validates critical endpoint contracts
- works the same on Windows, macOS, and Linux
- is simple enough for contributors and Copilot cloud agents to extend safely

## Core Principles

- Backend runtime is always Docker.
- Test scripts are PowerShell-first (`.ps1`) and executed with `pwsh`.
- Tests verify API contracts and auth/session behavior, not UI.
- Keep tests small, independent, and order-safe.
- Fail fast with clear messages and non-zero exit codes.

## 1. Create The Test Folder Structure

Start with this minimal structure:

```text
backend/
  scripts/
    smoke/
      common.ps1
      01-auth-session.ps1
      02-drupal-bundle-crud.ps1
      03-payments-and-logout.ps1
      run-all.ps1
```

Naming convention:

- Prefix test groups with numbers so ordering is explicit.
- Keep one responsibility per script.

## 2. Build A Shared PowerShell Test Library

Create `backend/scripts/smoke/common.ps1` to centralize reusable behavior.

Recommended functions:

- `Write-Step` for readable progress output
- `Assert-StatusCode` for HTTP response checks
- `Assert-True` for simple boolean assertions
- `Invoke-Api` wrapper around `Invoke-WebRequest` or `Invoke-RestMethod`
- `Get-Json` to parse JSON safely
- `Fail-Test` to print reason and exit non-zero

Script baseline:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
```

Cross-platform note:

- Use `pwsh` (PowerShell 7+), not Windows PowerShell 5.1-only features.
- Avoid OS-specific shell calls in shared helpers.

## 3. Add Your First Smoke Test Group

Create `01-auth-session.ps1` first. It should validate foundational auth/session contracts.

Suggested checks:

1. Anonymous `GET /user/login_status?_format=json` returns unauthenticated (`0`).
2. `GET /session/token` returns a non-empty token string.
3. Login endpoint succeeds with test credentials.
4. Authenticated login status returns `1`.
5. Protected session/user-info endpoint behavior matches expected authorization rules.

Implementation guidance:

- Use a temporary cookie/session file if needed.
- Keep request payloads minimal and explicit.
- Assert both status code and key response fields.

## 4. Add A Second Contract Test Group

Create `02-drupal-bundle-crud.ps1` to validate CRUD behavior across all defined Drupal bundles.

Suggested checks:

1. Discover or enumerate all required bundle machine names used by the backend.
2. Create one minimal valid entity per bundle.
3. Read each created entity and assert expected fields and relationships are present.
4. Update at least one mutable field per bundle and verify persistence.
5. Delete the created entity and verify it is no longer retrievable.

Implementation guidance:

- Keep a per-bundle fixture payload map in the script so test data is explicit.
- Use unique test values (for example, timestamp suffixes) to avoid collisions.
- Track created entity IDs and always clean up, even when an assertion fails.
- Fail with bundle-specific error messages so regressions are easy to diagnose.

## 5. Add A Third Contract Test Group

Create `03-payments-and-logout.ps1` to validate payment request contracts and session teardown.

Suggested checks:

1. Payment endpoint rejects malformed or incomplete requests with expected 4xx.
2. Stripe webhook endpoint rejects invalid signatures.
3. Logout endpoint invalidates session.
4. Post-logout login status returns `0`.

Keep these checks contract-focused. Do not embed long setup flows.

## 6. Add A Single Entry Runner

Create `run-all.ps1` that executes test groups in order and exits immediately on failure.

Runner responsibilities:

- Accept configurable parameters:
  - `BaseUrl` (default `http://localhost:8080`)
  - `AdminUser`
  - `AdminPass`
- Dot-source `common.ps1`
- Execute `01-*`, then `02-*`, then `03-*`
- Return non-zero if any group fails

Cross-platform invocation:

```bash
pwsh ./backend/scripts/smoke/run-all.ps1
```

## 7. Wire It To Docker-Based Local Testing

From repository root:

```bash
docker compose up -d backend
pwsh ./backend/scripts/smoke/run-all.ps1
```

Use overrides when needed:

```bash
pwsh ./backend/scripts/smoke/run-all.ps1 -BaseUrl "http://localhost:8080" -AdminUser $env:DRUPAL_ADMIN_USER -AdminPass $env:DRUPAL_ADMIN_PASS
```

On Windows, run the same `pwsh` command from WSL or PowerShell 7.

## 8. Add CI Execution

In CI, keep the same sequence used locally:

1. Build backend image.
2. Start backend container with test credentials.
3. Wait for backend health.
4. Run `pwsh ./backend/scripts/smoke/run-all.ps1`.
5. On failure, print backend logs.
6. Always tear down containers.

This keeps local and CI behavior aligned.

## 9. Keep Tests Deterministic

Do:

- test fixed API contracts
- use explicit assertions
- clean up session state during each run

Avoid:

- timing-dependent sleeps as test logic
- dependency on manually seeded UI state
- broad "catch-all" tests that hide root causes

## 10. How To Add New Test Groups

When adding a new check area:

1. Add the next numeric script (for example `04-<topic>.ps1`) under `backend/scripts/smoke`.
2. Reuse helpers from `common.ps1`.
3. Keep checks narrowly scoped.
4. Add the new script to `run-all.ps1`.
5. Document the new group in this file.

Examples:

- `04-jsonapi-contracts.ps1`
- `05-access-control.ps1`
- `06-file-upload-contracts.ps1`

## 11. Minimum Done Criteria

A backend testing framework is considered **complete and ready for Copilot cloud agents** when:

- ✓ Tests execute cross-platform using `pwsh` (Windows, macOS, Linux)
- ✓ All tests run **only** against the Dockerized Drupal backend (no host-specific setup)
- ✓ Shared helper module `backend/scripts/smoke/common.ps1` exists with reusable functions
- ✓ Single ordered runner `backend/scripts/smoke/run-all.ps1` exists and accepts `BaseUrl`, `AdminUser`, `AdminPass` parameters
- ✓ At least three smoke test groups exist with clear responsibilities:
  - `01-auth-session.ps1` — Authentication, session, and login_status verification
  - `02-drupal-bundle-crud.ps1` — CRUD operations across all defined bundles
  - `03-payments-and-logout.ps1` — Payment contracts and logout flow
- ✓ CI workflow (`.github/workflows/copilot-setup-steps.yml`) executes the **same** runner used by local developers
- ✓ All tests pass without errors when run: `pwsh ./backend/scripts/smoke/run-all.ps1 -BaseUrl 'http://localhost:8080' -AdminUser $env:DRUPAL_ADMIN_USER -AdminPass $env:DRUPAL_ADMIN_PASS`
- ✓ Framework is documented in [INIT-PROMPT-FULL.md](INIT-PROMPT-FULL.md#testing-strategy) under the Testing Strategy section

## 12. Add Copilot Cloud Setup Workflow

To give Copilot cloud agent a Docker test environment, add a workflow file at `.github/workflows/copilot-setup-steps.yml`.

### Why this workflow exists

- It tells Copilot how to build and start the backend in CI.
- It guarantees tests run in a containerized environment, not a host-specific setup.
- It reuses the same smoke test runner used by developers: `pwsh ./backend/scripts/smoke/run-all.ps1`.

### Build steps

1. Create `.github/workflows/copilot-setup-steps.yml`.
2. Add triggers for `workflow_dispatch`, `pull_request`, and `push` to `main`.
3. Build and start Docker backend with explicit test credentials from workflow env.
4. Wait until backend is healthy.
5. Run the PowerShell smoke runner.
6. Print backend logs on failure.
7. Always tear down containers and volumes.

### Copy-ready workflow template

```yaml
name: Copilot Backend Setup Steps

on:
  workflow_dispatch:
  pull_request:
    paths:
      - 'backend/**'
      - 'application-form.schema.yaml'
      - 'docker-compose.yml'
      - '.github/workflows/copilot-setup-steps.yml'
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'application-form.schema.yaml'
      - 'docker-compose.yml'
      - '.github/workflows/copilot-setup-steps.yml'

permissions:
  contents: read

jobs:
  backend-smoke:
    runs-on: ubuntu-latest
    env:
      DRUPAL_ADMIN_USER: admin
      DRUPAL_ADMIN_PASS: ${{ secrets.DRUPAL_ADMIN_PASS }}
      STRIPE_WEBHOOK_SECRET: whsec_ci_test_secret

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Regenerate Drupal scaffold config
        run: node backend/scripts/scaffold-drupal-from-schema.js application-form.schema.yaml

      - name: Build backend image
        run: docker compose build backend

      - name: Start backend container
        run: docker compose up -d backend

      - name: Wait for backend health
        shell: pwsh
        run: |
          $maxAttempts = 60
          for ($i = 1; $i -le $maxAttempts; $i++) {
            $health = docker inspect --format '{{.State.Health.Status}}' newschool-apply-backend-1 2>$null
            if ($health -eq 'healthy') {
              Write-Host 'Backend is healthy.'
              exit 0
            }
            Start-Sleep -Seconds 5
          }
          Write-Error 'Backend did not become healthy in time.'

      - name: Run backend smoke tests
        run: pwsh ./backend/scripts/smoke/run-all.ps1 -BaseUrl 'http://localhost:8080' -AdminUser $env:DRUPAL_ADMIN_USER -AdminPass $env:DRUPAL_ADMIN_PASS

      - name: Show backend logs on failure
        if: failure()
        run: docker compose logs backend

      - name: Stop containers
        if: always()
        run: docker compose down -v
```

### Notes

- Use `pwsh` in CI so script behavior matches local cross-platform behavior.
- Keep the workflow command surface minimal and deterministic.
- If your backend service/container name differs, update the health-check inspect target accordingly.

---

## 13. Integration with Copilot Cloud Agents

This testing framework is designed to support Copilot cloud agents building the NewSchool Apply application. When Copilot agents work on backend features:

1. **Agents must consult this document** before implementing new tests or modifying existing ones.
2. **Agents must run the smoke test suite** after any backend changes: `pwsh ./backend/scripts/smoke/run-all.ps1`
3. **All tests must pass** before the work is considered complete.
4. **CI workflow** (via `.github/workflows/copilot-setup-steps.yml`) provides the containerized test environment.

For Copilot agent responsibilities and testing requirements, see section 13 in [AGENTS.md](AGENTS.md).

---

## 14. Documentation Structure

This document is part of the complete NewSchool Apply documentation system:

- **[INIT-PROMPT-FULL.md](INIT-PROMPT-FULL.md)** — Main initialization prompt with project overview, setup, and high-level testing strategy
- **[AGENTS.md](AGENTS.md)** — Architectural guardrails and AI agent responsibilities (section 13 covers testing)
- **[BACKEND-TESTING.md](BACKEND-TESTING.md)** — This file; detailed backend testing framework reference
- **[BACKEND-FEATURES.md](BACKEND-FEATURES.md)** — Complete backend feature specification
- **[FRONTEND-FEATURES.md](FRONTEND-FEATURES.md)** — Complete frontend feature specification

Read all referenced documents before implementing features or tests.
