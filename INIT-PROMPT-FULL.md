# NewSchool Apply — Complete Initialization Prompt

## Overview

You are rebuilding **NewSchool Apply**, a web application for prospective students and families to apply to a school. The repository is a monorepo with two directories:

- `/frontend/` — Plain React application (JavaScript, npm) — runs in Docker for both dev and production
- `/backend/` — Drupal 10 container (Dockerfile, initialization script, exported config)
- `docker-compose.yml` — root-level compose file that wires frontend + backend together

## Required Reading Order

**IMPORTANT:** Read these documents in this order before implementing anything:

1. **`AGENTS.md`** — Read first and internalize completely. Contains non-negotiable architectural guardrails that govern every decision in this project. If a task conflicts with these rules, stop and escalate instead of attempting a workaround.
2. **`BACKEND-FEATURES.md`** — After understanding the guardrails, read this for the complete backend feature specification, including content types, fields, API endpoints, and Drupal modules.
3. **`FRONTEND-FEATURES.md`** — Read this for the complete frontend feature specification, including routing, authentication, multi-step form structure, and UI components.

These three documents together define the complete feature set and architectural constraints. **Do not invent features or architecture that contradicts these documents.**

---

## Summary of Core Principles (from AGENTS.md)

These are the most critical rules; they are non-negotiable:

- **Drupal is the single source of truth.** All authentication, authorization, business logic, workflow state, data validation, and permission decisions live in Drupal.
- **React is UI only.** It renders screens, collects input, and calls Drupal's JSON:API or custom REST endpoints. It never duplicates backend logic or makes business decisions.
- **No new npm packages without explicit maintainer approval.** Use built-in browser APIs, React, Redux (already included), and MSW/Jest/RTL for tests.
- **No token/session management in frontend.** Login is handled by Drupal. Use session cookies + CSRF tokens for state-changing requests.
- **No unapproved dependencies.** Before adding any package, first check if the functionality can be achieved with existing tools or vanilla JavaScript.
- **Security and privacy first.** Never expose secrets, PII, or sensitive data on the client. Never log personal data to console. Follow FERPA/COPPA and all privacy regulations.

For the complete set of rules and their justifications, refer to `AGENTS.md`.

---

## Project Setup & Infrastructure

### Repository Structure

```
/backend/
  Dockerfile                    — Backend Docker image
  init.sh                       — Startup initialization script
  composer.json                 — Drupal Composer package configuration
  services.yml                  — CORS and service configuration
  config/
    sync/                       — Exported Drupal configuration (versioned)
  modules/
    custom/
      newschool_payments/       — Custom payment module
  scripts/
    scaffold-drupal-from-schema.js  — Schema generation utility
  tests/
    api.test.js                 — API integration tests
/frontend/
  Dockerfile                    — Production image (multi-stage, nginx)
  Dockerfile.dev                — Development image (node + CRA dev server)
  nginx.conf                    — Production nginx configuration
  package.json                  — React and test dependencies
  public/
    index.html                  — HTML entry point
  src/
    index.js                    — React bootstrap
    index.css                   — Global styles
    setupTests.js               — Test configuration
    App.js                      — Root component
    api/                        — Drupal API utilities
    components/                 — React components
    pages/                       — Page-level components
    store/                      — Redux slices and store
    mocks/                      — MSW handlers and test server
docker-compose.yml              — Orchestrate frontend + backend
AGENTS.md                       — Architectural guardrails (read first!)
BACKEND-FEATURES.md             — Backend implementation spec
FRONTEND-FEATURES.md            — Frontend implementation spec
INIT-PROMPT-FULL.md             — This file
```

### Docker & Compose Configuration

**Backend Dockerfile:**
- Base image: `php:8.2-apache-bookworm`
- Installs Drupal 10 via Composer, copies exported config, sets up Apache
- Drush is installed for install-time operations (not on PATH; use full path `/var/www/html/vendor/bin/drush`)
- Stripe CLI is installed for webhook testing
- Required PHP extensions: `pdo_sqlite`, `gd`, `curl`, `opcache`, etc.
- Exposes port 80
- Sets `DocumentRoot /var/www/html/web`

**Frontend Dockerfile.dev (development):**
- Base image: `node:20-alpine`
- Sets `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` for Windows/macOS Docker file-watching
- Runs `npm ci && npm start` (CRA dev server on port 3000)
- Source directory is mounted as a volume for live hot-reload

**Frontend Dockerfile (production):**
- Multi-stage build:
  - Stage 1: `node:20-alpine` — builds the React app (`npm ci && npm run build`)
  - Stage 2: `nginx:alpine` — serves static files from `build/` directory
- Includes `nginx.conf` for routing and client-side routing fallback (`index.html`)

**Root docker-compose.yml:**
- Services: `backend` and `frontend`
- Backend service:
  - Builds from `./backend/Dockerfile`
  - Ports: `8080:80` (so `http://localhost:8080` reaches Drupal)
  - Environment variables: `DRUPAL_ADMIN_USER`, `DRUPAL_ADMIN_PASS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CORS_ALLOWED_ORIGINS`
  - Volume: `backend_drupal_files:/var/www/html/web/sites/default/files` (Drupal uploaded files directory only)
  - Volume: `backend_drupal_db:/var/drupal-db` (SQLite database, stored outside `sites/default/files` to prevent web exposure)
- Frontend service:
  - Builds from `./frontend/Dockerfile.dev` (for development) or `./frontend/Dockerfile` (for production)
  - Ports: `3000:3000`
  - Environment: `REACT_APP_DRUPAL_BASE_URL=http://localhost:8080`
  - Volume mount: `./frontend/src:/app/src` (for hot-reload in dev)
- Named volume: `backend_drupal_files` for persistent Drupal uploaded files
- Named volume: `backend_drupal_db` for the SQLite database stored at `/var/drupal-db/db.sqlite` (outside the webroot)
- On Fly.io, a single `/data` volume is used instead: SQLite at `/data/db/db.sqlite` and uploaded files at `/data/files` (symlinked from `sites/default/files`). The SQLite path is read from `DRUPAL_SQLITE_PATH`.

### Environment Configuration

**Backend:**
- `DRUPAL_ADMIN_USER` — Drupal admin username (e.g., `admin`)
- `DRUPAL_ADMIN_PASS` — Drupal admin password (e.g., `password123`)
- `STRIPE_SECRET_KEY` — Stripe secret key (provided at runtime; can be overridden in env)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (provided at runtime)
- `CORS_ALLOWED_ORIGINS` — Comma-separated list of allowed CORS origins (e.g., `http://localhost:3000`); defaults to local frontend
- `DRUPAL_SITE_NAME` — Optional; defaults to "NewSchool Apply"

**Frontend:**
- `REACT_APP_DRUPAL_BASE_URL` — Base URL for Drupal API (e.g., `http://localhost:8080`)
  - Read from `.env` locally; injected via `docker-compose.yml` in containers
  - Create `.env.example` with placeholder value; `.env` is gitignored

---

## Development Workflow

### Starting the Application

```bash
# From root directory
docker compose up

# In another terminal, watch frontend tests (optional)
cd frontend
npm test -- --watchAll=false
```

Backend starts on `http://localhost:8080` (Drupal admin at `/admin`).
Frontend starts on `http://localhost:3000` (React SPA).

### Making Changes

**Backend (Drupal):**
1. Modify Drupal config, modules, or custom code in `/backend/`
2. For schema-driven content type or field definition changes, regenerate definitions from schema:
   - `node backend/scripts/scaffold-drupal-from-schema.js backend/schema/v2`
   - Use `backend/schema/application-form.schema-v2.yaml` only for compatibility scenarios.
   - Do not hand-maintain generated field definition YAML when the schema/script can be updated.
3. If generated field definition files need reformatting or structure changes, update schema files and/or add scaffolding functionality in `backend/scripts/scaffold-drupal-from-schema.js`, then regenerate.
4. Rebuild and restart: `docker compose up --build backend`
5. Or run `docker exec <backend_container> /var/www/html/vendor/bin/drush` for Drush commands

**Frontend (React):**
1. Edit files in `/frontend/src/`
2. Changes auto-reload via CRA dev server and Docker volume mounts
3. Run tests: `cd frontend && npm test -- --watchAll=false`

### Database Reset

Drupal SQLite database is stored outside `sites/default/files`:
- **Local Docker Compose**: named volume `backend_drupal_db` mounted at `/var/drupal-db/db.sqlite`
- **Fly.io**: `/data/db/db.sqlite` inside the single `/data` volume

To reset locally:

```bash
docker compose down -v    # Remove volumes
docker compose up         # Recreates fresh Drupal instance
```

---

## State Management (Redux)

The frontend uses **Redux Toolkit** for state management. Structure:

```
frontend/src/store/
  index.js                      — Redux store configuration
  slices/
    authSlice.js                — `{ user, logoutToken, status, error }`
    applicationSlice.js         — `{ currentApplication, steps, status, error }`
```

**Auth Slice:**
- `user` — `null | { uid, name, email, roles }`
- `logoutToken` — logout token returned by the login response; required for the logout request
- `status` — `'idle' | 'loading' | 'error'`

**Application Slice:**
- `currentApplication` — Currently loaded/editing application (node object)
- `steps` — Array of step data
- `status` — `'idle' | 'loading' | 'error'`

Use Redux actions and selectors throughout the app. Do not introduce alternative state management libraries without maintainer approval.

---

## API Utility Layer

Create `frontend/src/api/drupalClient.js` with functions:

```javascript
// Core HTTP functions
export async function get(path)
export async function post(path, body)
export async function patch(path, body)
export async function delete_(path)

// File upload
export async function uploadFile(path, file)

// Authentication
export async function login(name, pass)           // POST /user/login
export async function logout(logoutToken)        // GET /user/logout?token=...
export async function getLoginStatus()           // GET /user/login_status → boolean
export async function getLogoutToken()           // Recover logout token from session

// CSRF
export async function getCsrfToken()             // GET /session/token

// Helper
export function setBaseUrl(url)                  // Configure base URL
```

**Key behaviors:**
- All requests read `REACT_APP_DRUPAL_BASE_URL` from environment
- All requests include `credentials: 'include'` to send session cookies
- `post`, `patch`, `delete_` automatically fetch and attach CSRF token as `X-CSRF-Token` header
- Logout uses the `logoutToken` returned by login response (not CSRF token)
- `getLogoutToken()` is used only for bootstrapped sessions (where no login response was received); it must call a backend endpoint that returns the logout token for the current Drupal session
- Throw structured errors parsed from Drupal's JSON:API error format
- Never store sensitive tokens long-term; fetch CSRF fresh before each mutation

---

## Routing Structure

Frontend routing uses `react-router-dom`. Key routes:

| Path | Component | Protected | Purpose |
|---|---|---|---|
| `/` | `HomePage` | No | Landing page with login CTA |
| `/login` | `LoginPage` | No | Email/password + Google/Microsoft links |
| `/register` | `RegisterPage` | No | Account creation form |
| `/dashboard` | `DashboardPage` | Yes | Application list and management |
| `/apply` | `ApplicationLayout` | Yes | Multi-step form entry point |
| `/apply/:step` | `StepComponent` | Yes | Individual step within multi-step form |
| `/profile` | `ProfilePage` | Yes | User profile and settings |
| `*` | `NotFoundPage` | No | 404 fallback |

**Protected Route Behavior:**
- Redirect unauthenticated users to `/login`
- Preserve the original `?next=` query param for post-login redirect
- On session validation at app start, redirect away from login/register if already authenticated

---

## Authentication Flow Details

### Login Flow

1. User navigates to `/login`
2. `LoginPage` renders:
   - Email + Password form
   - "Login with Google" link → redirect to `{DRUPAL_BASE_URL}/oauth/authorize/google`
   - "Login with Microsoft" link → redirect to `{DRUPAL_BASE_URL}/oauth/authorize/microsoft`
3. Email/password submission:
   - POST `/user/login?_format=json` with `{ name, pass }`
   - Drupal returns: `{ current_user: { uid, name, email, roles }, logout_token, csrf_token }`
   - Store `current_user` and `logout_token` in Redux auth slice
   - Do **not** store `csrf_token` from the login response; fetch a fresh CSRF token from `/session/token` before each state-changing request
4. Social login:
   - Browser redirects to Drupal OAuth endpoint
   - Drupal handles OAuth handshake with provider
   - Drupal redirects back to frontend with session cookie
   - Frontend detects authentication and redirects to dashboard
5. Redirect to original destination (or `/dashboard`)

### Session Verification

**On app initialization:**
1. Call `GET /user/login_status?_format=json`
2. If returns `1` (authenticated):
   - Check Redux auth slice
   - If has `user` data, skip re-login
   - If NO `user` data (e.g., user logged in via Drupal admin UI), **bootstrap lightweight user object**:
     - Fetch current user info (minimal data needed for UI)
     - Store in Redux auth slice
   - Continue to app
3. If returns `0` (not authenticated):
   - Redirect to `/login`

**On tab/window visibility change:**
- Call `getLoginStatus()` to verify session is still valid
- If changed from authenticated to unauthenticated, redirect to `/login`

### Logout Flow

1. Call `logout(logoutToken)` where `logoutToken` is from Redux auth slice
2. Backend invalidates session
3. If successful response received:
   - Clear Redux auth slice
   - Redirect to `/`
4. If failed (network error, bad token):
   - DO NOT clear local state
   - User can retry logout or navigate away

**Important:** The logout token is NOT the CSRF token. Drupal returns a misleading 403 ("csrf_token URL query argument is missing") when the logout token is wrong — this is a known quirk. The token must come from the login response body.

### CSRF Token Management

- Do NOT store CSRF token long-term in Redux
- Before each POST/PATCH/DELETE, call `getCsrfToken()` to fetch a fresh token
- Include as `X-CSRF-Token` header
- This keeps the token in sync with the Drupal session

---

## Testing Strategy

### Backend Tests (PowerShell Smoke Tests)

The backend uses a **cross-platform PowerShell-based smoke test framework** to validate Drupal API contracts and critical workflows.

**Structure:**
```
backend/scripts/smoke/
  common.ps1                    — Shared test helpers and utilities
  01-auth-session.ps1           — Authentication and session management tests
  02-drupal-bundle-crud.ps1     — Entity CRUD operations across all bundles
  03-payments-and-logout.ps1    — Payment endpoint and logout flow tests
  run-all.ps1                   — Test runner (executes all tests in order)
```

**How to run:**

```bash
# Ensure backend is running via Docker
docker compose up -d backend

# From repo root, execute test suite
pwsh ./backend/scripts/smoke/run-all.ps1 -BaseUrl 'http://localhost:8080' -AdminUser 'admin' -AdminPass 'password123'
```

**Key principles:**
- Tests run cross-platform using `pwsh` (PowerShell 7+)
- Tests validate API contracts, not implementation details
- Tests are deterministic, order-independent, and clean up after themselves
- Each test group focuses on a single responsibility
- Failures exit immediately with clear error messages

**For complete backend testing documentation**, see [BACKEND-TESTING.md](BACKEND-TESTING.md).

### Frontend Tests (Jest + React Testing Library + MSW)

**Test files:**
- Colocated with each component/module as `*.test.js`
- Use Jest as test runner
- Use React Testing Library for component testing
- Use MSW (Mock Service Worker) for API mocking

**MSW Setup:**
```
frontend/src/mocks/
  handlers.js         — Defined API route handlers
  server.js           — MSW server for test environment
```

In `setupTests.js`, start MSW server before all tests and cleanup after.

**Test Coverage Requirements:**

| Module | What to Test |
|---|---|
| `api/drupalClient.js` | HTTP methods attach correct headers; CSRF token fetched before mutations; base URL from environment; error parsing |
| `pages/LoginPage.js` | Form renders; email/password submit calls API; Google/Microsoft links present; success redirects to dashboard; error displays message |
| `pages/RegisterPage.js` | Form renders; validation errors; submit calls API; success shows confirmation; error displays message |
| `components/ProtectedRoute.js` | Redirects unauthenticated users to login; renders children when authenticated; preserves `?next=` param |
| `pages/DashboardPage.js` | Loads applications on mount; displays application list; shows draft/submitted status; draft has "Continue" action; non-draft has "View" action |
| `pages/ApplicationLayout.js` | Renders step indicator; shows current step; allows navigation between steps; disables future steps until prerequisites complete |
| Step components | Each step validates required fields; shows validation errors; advances to next step on valid submit |
| Redux slices | Actions dispatch correctly; reducers update state as expected; selectors return correct data |

**Do not use snapshot tests for logic testing.** Snapshots are for UI regression only. Use explicit assertions for behavior verification.

**Run tests:**
```bash
cd frontend
npm test -- --watchAll=false
```

All tests must pass before merging.

---

## Accessibility Requirements

- Every form input has an associated `<label>` element (or `aria-label` if label not appropriate)
- Invalid form fields have `aria-invalid="true"`
- Error messages are linked via `aria-describedby` to the input
- All interactive elements are keyboard-navigable (Tab/Shift+Tab)
- Focus is always visible (do not remove outline without replacement)
- Use semantic HTML (`<button>`, `<form>`, `<input>`, `<h1>...<h6>`, etc.)
- No `dangerouslySetInnerHTML` except for controlled, server-sanitized content
- Meet WCAG 2.1 AA standards as a minimum

---

## Development Checklist

Before considering the app complete, verify:

- [ ] Backend Dockerfile builds and runs Drupal 10 successfully
- [ ] Backend `init.sh` runs on startup and scaffolds database/config
- [ ] Drupal field definitions are generated via `backend/scripts/scaffold-drupal-from-schema.js` from schema sources
- [ ] Any field-definition formatting changes are implemented in schema/scaffolder and regenerated (not hand-reformatted in generated output)
- [ ] Frontend Dockerfile.dev supports hot-reload on Windows (via `CHOKIDAR_USEPOLLING`)
- [ ] Frontend Dockerfile production image serves static files via nginx
- [ ] `docker-compose up` starts both services successfully
- [ ] Frontend can reach backend at `http://localhost:8080`
- [ ] Login/logout flow works (email/password and social OAuth)
- [ ] Session verification on app init and tab refocus works
- [ ] Multi-step application form navigates correctly and persists data
- [ ] Draft applications can be resumed and deleted
- [ ] Submitted applications cannot be edited
- [ ] File uploads work and are persisted in Drupal
- [ ] All tests pass
- [ ] Code follows accessibility guidelines (keyboard nav, labels, ARIA, etc.)
- [ ] No console errors or warnings in production build
- [ ] `REACT_APP_DRUPAL_BASE_URL` is injected via environment (not hardcoded)
- [ ] Stripe payment flow works (if payment module enabled)

---

## Deployment Notes

**Production build:**
```bash
# Frontend
docker build -f frontend/Dockerfile -t newschool-apply-frontend:latest ./frontend

# Backend
docker build -t newschool-apply-backend:latest ./backend

# Run via compose (adjust env for production)
docker-compose -f docker-compose.yml up
```

**Environment for production:**
- Set real Drupal admin credentials
- Set real Stripe keys
- Set `REACT_APP_DRUPAL_BASE_URL` to production domain (e.g., `https://apply.school.edu`)
- Use a real database (not SQLite) if scaling beyond local testing
- Configure CORS origins for production domain in Drupal's `services.yml`

---

## Documentation References

- `AGENTS.md` — Architectural guardrails (non-negotiable)
- `BACKEND-FEATURES.md` — Complete backend feature specification
- `FRONTEND-FEATURES.md` — Complete frontend feature specification
- `DEPLOYMENT.md` — Backup, restore, and Fly.io deployment design

Read all referenced documents in this prompt to understand the complete requirements before starting implementation.
