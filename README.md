# NewSchool Apply

A web application for prospective students and families to apply to a school.

## Overview

NewSchool Apply is a monorepo containing the React frontend and the Drupal backend. Drupal handles all authentication, authorization, business rules, and data storage. The React app renders UI and calls Drupal's API.

## Repository Structure

```
/frontend/          ← Plain React application (Dockerfile.dev + Dockerfile)
/backend/           ← Drupal container (Dockerfile, init script, config)
docker-compose.yml  ← Wires frontend (port 3000) + backend (port 8080)
```

## Architecture

- **Frontend** (`/frontend/`): Plain React — renders UI, collects input, calls Drupal API endpoints
- **Backend** (`/backend/`): Drupal — single source of truth for all application logic, permissions, and workflow state. Runs in a Docker container with SQLite by default for lightweight local development and testing.

## Features

- Login via Google, Microsoft, or email and password
- Multi-step application form
- Family and student profile management
- Document and information submission
- Application status tracking

## Getting Started

Everything runs in Docker. You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 1. Configure environment

Copy the example env file and set credentials:

```bash
cp frontend/.env.example frontend/.env
```

Create a `.env` file at the repo root for Drupal admin credentials:

```bash
# .env (repo root — gitignored)
DRUPAL_ADMIN_USER=admin
DRUPAL_ADMIN_PASS=changeme
```

### 2. Start all services

```bash
docker compose up --build
```

- **Frontend (React):** http://localhost:3000 — hot-reload enabled
- **Backend (Drupal):** http://localhost:8080

The Drupal init script runs automatically on first start, installs Drupal with SQLite, imports config, and creates the admin account.

### 3. Stop services

```bash
docker compose down
```

To also remove the database volume (full reset):

```bash
docker compose down -v
```

### Running Frontend Tests

```bash
docker compose run --rm frontend npm test -- --watchAll=false
```

Or, if you prefer to run tests locally without Docker (requires Node 20+):

```bash
cd frontend
npm ci
npm test -- --watchAll=false
```

## Notes

- All authentication is handled by Drupal. The frontend never manages tokens or sessions directly.
- Client-side validation is for user experience only. All authoritative validation is server-side.
- SQLite is the default database for local development. Production deployments should configure a proper database (e.g., MySQL/PostgreSQL) via environment variables.
- Hot-reload inside Docker on Windows uses polling (`CHOKIDAR_USEPOLLING=true`); it works but is slightly slower than native `npm start`.
- See [AGENTS.md](AGENTS.md) for AI coding agent rules and architectural guardrails.
