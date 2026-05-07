# Frontend Build Prompt — newschool-apply (`v2-frontend` branch)

> **You are Claude Opus 4.7 acting as a senior frontend engineer.** Your job is to build the entire `newschool-apply` frontend in this repo, end-to-end, against a running drx-apiserver backend. Read this entire document before writing any code, then proceed in the order under **Build Plan**.

---

## 1. Mission

Build a **Vite + plain JavaScript** single-page application in `/frontend/` that lets prospective students and families:

- Sign in (Google OAuth, Microsoft OAuth, or email + password — all via Drupal).
- Manage reusable `Person` and `Address` records.
- Start, autosave, resume, and submit a multi-page school application.
- Upload supporting documents.
- View submitted application status.

The backend is a Drupal 10 instance provided by [drx-apiserver](https://github.com/mennotech/drx-apiserver) (image: `ghcr.io/mennotech/drx-drupal-base:0.0.1-rc1`). Its data model is generated from `schema/v2/*.yaml` via [drx-schema](https://github.com/mennotech/drx-schema) `v0.1.0`. **Do not modify the backend or the schema.** If a behaviour you need is missing, stop and raise it.

---

## 2. Required reading (in order)

1. **`AGENTS.md`** — non-negotiable architectural and security rules. Every constraint applies to your output.
2. **`FRONTEND-FEATURES.md`** — the canonical feature spec. Treat it as the acceptance checklist.
3. **`schema/v2/*.yaml`** (all 11 files) — entity types, content types, field names, and form-page definitions you will render and POST/PATCH against.
4. **External references** (fetch and skim — do not copy):
   - `https://github.com/mennotech/drx-apiserver` — runtime contract (env vars, healthcheck path, JSON:API write mode).
   - `https://github.com/mennotech/drx-schema` — how `schema/v2` becomes Drupal config; useful for understanding field machine names.
5. **`README.md`** — quick start, including the host-side scaffolding step that produces `schema/sync/`.

---

## 3. Tech constraints (hard limits)

- **Stack:** Vite + plain JavaScript. **No** React, Vue, Svelte, Lit, jQuery, or any UI/component framework.
- **Styling:** Vanilla CSS in `frontend/src/index.css` and component-scoped CSS files. **No** Tailwind, Bootstrap, MUI, etc.
- **Dependencies:** zero new runtime dependencies beyond Vite itself unless explicitly approved. Dev dependencies limited to: `vite`, `vitest`, `@vitest/ui` (optional), `jsdom`, `@playwright/test`. Pin every version exactly (no `^`, `~`, `latest`). Use `package-lock.json` and `npm ci`.
- **Module system:** native ES modules. No Webpack/Rollup config customisation beyond what Vite already provides.
- **State:** plain JS module-level state. No Redux, MobX, Zustand, Pinia, signals libraries, etc.
- **Auth:** Drupal session cookie + on-demand CSRF token from `/session/token`. **Never** parse JWTs, store tokens in `localStorage`/`sessionStorage`, or implement OAuth flows in JS.
- **Browsers:** modern evergreen (last 2 versions of Chrome, Firefox, Edge, Safari). No IE11.
- **Accessibility:** WCAG 2.1 AA throughout — semantic HTML, labelled inputs, `aria-invalid` + `aria-describedby` on errors, keyboard operability, visible focus.

If a requirement here conflicts with `AGENTS.md`, `AGENTS.md` wins.

---

## 4. Architectural rules (restated)

- **Drupal decides; the frontend displays.** Show/hide UI based on backend data and HTTP status codes (e.g. 403 → not allowed). Never gate access using hardcoded role logic.
- **No business logic on the client.** UX validation only — server is authoritative.
- **No PII persisted client-side.** Memory only; clear after submission/navigation.
- **Backend base URL** comes from `import.meta.env.VITE_BACKEND_BASE_URL`. Never hardcode.
- **Mutating requests** must include a fresh `X-CSRF-Token` (fetched from `GET /session/token`) and `credentials: "include"` so the session cookie travels.

### Drupal endpoints you will use

| Purpose | Method + Path |
|---|---|
| Login (email/password) | `POST /user/login?_format=json` — body `{ name, pass }`; response includes `current_user` and `logout_token`. |
| Logout | `GET /user/logout?_format=json&token={logoutToken}` (the `logout_token`, **not** the CSRF token). |
| Session check | `GET /user/login_status?_format=json` — `1` or `0`. |
| Session bootstrap (recover user data + logout token) | `GET /api/session/info?_format=json` if available; otherwise reconstruct from JSON:API `me` endpoints. Confirm presence in the running backend before relying on it. |
| CSRF token | `GET /session/token` (fetch fresh per mutating request). |
| Entity reads/writes | JSON:API: `/jsonapi/{entity_type}/{bundle}` etc. |
| File upload | JSON:API file endpoint per Drupal docs (multipart/form-data). |

OAuth (Google/Microsoft) is initiated by **redirecting the browser** to a Drupal-managed URL — the frontend does not implement the OAuth flow. Confirm the redirect path against the running backend; do not invent it.

---

## 5. Build plan (do these in order)

### Phase A — Project scaffold

1. `frontend/package.json` (locked versions), `vite.config.js`, `index.html`, `frontend/src/main.js`, `frontend/src/index.css`.
2. `frontend/Dockerfile.dev` (Node 20-alpine, `npm ci`, `npm run dev -- --host 0.0.0.0 --port 3000`).
3. `frontend/.gitignore` for `node_modules`, `dist`, etc.
4. Vitest config (jsdom env) and Playwright config (`e2e/` directory, baseURL `http://localhost:3000`).
5. Confirm `npm run dev`, `npx vitest run`, and `npx playwright test --list` all work on an empty test suite.

### Phase B — API adapter

A single module (`frontend/src/api/client.js` or similar) wrapping fetch with:

- `get(path, opts)`, `post(path, body, opts)`, `patch(path, body, opts)`, `del(path, opts)`, `uploadFile(path, file, meta)`.
- Always sends `credentials: "include"` and `Content-Type: application/vnd.api+json` for JSON:API entity requests.
- Fetches a fresh CSRF token before any non-GET request.
- Parses JSON:API error envelopes into a readable `ApiError` with `status`, `title`, `detail`, and per-field errors when present.
- No retries on auth failures by default; calling code decides.

Plus a thin auth module (`frontend/src/auth/session.js`) exposing: `login(email, password)`, `logout()`, `checkSession()`, `bootstrapSession()`, `getCurrentUser()`, and an event/observer hook so the UI can react to auth state changes.

### Phase C — Router + auth shell

- Lightweight client-side router (custom hash-less History API based, or a tiny ~20-line own implementation). Define routes per `FRONTEND-FEATURES.md` (Routing And Access Control).
- Protected-route wrapper: checks session via `checkSession()` (and `bootstrapSession()` if no local user), redirects to `/login` otherwise.
- Top-level header/footer per spec; mobile hamburger; active-route highlighting.
- Login page (email/password form + Google/Microsoft buttons that redirect to backend OAuth).
- Registration page per spec.
- Re-validate session on `visibilitychange` when tab becomes visible.

### Phase D — Dashboard

- Fetch the authenticated user's applications via JSON:API.
- List with status badges, started date, student name, applying-for grade.
- "New Application" CTA → bundle picker (Partial Programming / Full Early Years / Full Middle Years / Full Senior Years).
- Continue (drafts) and View (submitted) actions.
- Delete-draft with confirmation dialog.
- People and Addresses reusable-record blocks below the application list.

### Phase E — Application flow (the big one)

Drive the wizard from the schema. Pages 1–6 correspond to `schema/v2/06-page-student-information.yaml` through `11-page-statement-of-commitment.yaml`. Pages 7 (Documents) and 8 (Review) are added by the frontend.

For each step:

- Render fields from saved Drupal data (or empty for a new draft).
- UX-level validation; show inline errors with `aria-invalid` and `aria-describedby`.
- Autosave on blur for changed fields (PATCH only the changed attribute).
- Display server validation errors next to the relevant field.
- Persist step-review/completion flags to Drupal so completion survives logout/login.

Specific behaviours:

- **Step 1 — Student Information:** create the related student-profile entity when starting a new application; include relationship fields (e.g. `field_physical_address`) in the initial POST so addresses are linked without a follow-up PATCH.
- **Step 2 — Health Information:** emergency contact via reusable `Person` picker (no relationship type collected by `PersonPicker`).
- **Step 3 — Parent / Guardian Information:** card-based guardian summaries with primary/secondary slots, person picker with inline create, address picker with inline create. **Inner save panel inside `PersonPicker`/`AddressPicker` is a `<div>` (not `<form>`); save buttons are `type="button"`** to avoid triggering the outer step form's submit handler.
- **Step 4 — Additional Support Declaration:** required review-confirmation checkbox even when no additional support details apply.
- **Step 5 — Parent Questionnaire.**
- **Step 6 — Commitment:** HTML canvas signature pad with clear/redraw; styled in-app modal (`role="dialog"` + `aria-modal="true"`) that lists incomplete required sections and blocks submission until all required steps are complete and a signature exists.
- **Step 7 — Documents (optional):** multipart upload to Drupal's file endpoint, ≤5 MB client-side pre-check, type filter, multi-file. Document entities linked to the application.
- **Step 8 — Review:** read-only summary + jump-to-edit links + final submit (single PATCH applies any unsynced state and marks submitted).

Stepper:
- Step 1 always reachable.
- Other steps reachable once step 1 is complete.
- Completion derived from saved Drupal data, not navigation history.

### Phase F — Reusable record management

- `/records/people` and `/records/addresses` list pages.
- Edit existing records.
- For each record, list applications referencing it.

### Phase G — Profile page

- Show username and email from session info; graceful fallback when fields missing.

### Phase H — Tests

Vitest:
- API client behaviour (GET/POST/PATCH/DELETE/upload, CSRF handling, error parsing) — mock `fetch` with `vi.stubGlobal`.
- Auth state module (login, registration, bootstrap, logout, retry-on-stale-session).
- Protected route redirect behaviour.
- Typed contact list validation (`type:value` format for emails and phones).
- Each step's validation rules.
- Stepper completion logic.
- Dashboard list + delete confirm.

Playwright:
- Log in (success + failure paths).
- Full application submission flow against a running stack.
- Draft autosave + resume after reload.
- Logout.

All tests must pass (`npx vitest run` and `npx playwright test`) before declaring the build complete.

---

## 6. Acceptance criteria

- [ ] `npm ci && npm run build` produces a clean production build with no warnings.
- [ ] `npx vitest run` passes 100%.
- [ ] `npx playwright test` passes 100% against `docker compose up -d`.
- [ ] All routes in `FRONTEND-FEATURES.md` § Routing And Access Control work.
- [ ] All eight wizard steps function end-to-end for at least the **Partial Programming** bundle; the four bundles are selectable from the dashboard's New Application flow.
- [ ] No `localStorage`/`sessionStorage` usage for PII or auth tokens (grep proves it).
- [ ] No hardcoded backend URLs (grep for `localhost:8080`, `http://`, etc.).
- [ ] No `innerHTML` with user-supplied content.
- [ ] Keyboard-only navigation works for the full happy path.
- [ ] `FRONTEND-FEATURES.md` is updated to reflect anything actually built (or any deferred items explicitly marked).

---

## 7. Out of scope

- Payments / Stripe integration (`/payment-success` page + checkout polling). Skip this phase entirely; mention it as deferred in `FRONTEND-FEATURES.md` if any related code is removed.
- Backend changes — `schema/v2/`, the drx-schema submodule, and the drx-apiserver image are off-limits.
- Deployment configuration (Fly.io, etc.).

---

## 8. Working agreement

- **Pause and ask** before:
  - Adding any dependency.
  - Deviating from the architecture or security rules in `AGENTS.md`.
  - Modifying `schema/v2/*.yaml` or anything in `schema/DrX-Schema/`.
  - Implementing logic that depends on undocumented backend behaviour.
- **Update `FRONTEND-FEATURES.md`** as you go; it must always reflect what's actually built.
- **Verify against the running backend.** When uncertain about an endpoint, request, or response shape, hit the live drx-apiserver instance rather than guess.
- **Keep commits focused.** One logical change per commit; tests pass at every commit.

When in doubt: **stop, explain the uncertainty, and ask.** Wrong implementations are worse than questions.
