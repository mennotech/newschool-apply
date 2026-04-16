# NewSchool Apply — MVP Initialization Prompt

## Context

You are building the MVP for **NewSchool Apply**, a web application that allows prospective students and families to apply to a school. The repository is a monorepo with two directories:

- `/frontend/` — Plain React application (JavaScript, npm) — runs in Docker for both dev and production
- `/backend/` — Drupal container (Dockerfile, initialization script, exported config)
- `docker-compose.yml` — root-level compose file that wires frontend + backend together

**Before writing any code, read and internalize `AGENTS.md`** — it contains non-negotiable architectural guardrails that govern every decision in this project. Do not proceed past it.

---

## Architecture Principles (summary — `AGENTS.md` is authoritative)

- **Drupal is the single source of truth.** All authentication, authorization, business logic, workflow state, and data validation live in Drupal.
- **React is UI only.** It renders screens, collects input, and calls Drupal's JSON:API or custom REST endpoints. It never duplicates backend logic.
- **No new npm packages** without explicit maintainer approval. Use built-in browser APIs and React, Redux (already included), and MSW/Jest/RTL for tests.
- **No token/session management in the frontend.** Login is handled by Drupal. Use session cookie + CSRF token (`/session/token`) for state-changing requests.

---

## MVP Scope

### Backend (`/backend/`)

Build a Drupal 10 container that:

1. **Dockerfile** — Installs Drupal 10 on PHP 8.2 + Apache, installs Composer dependencies, copies exported config, and exposes port 80.
2. **Initialization script** (`init.sh`) — Runs on first start; installs Drupal via Drush with SQLite; imports config; enables required modules; creates a default admin account via environment variables (`DRUPAL_ADMIN_USER`, `DRUPAL_ADMIN_PASS`).
3. **Drupal modules to enable:**
   - `jsonapi` — exposes all content entities as JSON:API endpoints
   - `jsonapi_extras` — field-level control over what is exposed
   - `simple_oauth` *(or)* Drupal's built-in session auth — use session-based auth for the MVP (no JWT complexity)
   - `social_auth_google` and `social_auth_microsoft` — OAuth via Drupal (frontend only redirects to Drupal-managed URLs)
   - `restui` *(optional)* — REST API UI for debugging
   - `cors` configuration — allow requests from `http://localhost:3000`
4. **Content types / entities to scaffold:**
   - `student_profile` — fields: `first_name`, `last_name`, `date_of_birth`, `grade_applying_for`
   - `application` — fields: `status` (pending/submitted/accepted/rejected), `student_profile` (entity reference), `submitted_at`
   - `document` — fields: `file`, `document_type`, `application` (entity reference)
5. **Roles:**
   - `parent` — can create/edit own student profiles and applications
   - `applicant_reviewer` — read-only access to all applications
   - `administrator` — full access
6. **Exported config** lives in `/backend/config/sync/`. Commit the config export so the init script can import it.
7. **CORS** — configure `services.yml` to allow `http://localhost:3000` for all JSON:API routes.

---

### Frontend (`/frontend/`)

Bootstrap a Plain React app (using `create-react-app`) with the following structure and features.

#### Docker Setup

The frontend runs in Docker for both development and production. Provide two Dockerfiles:

**`/frontend/Dockerfile.dev`** — Development image:
- Base: `node:20-alpine`
- Sets `CHOKIDAR_USEPOLLING=true` and `WATCHPACK_POLLING=true` so hot-reload works through Docker volume mounts on Windows/macOS.
- Runs `npm ci` then `npm start` (CRA dev server on port 3000).
- The source directory is mounted as a volume so live edits are reflected immediately.

**`/frontend/Dockerfile`** — Production image:
- Multi-stage: stage 1 builds with `node:20-alpine`, stage 2 serves the `build/` output with `nginx:alpine`.
- `nginx.conf` must proxy `/` to the static files and handle client-side routing (fallback to `index.html`).

**Root `docker-compose.yml`** (at repo root, not inside `/backend/`):
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8080:80"
    volumes:
      - drupal_db:/var/www/html/sites/default/files
    environment:
      - DRUPAL_ADMIN_USER
      - DRUPAL_ADMIN_PASS
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules   # anonymous volume prevents host node_modules from overwriting container's
    environment:
      - REACT_APP_DRUPAL_BASE_URL=http://localhost:8080
    depends_on:
      - backend
volumes:
  drupal_db:
```

> **Note on Windows file-watching:** The `CHOKIDAR_USEPOLLING=true` env var in `Dockerfile.dev` is required for CRA hot-reload to work inside Docker on Windows (WSL2 or Hyper-V). It is already set in the Dockerfile; do not rely on the host environment to set it.

#### Environment

- `.env.example` with `REACT_APP_DRUPAL_BASE_URL=http://localhost:8080`
- `.env` is gitignored. Never hardcode the base URL.
- When running via Docker Compose, `REACT_APP_DRUPAL_BASE_URL` is injected via the compose `environment` block — no `.env` file is required inside the container.

#### State Management

- Use **Redux Toolkit** (already permitted). Store: `auth` slice and `application` slice.
- `auth` slice: `{ user: null | { uid, name, email, roles }, csrfToken: null, status: 'idle'|'loading'|'error' }`
- `application` slice: `{ currentApplication: null, steps: [], status: 'idle'|'loading'|'error' }`

#### Routing

Use `react-router-dom` (already in project). Routes:

| Path | Component | Notes |
|---|---|---|
| `/` | `HomePage` | Landing page with login options |
| `/login` | `LoginPage` | Email/password form + Google/MS links |
| `/dashboard` | `DashboardPage` | Protected — shows application status |
| `/apply` | `ApplicationPage` | Protected — multi-step form |
| `/apply/:step` | `ApplicationStep` | Each step rendered here |
| `/profile` | `ProfilePage` | Protected — family/student profile |

#### Authentication Flow

1. `LoginPage` renders:
   - Email + Password form → `POST /user/login` (Drupal's built-in endpoint, JSON body `{ name, pass }`)
   - "Login with Google" link → redirect to `{DRUPAL_BASE_URL}/social-auth/google` (Drupal handles OAuth)
   - "Login with Microsoft" link → redirect to `{DRUPAL_BASE_URL}/social-auth/microsoft`
2. On successful login, fetch current user from `/jsonapi/` or `/user/me` and store in Redux `auth` slice.
3. For all state-changing requests (POST/PATCH/DELETE), fetch CSRF token from `{DRUPAL_BASE_URL}/session/token` and send as `X-CSRF-Token` header.
4. `ProtectedRoute` component — redirects to `/login` if `auth.user` is null.

#### Multi-Step Application Form

Steps (driven by what the API allows — these are the MVP steps):

1. **Student Info** — First name, last name, date of birth, grade applying for
2. **Documents** — Upload transcript (PDF, max 5 MB — pre-check only; server validates authoritatively)
3. **Review & Submit** — Read-only summary; "Submit Application" button calls `PATCH /jsonapi/node/application/{id}` to set status to `submitted`

Component hierarchy:
```
ApplicationPage
  ApplicationProgress (step indicator)
  ApplicationStep
    StudentInfoStep
    DocumentsStep
    ReviewStep
```

#### Accessibility

- Every form input has an associated `<label>`.
- Errors use `aria-describedby` linking to the error message element.
- All interactive elements are keyboard-navigable.
- No `dangerouslySetInnerHTML`.

#### API Utility

Create `frontend/src/api/drupalClient.js`:
- `get(path)` — fetch with credentials: 'include'
- `post(path, body)` — fetch CSRF token, then POST JSON
- `patch(path, body)` — fetch CSRF token, then PATCH JSON
- `uploadFile(path, file)` — fetch CSRF token, then POST multipart/form-data
- All functions read base URL from `process.env.REACT_APP_DRUPAL_BASE_URL`
- All functions throw structured errors from Drupal's JSON:API error format

---

## Tests

### Frontend Tests (Jest + React Testing Library + MSW)

**Location:** colocated `*.test.js` files alongside each component/module.

**MSW setup:** `frontend/src/mocks/` with `handlers.js` and `server.js`.

Tests to write:

| File | What to test |
|---|---|
| `drupalClient.test.js` | `get`, `post`, `patch` attach correct headers; CSRF token is fetched before mutating calls; base URL is read from env |
| `LoginPage.test.js` | Renders email/password form; shows Google and Microsoft links; on successful POST shows dashboard redirect; on 403 shows error message |
| `ProtectedRoute.test.js` | Redirects unauthenticated user to `/login`; renders children when authenticated |
| `StudentInfoStep.test.js` | Required fields show validation error when empty; valid submission calls `post` with correct payload |
| `DocumentsStep.test.js` | Rejects files over 5 MB with user-visible error before upload; calls `uploadFile` for valid files; shows server error message on failure |
| `ReviewStep.test.js` | Displays summary of entered data; "Submit" button calls `patch`; shows success state after submission |
| `ApplicationProgress.test.js` | Renders correct step indicators; marks completed steps |

Run all tests: `cd frontend && npm test -- --watchAll=false`

---

## Deliverables Checklist

- [ ] `/backend/Dockerfile` — builds Drupal 10 image
- [ ] `/backend/init.sh` — idempotent init script (install + import config + seed)
- [ ] `/backend/config/sync/` — exported Drupal config (content types, roles, CORS, modules)
- [ ] `/frontend/Dockerfile.dev` — dev image with polling hot-reload
- [ ] `/frontend/Dockerfile` — production multi-stage nginx image
- [ ] `/frontend/nginx.conf` — nginx config with SPA fallback to `index.html`
- [ ] `docker-compose.yml` — root-level compose wiring frontend (3000) + backend (8080)
- [ ] `/frontend/` — bootstrapped CRA app with all routes, components, Redux slices
- [ ] `/frontend/src/api/drupalClient.js` — API utility
- [ ] `/frontend/src/mocks/` — MSW handlers covering all API interactions used in tests
- [ ] All tests passing: `docker compose run --rm frontend npm test -- --watchAll=false`
- [ ] `/frontend/.env.example` committed; `.env` gitignored
- [ ] `README.md` updated with Docker-first setup instructions

---

## Constraints Reminder

- Do **not** add new npm packages. Use what is already available.
- Do **not** implement auth logic (OAuth exchanges, token parsing) in the frontend.
- Do **not** hardcode URLs, credentials, or environment-specific values.
- Do **not** store sensitive data in localStorage, sessionStorage, or global state longer than needed.
- Do **not** use `dangerouslySetInnerHTML`.
- All business logic and permission checks belong in Drupal. The frontend displays; it does not decide.
- When uncertain, **stop and ask** rather than guess or invent backend behavior.
