# Testing Guide

This document explains the backend testing skeleton in this repository and how to run it locally and in CI.

## Purpose

The backend smoke-test skeleton provides a fast confidence check that the Drupal backend is up, session/auth endpoints behave correctly, and key payment route contracts are enforced.

It is designed to catch integration regressions early without requiring a full Drupal PHPUnit suite.

## Backend Smoke Test Skeleton

Current smoke-test files:

- backend/scripts/smoke/common.sh
- backend/scripts/smoke/01-auth-session.sh
- backend/scripts/smoke/02-payments-and-logout.sh
- backend/scripts/smoke/run-all.sh
- backend/scripts/smoke/run-all.ps1

Responsibilities:

- 01-auth-session.sh:
  - verifies anonymous login status
  - verifies CSRF token endpoint
  - verifies anonymous access to session info is rejected
  - performs login and validates authenticated session + session info payload
- 02-payments-and-logout.sh:
  - validates payment endpoint request contracts (missing required fields)
  - validates invalid Stripe webhook signature rejection
  - logs out and verifies session is invalidated
- run-all.sh:
  - executes both Bash smoke groups in order
- run-all.ps1:
  - PowerShell-native all-in-one runner for Windows developers

## GitHub Copilot Setup Steps Workflow

File: .github/workflows/copilot-setup-steps.yml

This workflow is named `Copilot Backend Setup Steps`. GitHub Copilot uses workflows with this specific naming convention to understand how to build and set up the environment when it runs tasks against the repository. By defining the setup steps here, Copilot knows how to prepare a working backend environment before it attempts to run, test, or modify code.

### Trigger Conditions

The workflow runs on:

- `workflow_dispatch` — manually from the Actions tab or triggered by Copilot
- `pull_request` — when changes touch backend, schema, docker-compose, or the workflow file itself
- `push` to `main` — same path filter as above

### Permissions

The workflow uses `contents: read` only. It does not write back to the repository.

### Steps

| Step | What it does |
|---|---|
| Checkout repository | Fetches the full repository into the runner |
| Setup Node.js | Installs Node 20 for the scaffold script |
| Regenerate Drupal scaffold config | Runs `backend/scripts/scaffold-drupal-from-schema.js` to keep Drupal config in sync with `application-form.schema.yaml` |
| Build backend image | Runs `docker compose build backend` against the local Dockerfile |
| Start backend container | Starts the backend with test credentials via `docker compose up -d backend` |
| Wait for backend health check | Polls Docker's health status up to 60 times at 5-second intervals; fails if the container never becomes healthy |
| Run backend smoke tests | Executes `backend/scripts/smoke/run-all.sh` with `BASE_URL=http://localhost:8080` |
| Show backend logs on failure | Dumps `docker compose logs backend` if any prior step failed |
| Stop containers | Always tears down containers and volumes via `docker compose down -v` |

### Environment Variables Used In CI

| Variable | CI value | Purpose |
|---|---|---|
| `DRUPAL_ADMIN_USER` | `admin` | Drupal admin username for Drush site install |
| `DRUPAL_ADMIN_PASS` | `password123` | Drupal admin password |
| `STRIPE_WEBHOOK_SECRET` | `whsec_ci_test_secret` | Dummy webhook secret so the webhook route initializes without 500 errors |

### Health Check Details

The health check runs `curl -f http://localhost/user/login_status?_format=json` inside the container (as defined in `docker-compose.yml`). Drupal must be fully installed, configured, and serving valid responses before the smoke tests execute.

Health check timing:

- `start_period: 120s` — no failures counted during Drupal install
- `interval: 30s` — checks every 30 seconds after the start period
- `retries: 5` — must succeed within 5 retries
- CI waits up to 5 minutes (60 × 5-second poll) before timing out

## Local Run Prerequisites

- Docker Desktop (or Docker Engine)
- Docker Compose v2
- Backend container can start successfully on port 8080

Optional depending on OS:

- Bash-compatible shell (Git Bash, WSL, or Linux/macOS terminal) for .sh runners
- PowerShell for .ps1 runner

## Run Locally (Linux/macOS or Bash)

From repository root:

```bash
docker compose up -d backend
bash backend/scripts/smoke/run-all.sh
```

Run smoke groups individually:

```bash
bash backend/scripts/smoke/01-auth-session.sh
bash backend/scripts/smoke/02-payments-and-logout.sh
```

## Run Locally (Windows PowerShell)

From repository root:

```powershell
docker compose up -d backend
powershell -ExecutionPolicy Bypass -File backend/scripts/smoke/run-all.ps1
```

PowerShell 7 shorthand:

```powershell
./backend/scripts/smoke/run-all.ps1
```

## Useful Overrides

Bash runner:

```bash
BASE_URL="http://localhost:8080" bash backend/scripts/smoke/run-all.sh
```

PowerShell runner:

```powershell
./backend/scripts/smoke/run-all.ps1 -BaseUrl "http://localhost:8080" -AdminUser "admin" -AdminPass "password123"
```

## Troubleshooting

If tests fail, check:

1. Backend is healthy:
   - docker compose ps
2. Backend logs:
   - docker compose logs backend
3. Backend endpoint manually:
   - curl http://localhost:8080/user/login_status?_format=json

Common causes:

- backend container not fully initialized yet
- stale Docker volume state after major Drupal/config changes
- credentials mismatch with DRUPAL_ADMIN_USER and DRUPAL_ADMIN_PASS

If you need a fresh local Drupal state:

```bash
docker compose down -v
docker compose up -d backend
```

## How To Extend The Skeleton

To add a new smoke group:

1. Create a new Bash script under backend/scripts/smoke with numeric prefix, for example:
   - 03-jsonapi-contracts.sh
2. Source common.sh in the new script and keep checks deterministic.
3. Add the new script to run-all.sh in execution order.
4. If needed on Windows, mirror the new check in run-all.ps1.
5. Keep checks focused on endpoint behavior and contracts, not UI.

Good smoke checks:

- endpoint authentication/authorization behavior
- required field contract validation
- expected status code transitions across auth/session lifecycle

Avoid in smoke layer:

- long-running data setup
- brittle timing-dependent assertions
- frontend-specific UI behavior

## Recommended Future Expansion

When backend logic grows, keep this smoke skeleton and add:

- targeted Drupal unit/integration tests for custom module logic
- JSON:API contract tests for high-value resources
- deterministic fixture setup for deeper backend behavior validation
