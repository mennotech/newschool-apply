# NewSchool Apply

Web application for prospective students and families to apply to NewSchool.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (CRA), Redux Toolkit, React Router v6 |
| Backend | Drupal 10, PHP 8.2, SQLite (local dev) |
| API | Drupal JSON:API + session-based auth |
| Tests | Jest, React Testing Library, MSW |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Compose v2)
- Git

---

## Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/mennotech/newschool-apply.git
cd newschool-apply

# 2. Set admin credentials
export DRUPAL_ADMIN_USER=admin
export DRUPAL_ADMIN_PASS=changeme

# 3. Start both services
docker compose up --build

# 4. Access:
#   Frontend: http://localhost:3000
#   Backend (Drupal): http://localhost:8080
```

On first start `backend/init.sh` runs automatically: installs Drupal with SQLite, creates the admin account, enables required modules, and creates roles.

The frontend hot-reloads on file changes due to `CHOKIDAR_USEPOLLING=true` (required for Docker on Windows/macOS).

---

## Running Tests

```bash
# Run the full frontend test suite (non-interactive)
docker compose run --rm frontend npm test -- --watchAll=false
```

Or locally (Node 20+ required):

```bash
cd frontend
npm ci
npm test -- --watchAll=false
```

---

## Environment Variables

### Frontend

Copy `.env.example` to `.env` for local development outside Docker:

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_DRUPAL_BASE_URL` | `http://localhost:8080` | Drupal base URL (no trailing slash) |

When running via `docker compose`, this variable is injected automatically.

### Backend

| Variable | Default | Description |
|---|---|---|
| `DRUPAL_ADMIN_USER` | `admin` | Drupal admin username |
| `DRUPAL_ADMIN_PASS` | `changeme` | Drupal admin password — **change in production** |
| `STRIPE_SECRET_KEY` | _(unset)_ | Stripe secret key (overrides admin config when set) |
| `STRIPE_WEBHOOK_SECRET` | _(unset)_ | Stripe webhook signing secret (overrides admin config when set) |

---

## Architecture

See [AGENTS.md](AGENTS.md) for full architectural guardrails.

**Key principle:** Drupal is the single source of truth. React is UI only.

### Authentication Flow

1. Email/password: `POST /user/login` → Drupal sets session cookie.
2. Social login: redirect to `{DRUPAL_BASE_URL}/social-auth/google` or `/social-auth/microsoft`.
3. Frontend fetches `/user/me` and stores user in Redux.
4. All mutating requests include a fresh `X-CSRF-Token` from `/session/token`.

### Application Flow

1. **Student Info** — saved to `node--student_profile` via JSON:API.
2. **Documents** — file uploaded to Drupal file API.
3. **Review & Submit** — `PATCH node--application` sets `field_status = submitted`.

### Payments Flow (Backend-Authoritative)

1. Frontend calls `POST /api/payments/checkout-session` with session cookie + `X-CSRF-Token`.
2. Drupal creates a `payment` node (`pending`) and returns Stripe Checkout URL.
3. Frontend redirects to Stripe-hosted checkout.
4. Stripe sends `checkout.session.completed` webhook to `POST /api/payments/stripe/webhook`.
5. Drupal verifies the webhook signature and marks the `payment` node `paid`.

Payment configuration UI: `/admin/config/newschool/payments`

---

## Project Structure

```
newschool-apply/
├── docker-compose.yml
├── AGENTS.md
├── backend/
│   ├── Dockerfile
│   ├── init.sh
│   ├── services.yml
│   └── config/sync/
└── frontend/
    ├── Dockerfile
    ├── Dockerfile.dev
    ├── nginx.conf
    ├── .env.example
    └── src/
        ├── api/drupalClient.js
        ├── components/
        │   ├── ApplicationProgress.js
        │   ├── ProtectedRoute.js
        │   └── steps/
        ├── mocks/
        ├── pages/
        └── store/
```

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
