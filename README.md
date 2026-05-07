# NewSchool Apply

A demo decoupled web application built on top of two reusable platform components:

- **[drx-apiserver](https://github.com/mennotech/drx-apiserver)** (`v0.0.1-rc1`) — production-oriented Drupal 10 base image (`drx-drupal-base`) acting as the data, auth, and security backend.
- **[drx-schema](https://github.com/mennotech/drx-schema)** (`v0.1.0`) — PowerShell module that turns the YAML schema in `schema/v2/` into Drupal config-sync YAML.

This repo provides the project-specific schema (`schema/v2/`) and the plain-JS Vite frontend (`frontend/`). All authentication, authorization, business rules, and persistence are handled by Drupal — the frontend is UI only.

## Repo layout

```
schema/v2/         Application schema (entity types, content types, form pages)
schema/DrX-Schema/ drx-schema PowerShell module (git submodule, pinned to v0.1.0)
schema/sync/       Generated Drupal config-sync payload (gitignored, mounted into the backend)
frontend/          Vite + plain JavaScript SPA
docker-compose.yml Local dev orchestration (backend image + frontend build)
.env.example       Template for required environment variables
AGENTS.md          Architectural guardrails for contributors and AI agents
FRONTEND-FEATURES.md Target frontend feature spec
INIT-PROMPT.md     One-shot prompt to generate the frontend with an AI coding agent
```

## Quick start

```bash
# 1. Clone with the drx-schema submodule
git clone --recurse-submodules https://github.com/mennotech/newschool-apply.git
cd newschool-apply

# 2. Configure environment
cp .env.example .env
# edit .env — at minimum set DRUPAL_ADMIN_PASS

# 3. Generate Drupal config-sync from schema/v2
pwsh -c "Import-Module ./schema/DrX-Schema; Export-DrXDrupalScaffoldConfig -SchemaPath ./schema/v2 -OutputPath ./schema/sync"

# 4. Start everything
docker compose up -d

# Backend healthcheck:  curl http://localhost:8080/user/login_status?_format=json
# Frontend dev server:  http://localhost:3000
```

## Re-applying schema changes

Edit `schema/v2/*.yaml`, regenerate `schema/sync/`, and restart the backend:

```bash
pwsh -c "Import-Module ./schema/DrX-Schema; Export-DrXDrupalScaffoldConfig -SchemaPath ./schema/v2 -OutputPath ./schema/sync"
docker compose restart backend
```

The base image's hash-gated `config:import` re-applies the new config on boot.

## Working in the frontend

```bash
cd frontend
npm ci
npm run dev
```

Frontend code targets the backend at `VITE_BACKEND_BASE_URL` (default `http://localhost:8080`). Authentication uses Drupal session cookies + CSRF token from `/session/token`. The frontend never handles tokens or makes authorization decisions — see [AGENTS.md](AGENTS.md).

## Branch context

This branch (`v2-frontend`) is a fresh start that consumes `drx-apiserver` and `drx-schema` as external dependencies. The backend Drupal source code lives in those upstream repos; this repo owns only the schema, the frontend, and the wiring between them.
