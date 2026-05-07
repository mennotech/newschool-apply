# AI Coding Agent Rules and Architecture Guardrails

This repository builds the **frontend** of a decoupled web application. The Drupal backend is provided by the external [drx-apiserver](https://github.com/mennotech/drx-apiserver) project; the schema YAML in `schema/v2/` is converted to Drupal config-sync via the external [drx-schema](https://github.com/mennotech/drx-schema) module. **AI coding agents must follow ALL rules in this document.** If a task conflicts with these rules, **stop and explain the conflict** instead of attempting a workaround.

## Repository scope

```
/frontend/        ← Vite + plain JavaScript SPA (the deliverable)
/schema/v2/       ← Application schema (input to drx-schema)
/schema/DrX-Schema/ ← drx-schema submodule (do not modify)
```

- All UI work happens in `/frontend/`.
- All backend decisions live in the running Drupal instance (drx-apiserver). **Never** move business logic into the frontend.
- **Never modify the drx-schema submodule** from this repo. If the scaffold output is wrong, fix `schema/v2/` or open an issue upstream.

## Key non-negotiable principles

- **Drupal is the single source of truth.** All authentication, authorization, permissions, workflow, business rules, and data validation live in Drupal. The frontend never overrides or duplicates these decisions.
- **Frontend = UI, Backend = logic.** The frontend renders UI, collects input, and calls Drupal APIs. It must not contain business logic or make security/permission decisions.
- **No direct auth or token handling in the frontend.** Drupal manages all authentication. The frontend must never handle OAuth flows, JWTs, access/refresh tokens, or credential storage. Use Drupal's documented endpoints and rely on its session cookie.
- **No unapproved dependencies.** Default assumption is zero new dependencies. Use built-in browser APIs and existing project utilities.
- **Security and privacy first.** Never expose secrets or PII on the client. Never log personal data. Don't store sensitive info in browser storage. Comply with FERPA/COPPA.

---

## 1. Architecture: source of truth

Drupal is the authoritative source for: authentication & identity, authorization & permissions, business rules, workflow state, data validation, access control. If logic affects correctness, security, permissions, or decisions, it **must reside in Drupal**. The frontend defers to Drupal's responses and reflects them in the UI.

**Decision guide:**
- Logic that affects data integrity, permissions, or business outcomes → **Drupal**.
- Logic that is purely presentational (formatting, enabling a button after fields filled) → **frontend OK**.
- When in doubt, put it in Drupal or ask.

## 2. Frontend role and limitations

**Allowed (UI/UX only):**
- Rendering UI and updating it from backend data.
- Collecting input and performing UX-level validation (required, format) for guidance only.
- Client-side routing.
- Calling documented Drupal endpoints (JSON:API for entities; auth endpoints for session).
- Displaying server feedback to the user.

**Forbidden:**
- Business logic, workflow enforcement, authorization decisions independent of backend data.
- Authentication processes (OAuth flows, password handling beyond passing to Drupal, session token management).
- Storing tokens/credentials in localStorage, sessionStorage, or non-HttpOnly cookies.
- Security-sensitive logic; relying on client-side checks for access control.
- Maintaining an independent local source of truth for critical data.

## 3. Authentication and identity (CRITICAL)

- **Drupal is the only auth authority.** The frontend never authenticates a user with an external provider directly or issues its own tokens.
- **Supported login methods** (via Drupal): Google OAuth, Microsoft OAuth, email + password local auth.
- **Frontend may** initiate login by redirecting to a Drupal-managed OAuth URL or POSTing email/password to Drupal's login endpoint. Drupal then maintains the session via cookie.
- **For state-changing requests** (POST/PATCH/DELETE), fetch a fresh CSRF token from `GET /session/token` and send it as `X-CSRF-Token`. Do not store it long-term.
- **Session check:** call `GET /user/login_status?_format=json` (returns `1` or `0`). Do not use `/jsonapi/user/user/{id}` for session checks — it's permission-sensitive and may return 403 for valid sessions.
- **Session bootstrap:** if `login_status` returns `1` but the frontend has no local user state (e.g. user logged in via Drupal admin UI), bootstrap a lightweight user object from the active session rather than forcing re-login.
- **Logout:** `GET /user/logout?_format=json&token={logoutToken}`. The `token` is the `logout_token` from the login response — it is **not** the CSRF token. Drupal returns a misleading 403 mentioning `csrf_token` if the logout token is missing/wrong; do not interpret as a CSRF problem.
- **Logout state discipline:** only clear local auth state after a successful server-side logout. If logout fails, preserve local state so the user can retry.
- **Forbidden:** custom OAuth client libraries, JWT inspection/parsing, two-factor flows on the client, password-strength enforcement beyond UI hints.

## 4. User accounts and roles

- All end-users are local Drupal accounts; external IDPs are an auth mechanism only.
- The frontend must not hardcode role logic. Show/hide features only based on backend data (an API returning data, a flag on user info, or a 403 error).
- Always attempt actions via the API and handle success or "access denied" gracefully. Never let a frontend check be the gate.

## 5. API usage and data contracts

- Use Drupal's **JSON:API** structure (`data.attributes.*`, `data.relationships.*`) and the documented auth endpoints.
- **Do not invent fields, query parameters, or endpoints.** If the API doesn't expose what you need, raise it — don't hack around it.
- Implement error handling for all calls (4xx and 5xx). Surface backend validation messages to the user.
- **No hardcoded URLs or magic strings.** Read the backend base URL from `import.meta.env.VITE_BACKEND_BASE_URL`.
- Respect the backend contract (read-only fields, required ordering like creating a profile before an application).

## 6. Dependencies and supply-chain policy (CRITICAL)

- **Default = zero new dependencies.** Do not add NPM packages, libraries, or services without explicit maintainer approval.
- **Approval process:** pause, justify (why existing stack/Web APIs cannot do it), discuss, get written approval before adding.
- **Forbidden by default:** large UI/CSS frameworks, third-party SDKs that duplicate functionality, GitHub-direct dependencies, packages with post-install scripts.
- **Lightweight wins:** prefer one small utility over a full library when only one function is needed.

## 7. Build and installation safety

- Use `package-lock.json` and install with `npm ci`. Never `npm install` in CI.
- Lock all versions. No `^`, `~`, or `latest` ranges.
- Do not hand-edit the lockfile.
- Update dependencies only with approval and a documented reason.

## 8. Code style and structure

- **Clarity over cleverness.** Boring, explicit code is preferred.
- **Small, focused modules.** One idea per module/component.
- **No global mutable state** beyond simple module-level state. No new state management libraries without approval.
- All environment-specific values via `import.meta.env`. No hardcoded URLs or credentials.
- Match existing project style and conventions.

## 9. Forms and user input

- Client-side validation is **UX only** — it is not enforcement.
- Always submit to Drupal; let it validate authoritatively. Surface its errors near the relevant fields.
- Multi-step flows: treat steps as UI navigation. Don't encode workflow rules; respond to backend data/directives.

## 10. Security best practices

- **Escape output by default.** Never use `innerHTML` with user-supplied content. Prefer `textContent`. Sanitize explicitly when HTML rendering is truly required.
- Treat all client input as untrusted; validation/permissions are server-side.
- **No secrets in the frontend.** Frontend code is public.
- **Minimal data exposure.** Only fetch what the current screen needs.
- **No client-side security enforcement.** Hidden buttons are not access control.
- **Safe logging.** Never log PII, tokens, or sensitive values to the browser console.

## 11. Privacy and regulatory compliance

- **No PII in client logs or storage.** Names, DOBs, addresses, student IDs, grades, etc. must not be persisted in localStorage/sessionStorage/IndexedDB. The HttpOnly Drupal session cookie is the only acceptable client-side persistence.
- Keep sensitive data **ephemeral in memory** and clear it after use (after submission, after navigation away).
- Trust Drupal to enforce who can see what.
- No analytics or tracking scripts that capture user data without explicit approval.

## 12. Testing expectations

- **Stack:** Vitest for unit/integration; Playwright for end-to-end. Do not introduce alternatives.
- Vitest test files colocated with code, named `*.test.js`. Playwright tests in `e2e/`.
- Run with `npx vitest run` and `npx playwright test`. All tests must pass before a change is considered done.
- Cover critical paths: login (success + failure), session bootstrap, full application submission, draft autosave/resume, file upload, logout.
- Mock fetch (`vi.stubGlobal` or equivalent). Snapshot tests for UI regression only — never for logic.

## 13. AI agent responsibilities and limitations

**Should do:**
- Read [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md) before starting feature work to avoid duplication.
- Update [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md) immediately when a feature is added/changed/removed/renamed.
- Generate JS modules and components following project patterns.
- Write integration code against documented Drupal endpoints.
- Produce tests for new logic.

**Must NOT do:**
- Implement features without updating FRONTEND-FEATURES.md.
- Modify the `schema/DrX-Schema/` submodule.
- Change architecture (move logic to frontend, add new layers).
- Introduce new patterns, frameworks, or state management without approval.
- Add dependencies on its own.
- Touch authentication or authorization flows beyond using documented endpoints.
- Output code that conflicts with any rule here. If a request requires breaking a rule, refuse or ask for clarification.

**Defer to humans** when uncertain — flag the issue rather than assume.

## 14. When in doubt

Stop, clarify, confirm. Don't guess, don't invent backend behavior, document uncertainties as TODOs. Wrong implementations are worse than asking.

## 15. Exceptions and escalation

No unilateral exceptions. Raise the issue, get explicit approval (preferably in writing), document the exception in code comments, contain its scope, and revisit later.

## 16. File upload handling

- Upload to Drupal's documented file endpoint (typically multipart/form-data POST to JSON:API file resource or `/file/upload`).
- Treat files as opaque binary. **Do not** open, parse, or scan file contents on the client.
- Pre-checks (extension, size) are UX only; the server's decision is final.
- Surface server upload errors (too large, wrong type, virus detected, etc.) to the user.
- Do not retain file data in client state or browser storage after upload completes.

## 17. Accessibility (WCAG 2.1 AA)

- **Semantic HTML.** `<button>` for buttons, `<form>` for forms, `<label>` for inputs, proper heading hierarchy.
- Every input has an associated `<label>` (wrapping or via `for`/`id`).
- Errors use `aria-invalid="true"` and `aria-describedby` linking to the visible error message.
- All interactive elements operable via keyboard. Don't suppress focus outlines without an equivalent visible style.
- Use ARIA only to fill semantic gaps native HTML can't (`role="dialog"` + `aria-modal="true"` for modals, etc.).
- Accessibility is part of "done" — not a follow-up task.

## 18. Final summary (non-negotiable)

Drupal decides; frontend displays. No tokens, no secrets, no PII in storage, no unapproved dependencies, no architecture changes. When in doubt, stop and ask.
