# AI Coding Agent Rules and Architecture Guardrails

This repository uses AI-assisted development under strict architectural, security, and supply-chain constraints. **AI coding agents must follow ALL rules in this document.** If a task or request conflicts with these rules, **stop and explain the conflict** instead of attempting a workaround.

## Repository Structure

```
/frontend/    ← Plain React application (JavaScript, npm)
/backend/     ← Drupal container (Dockerfile, initialization script, config exports)
```

- Work in `/frontend/` for all React UI changes.
- Work in `/backend/` for all Drupal configuration, initialization scripts, and the Dockerfile.
- In the backend container, Drush is available at `/var/www/html/vendor/bin/drush` and is not on `PATH` by default.
- **Never move business logic from `/backend/` to `/frontend/`.** If a feature requires new logic, implement it in Drupal first.
- The backend defaults to **SQLite** for lightweight local development and testing. Do not change the database engine without maintainer approval.

## **Key Non-Negotiable Principles**  
- **Drupal is the Single Source of Truth** – All critical logic (authentication, authorization, permissions, workflow, business rules, data validation) lives in **Drupal (backend)**. The **React frontend** never overrides or duplicates these decisions.  
- **Frontend = UI, Backend = Logic** – The React app **renders UI, collects user input, and calls Drupal APIs**. It should **not contain business logic** or make security/permission decisions. If it affects data correctness or access control, it belongs in Drupal, not in React.  
- **No Direct Auth or Token Handling in Frontend** – **Drupal manages all authentication**. The frontend must never handle OAuth flows, tokens (JWTs, access/refresh tokens), or credentials storage. Use Drupal’s provided endpoints for login and rely on Drupal’s session cookie.  
- **No Unapproved Dependencies** – Do not add or update third-party libraries unless explicitly approved by maintainers. Use built-in browser APIs and existing project utilities. This ensures supply-chain security and keeps the bundle lean.  
- **Security and Privacy First** – Never expose secrets or sensitive data on the client. Never log personal data (PII) to console. Don’t store sensitive info in local storage, etc. Follow all privacy regulations (e.g. FERPA, COPPA) and handle user data with care.  

---

## 1. **Architecture: System Authority and Source of Truth**  
**Drupal (backend)** is the authoritative source for all application logic and state. Key areas where Drupal is the sole authority:  
- Authentication & identity verification  
- Authorization & permissions checks  
- Business rules and eligibility decisions  
- Workflow state (which step of the process the user is in)  
- Data validation and sanitization  
- Access control to content or actions  

If any logic **affects correctness, security, permissions, or decision-making**, it **must reside in Drupal**, not in the React frontend. The frontend should defer to Drupal’s responses for anything beyond basic UI interaction. The **frontend never assumes or enforces critical conditions** on its own.

**Decision Guide – Frontend or Backend?**  
- **If** a piece of logic **impacts data integrity, user permissions, or business outcomes**, **implement it in Drupal**. (The frontend should call an API or wait for Drupal to decide and then merely reflect that decision in the UI.)  
- **If** the logic is **purely presentational or user convenience** (for example, formatting a timestamp or enabling a button when form fields are filled), it **can be in React**.  
- **When in doubt, put logic in Drupal or seek clarification.** It’s safer to have Drupal decide and instruct the frontend than the opposite.  

*Example*: Suppose the application needs to verify if a user meets an age requirement. **Compliant**: The frontend sends the user's birth date to a Drupal API endpoint and relies on the response (e.g., an `"eligible": true/false` flag) to decide the next step. **Non-compliant**: The frontend calculates the age itself and blocks or allows progress based on that, which bypasses Drupal’s authority and could be tampered with by the user.

## 2. **Frontend Role & Limitations (Plain React)**  
The frontend is a plain React application, used **only** for user interface and interaction. It is **not** a source of truth for business logic. 

**Allowed frontend responsibilities:** *(UI/UX only)*  
- Rendering the UI (components, layouts, styling) and updating it based on application state/data from Drupal.  
- Collecting user input through forms and controls.  
- Performing immediate **UX validation** on inputs (e.g. required field checks, correct data format) to guide the user.  
- Routing and client-side navigation for a smooth user experience (while respecting whatever the backend allows the user to access).  
- Calling **documented Drupal API endpoints** to submit data or retrieve information.  
- Displaying feedback from the server (success messages, error messages, validation errors, etc.) to the user.  

**Forbidden frontend responsibilities:**  
- **Business logic or workflow enforcement** – e.g. determining eligibility, computing fees, deciding what step comes next in a process. The frontend must not contain rules that decide or gate the core application flow.  
- **Authorization or permission decisions** – e.g. showing/hiding features based on the user’s role or status **without backend data**. (The frontend should rely on Drupal’s response or provided user data to adjust UI, not hardcode role logic.)  
- **Authentication processes** – The frontend must not initiate OAuth flows, handle user passwords except to pass to Drupal, or manage session tokens. (All login logic is delegated to Drupal; see section 3.)  
- **Token or credential storage** – Never store passwords, JWTs, API keys, or session tokens in localStorage, sessionStorage, cookies (except HttpOnly session cookie), or any client-side storage.  
- **Security-sensitive logic** – e.g. never rely on client-side code to enforce access control or protect sensitive data. Anything security-related must be double-checked on the server.  
- **Modifying backend state locally** – The frontend should not try to keep its own source of truth about critical data. Always fetch or await confirmation from Drupal for state changes.

If unsure whether something belongs in the frontend, assume it **does not** if it could affect data or rules; let the backend handle it.

## 3. **Authentication and Identity (CRITICAL)**  
All authentication and identity verification are handled by **Drupal** – this is a hard rule for security and consistency.

- **Drupal as Auth Authority**: The frontend should treat Drupal as the only service that can log users in or out. Under no circumstances will the React app directly authenticate a user with an external provider (Google, Microsoft, etc.) or issue its own tokens.  
- **Supported Login Methods** (via Drupal):  
  - Google OAuth (handled by Drupal’s OAuth module/configuration)  
  - Microsoft consumer account OAuth  
  - Email + Password (Drupal’s local auth as a fallback)  
  In all cases, Drupal manages the outcome and issues a session (typically via a session cookie once logged in). External providers are used **only through Drupal’s integration**.  
- **Frontend Login Actions**: The React app may **initiate** login by redirecting the browser to a Drupal-managed OAuth URL (for Google/Microsoft login), or by collecting email/password and making a POST request to Drupal’s login endpoint. After that, Drupal takes over (redirects or responds with success/failure).  
  - After a successful login, Drupal will maintain the session via a cookie. The frontend should simply treat the user as logged-in based on Drupal’s session (e.g., by checking an API endpoint or response).  
  - For any state-changing API calls (POST, PATCH, DELETE), the frontend must first fetch a CSRF token from Drupal’s `/session/token` endpoint and include it as an `X-CSRF-Token` header. **Do not store the CSRF token long-term**; fetch it fresh when needed so it stays in sync with the session.  
- **Forbidden Frontend Auth Behavior**:  
  - *No custom OAuth flows or identity libraries*: Do not add OAuth/OIDC client libraries (e.g., Auth0, AWS Cognito, etc.) to the frontend. The app should never directly handle OAuth exchanges – that’s Drupal’s job.  
  - *No token management*: The frontend must not generate, inspect, or store JWTs or any access/refresh tokens. For example, do not parse a token to get user info; instead, ask the backend for user info.  
  - *No auth logic duplication*: Do not implement things like password strength checks beyond basic UI hints, two-factor auth flows, etc., in the frontend without direction – Drupal will handle required auth workflows.  
- **Post-Authentication**: A successful authentication in Drupal only verifies identity. **Authorization** (what the user can do or see) is still entirely enforced by Drupal based on roles/permissions. The frontend should adjust its UI based on data from Drupal (e.g., whether a certain API returns data or a 403 Forbidden) rather than its own logic.- **Session Verification**: To check whether a Drupal session is still active, call `GET /user/login_status?_format=json`. This returns `1` (authenticated) or `0` and is safe for all users regardless of role. Do **not** use a JSON:API user entity query (e.g. `/jsonapi/user/user/{id}`) for session checking — those are permission-sensitive and may return 403 for perfectly valid sessions, causing false session expiry.
- **Backend-Session Bootstrap**: If `login_status` returns `1` but the frontend has no local auth state (e.g. the user authenticated via the Drupal admin UI in the same browser), the frontend should bootstrap a lightweight user object from the active session rather than forcing a redundant re-login.
- **Logout Token (not CSRF token)**: Drupal's logout endpoint is `GET /user/logout?_format=json&token={logoutToken}`. The `token` query parameter is the `logout_token` value returned in the login response body — it is **not** the CSRF token from `/session/token`. Drupal returns a misleading 403 with the message "csrf_token URL query argument is missing" when the logout token is absent or wrong; do not interpret this as a CSRF problem.
- **Logout State Discipline**: Only clear frontend auth state (user, token) after receiving a **successful** server-side logout response. If the server logout fails (network error, bad token, etc.), preserve local state so the user remains logged in and can retry. Do not optimistically clear state before the server confirms.
*Example*: For Google login, **Compliant**: redirect the user to Drupal’s Google OAuth login page (Drupal handles the OAuth handshake and sets its session cookie upon success). **Non-compliant**: use a JavaScript OAuth client (or Google’s JS API) in the frontend to obtain Google tokens and then manually call backend endpoints with those tokens – this circumvents Drupal’s controlled auth process and is not allowed.

## 4. **User Accounts and Roles**  
All end-users of the application are represented as **local Drupal user accounts** with assigned roles and permissions determined by Drupal. The frontend must not hardcode or assume anything about user roles; it should always defer to Drupal for user information.

- **Single Source of User Data**: Even if a user logs in via Google or Microsoft, Drupal creates/uses a corresponding local user account internally. External identity providers are only an authentication mechanism; all user profiles and roles live in Drupal.  
- **Initial Roles and Onboarding**: On a user’s first login, Drupal may assign a temporary or limited role (for example, `parent_pending`) and require some post-login steps (like accepting terms, completing profile info, linking to a student). These flows are enforced by Drupal’s business logic. The frontend should not assume a new user’s role or skip required steps; it should follow the API/data from Drupal (e.g., if an “accept terms” flag is not completed, Drupal might direct them to that step).  
- **Never Assume Permissions on Frontend**: The React app must never grant or restrict access based on a hardcoded notion of a user’s role or status. For example, do not code “if user.role == 'admin' then show admin panel” using frontend knowledge alone. Instead, the backend will provide data (like an API endpoint listing admin items, or a field in the user data) that the frontend can use. If the backend says the user has no access to something, the frontend must respect that (e.g., by not displaying it or by handling a refused request gracefully).  
- **Always Confirm on Backend**: For any action, especially those that modify data or access protected resources, the frontend should attempt the action via the API and handle a success or an "access denied" error accordingly. Never purely rely on a frontend check to allow or disallow an action.

## 5. **API Usage and Data Contracts**  
All data exchanged between frontend and backend should use Drupal’s JSON:API (or other documented endpoints) and adhere strictly to the defined contracts.

- **Follow JSON:API Conventions**: Use the endpoints and data format provided by Drupal’s JSON:API. This typically means requests and responses have a structure like `data.attributes.*` for fields and `data.relationships.*` for linked entities. Always format requests as documented (correct HTTP methods, headers, and JSON structure).  
- **Do Not Invent Fields or Endpoints**: **Never guess** or introduce new API fields, query parameters, or endpoints that aren’t in Drupal’s documentation or responses. For example, don’t assume adding a field to a POST will do something unless it’s documented. If a needed piece of data or functionality is not provided by the API, that means either the frontend shouldn’t have it or you need to ask for a backend change – do not hack around it on your own.  
- **Error Handling**: Assume API calls can fail or be rejected. Always implement error handling for fetches/XHR: e.g., handle 4xx responses (validation errors, forbidden, not found) and 5xx responses (server errors). Provide the user with clear feedback based on error messages returned by Drupal.  
- **No Hardcoded URLs or Magic Strings**: The base URL for Drupal’s API, as well as any other environment-specific config, must come from configuration (environment variables like `REACT_APP_DRUPAL_BASE_URL`). Never hardcode the production URL or endpoint paths in the code. This ensures the app can be easily pointed to different environments (dev, staging, prod) and avoids mistakes.  
- **Respect the Backend Contract**: If Drupal says a field is read-only or a certain sequence is required (e.g., you must create a student profile before an application), the frontend should follow that flow. Don’t try to manipulate or shortcut the process.  
- **Surface Backend Errors to Users**: When Drupal returns validation errors or other issues (usually in a structured error response), display those to the user in context. For instance, if the API says an email is already taken, show that message on the form. The frontend should not suppress or replace valid server error messages except to rephrase technical jargon when needed.

## 6. **Dependencies and Supply-Chain Policy (CRITICAL)**  
This project **minimizes external dependencies** to reduce bloat and security risk. Adding new libraries can introduce vulnerabilities and complexity, so the threshold for inclusion is very high.

- **No Unapproved Dependencies**: Do **not** add any new NPM packages, libraries, or services unless you have explicit permission. Before you consider a new dependency, first check if the functionality can be achieved with the existing stack or reasonable custom code. The default assumption is **zero new dependencies**.  
- **Approval Process for Exceptions**: If you strongly believe a new dependency is necessary:  
  1. **Pause and Justify** – Do not immediately add it. Prepare a rationale for why this functionality can’t be achieved with existing code or standard Web APIs.  
  2. **Discuss with Maintainers** – Present the case (e.g., via an issue or PR comment) for adding the dependency. Include considerations like size, security, maintenance, and why it's needed.  
  3. **Get Explicit Approval** – Only add the dependency if project maintainers review and approve it. If not approved, find an alternative solution that complies with current rules.  
- **Forbidden by Default**: Certain types of packages are almost always disallowed unless an exception is granted, for example: large UI component frameworks (CSS or JS frameworks not already in use), third-party SDKs that duplicate existing functionality, GitHub repos as dependencies (i.e., non-NPM official packages), or any package that runs a post-install script which could be risky. Treat these as off-limits unless told otherwise.  
- **Keep It Lightweight**: Even for allowed dependencies, be mindful of adding bulk. E.g., prefer a small utility over an entire utility library if only one function is needed. Every dependency must earn its place by significant benefit.

*Example*: If you need advanced date formatting, **Compliant**: use built-in JS `Date` methods or an existing lightweight utility in the project to format the date. **Non-compliant**: add a large library like Moment.js (which is heavy and now deprecated) without approval, just for date formatting – this would needlessly bloat the app and violate the dependency policy.

## 7. **Build and Installation Safety**  
To ensure reproducible builds and a secure supply chain, the project has strict rules for dependency installation and version control:

- **Deterministic Installs**: All installations must be identical across environments. Always use the lockfile (`package-lock.json`) for installing dependencies. In CI and deployment, use commands like `npm ci` that respect the lockfile exactly. This guarantees everyone is running the same versions.  
- **No Floating Versions**: Do not use loose version ranges (like `^1.2.0` or `~1.2` or `latest`) in `package.json` that could lead to different versions being installed at different times. Every dependency version should be locked. Never suggest to "upgrade to the latest version" without a specific reason (like a known fix) and approval.  
- **Lockfile Management**: Do not manually edit the lockfile. When adding/updating (with approval), let the package manager update it. Never commit changes to dependencies or the lockfile that haven’t been reviewed.  
- **Consistent CI**: The Continuous Integration environment should use the exact versions in the lockfile. Do not run a plain `npm install` in CI; it might bypass the lockfile. Stick to `npm ci` or equivalent.  
- **Updating Dependencies**: If a dependency update is required (for example, a security patch for a library), treat it similarly to adding a new one: get approval. Document why the update is needed and ensure it’s tested. Do not spontaneously update dependencies just to get newer versions – stability is more important than having the latest features.  

## 8. **Code Style and Structure**  
Code should be written in a clean, maintainable style that aligns with project conventions. Favor simplicity and clarity over brevity or cleverness.

- **Clarity Over Cleverness**: Prioritize readability. Future maintainers (or AI agents) should easily understand the code. Avoid overly complex or “magical” implementations when a straightforward approach works.  
- **Explicit is Better**: Be explicit in code and data flow. For example, prefer clear variable names and simple functions over deeply nested abstractions. Avoid hidden side effects; functions should do what they say.  
- **Small, Focused Components**: In React, create small, composable components. Each component should ideally manage one idea or UI section. This makes them easier to reuse and test. If a component is getting large or handling many concerns, consider breaking it down.  
- **Avoid Global Mutable State**: Don't introduce new global variables or singletons for sharing state. Use React state/props, context, or **Redux** (the project's standard state management library) in a controlled way. Global state makes the app hard to predict. Do not introduce alternative state management libraries without maintainer approval.
- **Environment Config**: All environment-specific values (API endpoints, keys, feature flags) must come from **environment variables** (e.g., `REACT_APP_*` variables). Never hardcode environment-specific URLs or credentials in the code. This ensures the app can be configured for different deployments without code changes.  
- **“Boring” Code is Good**: Use common patterns and simple constructs. It’s better that the code be a bit longer if it’s obvious, rather than a terse one-liner that’s hard to decipher. Aim for consistency with the project’s existing style.  

*Example*: **Non-compliant**: Creating a complex inheritance hierachy or using overly abstract patterns for a form component, making it difficult to follow. **Compliant**: Writing a straightforward functional component for the form, perhaps broken into logical subcomponents, with clear state and props, even if it involves a bit of repetition.

## 9. **Forms and User Input Handling**  
User input flows (like application forms, profile edits, etc.) need special care to balance good UX with strict backend validation. The frontend should never assume final authority on input correctness.

- **Client-Side Validation = UX Only**: Implement client-side checks to help users (e.g., format of an email, required fields not empty, simple date validations) so they can correct mistakes early. However, **these checks are not security or business enforcement**. They are there for convenience and may be bypassed (intentionally or unintentionally), so **do not rely on them for correctness**.  
- **Server-Side Validation is Final**: Always submit data to Drupal regardless of client-side validation outcome (unless the field is empty or obviously wrong format). Drupal will **authoritatively validate** all inputs and enforce business rules. The frontend must handle and display Drupal’s validation errors. For example, if an underage student tries to apply, the server might return an error – the frontend should show that message even if the client-side let the date through.  
- **Display Server Errors**: If Drupal returns an error for a form submission (validation error, missing info, etc.), surface that message to the user near the relevant form field or in a general error area. Don’t hide or generalize the error (unless it’s a raw technical stack trace – but Drupal’s JSON:API usually gives user-friendly errors).  
- **Multi-Step Forms**: For multi-step application processes or wizards, treat the sequence of steps as **UI navigation** only. Do not enforce progression rules in the frontend. E.g., don’t prevent the user from clicking “Next” based on some internal condition like role; instead, if the user isn’t allowed to proceed, the backend (or API response) will indicate that and the UI should respond accordingly. The frontend can manage UI state (like which section is visible) but the criteria for completion come from Drupal.  
- **No Workflow Logic in Frontend**: Do not encode business workflows in the front. For example, “if user selects option X, skip step Y” might be something the backend workflow determines (or provides via an API flag). The frontend can show/hide or skip steps, but only based on data or directives from Drupal.  

## 10. **Security Best Practices**  
Because this application handles personal data (including minors’ data), robust security practices are mandatory at all times. Many are implied above, but here are explicit rules:

- **Escape Output by Default**: Always assume any data displayed could contain malicious content. Use React’s default escaping (e.g., avoid using `dangerouslySetInnerHTML` unless absolutely necessary and safe). Any dynamic content inserted into the DOM should be properly sanitized to prevent XSS (cross-site scripting).  
- **Never Trust Client Input**: Treat all data coming from the client (including form fields, query params, etc.) as potential malicious. Validation and permission checks must happen on the server. The frontend’s role is not to decide what’s safe, but *to send the data and show the results*.  
- **No Secrets or Keys in Frontend**: Never embed secret keys, API credentials, or sensitive tokens in the JavaScript code. The frontend code can be viewed by end users, so keep all secrets on the server side. For third-party services, use them through the backend if they require secret keys.  
- **Minimal Data Exposure**: Only request and expose in the UI the data that is needed for the current functionality. Do not fetch extra sensitive information “just in case”. The backend will ensure users only get what they are allowed to see; the frontend should not try to circumvent or cache beyond necessity.  
- **No Client-Side Security Enforcement**: Do not assume hiding an element or disabling a button on the client makes an action secure. A malicious user can bypass front UI. Security must be enforced on the backend (which we already do). The frontend’s job is to maybe not present options the user likely can’t do (for UX), but it should still handle the scenario of a forbidden action gracefully if somehow attempted.  
- **Safe Logging**: Avoid logging sensitive data to the browser console. Logging is useful for debugging, but be mindful: never log personal details, auth tokens, or any data that regulations would consider private. In production, such logs might be exposed or collected; even in development, they could leak if someone’s debugging tools are exposed. Strip out or mask PII if logs are absolutely needed.

*Example*: **Non-compliant**: `console.log("User Data:", userProfile);` – This might output sensitive info (name, email, etc.) into the console, which is not secure. A **compliant** approach is to log generic events or IDs if needed (e.g., `console.log("Profile loaded")`) and avoid printing actual personal data.

- **No Hardcoded Credentials**: It should go without saying, but do not hardcode usernames, passwords, API tokens, or any credential in the frontend (or in the codebase at all). If you find yourself needing a credential client-side, you are likely doing something against the architecture (that functionality should be moved server-side).  

## 11. **Privacy and Regulatory Compliance**  
Handling student and family data means we must comply with privacy laws like **FERPA** (for educational records) and possibly **COPPA** (for children’s online privacy) in addition to general data protection principles. The frontend must be designed to protect user privacy:

- **No PII in Client Logs or Storage**: Never expose personally identifiable information (PII) in client-side logs, and **never store sensitive PII in the browser**. This includes names, dates of birth, addresses, student IDs, grades, etc. The browser environment (localStorage, sessionStorage, IndexedDB, cookies) is not a secure storage for such data. The only exception is the session cookie managed by Drupal (HttpOnly, not accessible via JS).  
- **Ephemeral Data in Frontend**: Keep sensitive data only in memory/state as needed for the immediate UI, and purge it after use. For example, once a user has submitted a form and you have a success response, clear that form data from any client state. Don’t retain it. If the user navigates away, make sure no sensitive info sticks around in, say, a Redux store or in-memory cache.  
- **Clear Sensitive State on Navigation**: Implement cleanup on unmount or navigation for pages that handle sensitive info. For instance, if a user is viewing a student’s profile and then navigates away, ensure any state holding that profile data is disposed. This prevents data lingering if the device is left unattended or someone presses the Back button.  
- **Backend-Driven Access**: Trust Drupal to enforce who can see what. The frontend should not independently decide to hide or show data based on its interpretation of user roles (which might be incomplete or spoofable). Instead, always fetch data from Drupal; if nothing comes or an error is returned, handle that (e.g., show “You do not have access”). This prevents mistakes where frontends might accidentally expose data thinking a user can see it.  
- **No Unapproved Third-Party Tracking**: Do not include analytics or tracking scripts that capture user data without explicit approval. If analytics are used, they must not record form details or any PII, especially for underage users. We must be very cautious about any third-party scripts in order to remain compliant with privacy policies and disclose properly to users.  

*Example*: After a user submits an application form, **compliant** behavior is to remove or reset that form data in the React state (and certainly not store it in localStorage). **Non-compliant** would be keeping a copy of the submitted data in a global variable or localStorage “for convenience”, which risks exposure if someone else uses the machine or if a cross-site scripting attack occurs.

## 12. **Testing Expectations**  
To maintain quality, any significant logic should be accompanied by tests. Testing ensures that the guardrails and behaviors described here remain intact over time.

- **Write Tests for New Logic**: When you add or update functionality (especially anything involving decisions, calculations, or conditional rendering), also create appropriate tests (unit tests, integration tests, or end-to-end tests as relevant). If it’s purely presentational and static, tests are less critical, but for anything dynamic or computational, include tests.  
- **Keep Tests Simple and Deterministic**: Tests should be easy to read and trust. Avoid overly clever test implementations – they should be as straightforward as possible. Each test should reliably pass or fail the same way every time (no flakiness).  
- **Enforced Testing Stack**: The project uses **Jest** as the test runner, **React Testing Library (RTL)** for component tests, and **Mock Service Worker (MSW)** for mocking API calls. These are the only testing libraries permitted. Do not introduce alternatives without maintainer approval.  
- **Test File Conventions**: Test files must be colocated with the code they test and named `*.test.js` (or `*.test.jsx`). Do not place tests in a separate top-level `__tests__` folder unless the file under test is a utility with no natural component home.  
- **Running Tests**: Run the full test suite with `npm test -- --watchAll=false`. All tests must pass before a change is considered complete. AI agents must not mark a task done if tests are failing.  
- **Cover Critical Paths**: Ensure that critical user flows have test coverage. For example, there should be tests covering a successful login, a failed login (unauthorized), a full application submission flow, etc. This helps catch any violation of the rules (like a front-end trying to do something the back-end should) early in development.  
- **No Snapshot Tests for Logic**: Snapshot tests are for UI regression only. Do not rely on snapshots to test complex logic outcomes — write explicit assertions for those.

## 13. **AI Agent Responsibilities and Limitations**  
AI coding agents are used to assist with development. They **must adhere to these same rules** and some additional constraints:

- **What AI Agents Should Do**:
  - **Consult Feature Documentation**: Before starting any feature work, review [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md) and [BACKEND-FEATURES.md](BACKEND-FEATURES.md) to understand what features already exist and avoid duplication.  
  - **Update Feature Documentation**: Whenever a feature is added, removed, modified, or renamed, the AI agent **must update the corresponding features document** (frontend or backend). Feature documentation should always reflect the actual implemented state. Update immediately after implementing the feature, not as an afterthought.  
  - Generate or update **React components** following the project's patterns (without altering architecture).
  - Write **integration code** to connect the frontend with Drupal’s APIs (e.g., fetching data, submitting forms, handling responses), consistent with API specs.  
  - Create **UI flows** as specified by requirements, ensuring they align with backend-driven logic (for example, implement the screens and navigation for a multi-step form, but not the decision on skipping a step unless told via API).  
  - Produce **tests** for new logic, when applicable, as part of the deliverable (see Testing Expectations above).  

- **What AI Agents Must NOT Do**:  
  - **Forget Documentation**: Do not implement features without updating the corresponding [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md) or [BACKEND-FEATURES.md](BACKEND-FEATURES.md) file. Feature documentation is critical for maintainability and must be kept in sync with the code. A feature is not "done" until its documentation is updated.  
  - **Change the Architecture**: Do not propose moving logic to the frontend or introducing new layers that conflict with the established Drupal backend + React frontend division.  
  - **Introduce New Patterns or Tech**: Don’t spontaneously add state management libraries, new frameworks, or radically different coding patterns that haven’t been used in the project. Follow the existing style and approaches unless the maintainers request a change.  
  - **Add Dependencies**: As per the dependency policy, the AI should not decide to pull in a new library (for instance, for date handling, form management, etc.) on its own. Use the tools already available in the project or vanilla JS/React capabilities.  
  - **Touch Authentication or Authorization flows**: Do not modify how login, logout, or permission checks work. These are sensitive and fully handled by Drupal. The AI should not suggest changes to session handling, token management, etc., except for using them as documented.  
  - **Violate Guardrails**: In general, the AI agent should never output code or suggestions that conflict with any rule in this document. If a user’s request to the AI appears to require breaking a rule (e.g., “let’s add Firebase authentication” or “use this fancy UI toolkit”), the AI must refuse or ask for clarification rather than proceed.

*Example*: **Non-compliant**: The AI suggests using a new state management library like MobX because it might simplify some state logic – this is introducing a new pattern/dependency without approval. The **compliant** approach is to use React's context or the Redux store (the project's established choice), or to ask a maintainer if a significant state architecture change is warranted before proceeding.

- **Follow Project Conventions**: The AI’s generated code should match the project’s code style, structure, and best practices (as described in this document and seen in the existing codebase). The AI is here to assist within the defined architecture, not to remodel it.  
- **Defer to Human Oversight**: Where there is uncertainty or a complex decision (especially around the rules here), the AI should flag the issue for a human to review rather than make an assumption. For example, if an AI is asked to implement something not clearly allowed, it should respond that it needs guidance due to these guardrails.

## 14. **When in Doubt (Clarifications)**  
If any instruction or requirement is unclear or not explicitly covered by these rules, the strategy is: **Stop, clarify, confirm**. In practice:

- **Don’t Guess**: If you (or an AI agent) are unsure about how to proceed within these guidelines, do not make uninformed assumptions. It’s better to halt than to possibly implement something incorrectly or insecurely.  
- **Seek Clarification**: Reach out via the appropriate channel (maintainer, team lead, code review comments) and explain the uncertainty. For an AI agent integrated in a development flow, this might mean it outputs a question or requests guidance rather than writing risky code.  
- **Never Invent Backend Behavior**: Don’t fabricate how you think the backend *might* work to suit your code. If the API or spec doesn’t say something, assume nothing or ask. For example, if unsure “Will Drupal allow this action?”, handle it by actually attempting via API or asking a developer, not by coding a guess.  
- **Document Uncertainties**: When leaving a portion for later or awaiting clarification, comment your code (or in PR) to indicate what is needed. It’s acceptable to mark TODOs if something needs confirmation from Drupal side or product decisions.

In short: **When uncertain, pause and ask** – it’s preferable to a wrong implementation.

## 15. **Exceptions and Escalation**  
These rules are designed to be strictly followed. However, in rare cases a situation may arise where deviating from a rule is considered. Any such exception must go through an approval process:

- **No Unilateral Exceptions**: You must **never ignore or bypass a rule on your own accord**. For example, you cannot decide “just this once, I’ll store something sensitive in localStorage” or “I’ll use this UI library for now and remove it later” without approval.  
- **Raise the Issue**: If you believe an exception is needed (e.g., a library is absolutely required to implement a feature, or a slight tweak to an architectural rule is necessary for a special case), bring it up with the maintainers or project leads. Explain why the exception is warranted and what the risks/benefits are.  
- **Obtain Explicit Approval**: Only proceed with the deviating approach if you receive a clear go-ahead. This approval should ideally be in writing (e.g., a comment on an issue/PR or an email/slack message from a lead) for traceability.  
- **Document and Contain**: If an exception is approved, document it in the code (comments) and in project notes if appropriate. Make it clear that this was a conscious decision. Also, limit the scope of the exception – just because one rule was bent in one scenario doesn’t mean it’s generally OK to ignore it elsewhere.  
- **Revisit if Needed**: Temporary exceptions should be revisited later to see if the need has changed (e.g., once the feature is delivered, perhaps plan to refactor to remove the exceptional case if possible).  

By having an escalation process, we ensure that any departure from these guardrails is carefully considered and signed off, rather than accidental or hidden.

## 16. **File Upload Handling**  
Applicants may need to upload documents (transcripts, IDs, immunization records, etc.). The frontend’s role in file uploads is minimal – it just delivers the file to Drupal and reports the outcome.

- **Use Drupal Endpoints**: Always upload files to Drupal’s dedicated file upload API endpoint (for example, Drupal’s JSON:API for file entities or a specific `/file/upload` endpoint, as configured). Typically, this means sending a multipart/form-data POST with the file. The exact endpoint and procedure should follow Drupal’s documentation.  
- **No File Content Processing on Frontend**: The frontend must **not** attempt to open or inspect the contents of files for any reason (security scanning, reading metadata, etc.). We trust Drupal (and its backend systems) to handle virus scanning, file type verification, and content validation. The frontend should treat files as opaque binary data.  
- **User-Friendly Pre-Checks**: It’s okay to do simple checks before upload for user convenience – e.g., check file extension or size **client-side** to warn the user early (“This file is too large” or “Only PDF files allowed”). However, these are just preliminary checks. The server will do its own enforcement, and its decision is final (the frontend must handle scenarios where the server rejects the file despite passing the pre-check).  
- **Handle Server Response**: After attempting an upload, interpret Drupal’s response. If the upload succeeds, proceed accordingly (e.g. show the uploaded file name or a success message, perhaps allow the user to upload another or continue). If it fails (validation error, file too large, wrong format, virus found, etc.), display the error message returned by Drupal to the user. Make sure the user can take an appropriate action (choose a different file, etc.).  
- **Don’t Store File Data**: Do not retain the file in component state or memory longer than needed. Once you’ve initiated the upload and got a response, you should release any references to the file (for example, don’t keep the raw file data in a global state). Certainly do not store file contents in localStorage or IndexedDB. If the user navigates away or cancels, ensure the file data is cleared from memory.  

*Example*: If a user attempts to upload a PDF transcript, **Compliant**: the frontend quickly checks the file extension is PDF and size is under the limit, then uploads it to Drupal. Drupal performs virus scan and type validation — if Drupal responds with “File too large” or “Virus detected”, the frontend shows that error to the user. **Non-compliant**: the frontend reads the entire PDF in JavaScript to try to do its own virus scan or content verification, which is not feasible or secure and duplicates what the backend does.

## 17. **Accessibility Requirements**  
The application must be accessible to users with disabilities and meet **WCAG 2.1 AA standards**. This is a firm requirement, not an afterthought.

- **Semantic HTML**: Use the correct HTML elements for the job to leverage built-in accessibility. For example, use `<button>` for clickable buttons (instead of an anchor or `<div>`), use `<form>` for grouping input fields, `<label>` for labeling inputs, `<ul>/<ol>` for lists, headings (`<h1>...<h6>`) for structure, etc. Proper semantics make it easier for assistive technologies to parse the UI.  
- **Proper Form Labels**: Every form control (input, select, textarea) should have an associated `<label>` element. The label can wrap the control or use `for` attribute linking to the input’s `id`. This ensures screen reader users know what each form field is.  
- **Error Indicators**: When a form field has an error, ensure that is communicated programmatically. For instance, you might add `aria-describedby="field-error-id"` on the input to tie it to a visible error message element. This way screen readers can inform the user of the error. Also consider using `aria-invalid="true"` on the invalid field.  
- **Keyboard Navigation**: All interactive components must be operable via keyboard alone. Users should be able to navigate through links and form controls with Tab/Shift+Tab, activate buttons or menu items with Enter/Space, and so on. If you create custom components (like a dropdown, modal, carousel), ensure you handle focus management and keyboard controls according to accessibility best practices. 
- **Focus Visibility**: Don’t remove the outline or focus indicator for focused elements unless you replace it with an equivalent visible style. Users navigating by keyboard need to see where the focus is.  
- **Use ARIA judiciously**: ARIA roles and attributes are supplements, not substitutes, for semantic HTML. Use ARIA when native HTML can’t achieve the needed accessibility. For example, use `role="dialog"` with proper aria attributes for a modal, but don’t use `role="button"` on a `<div>` when a `<button>` would do. Overusing ARIA can sometimes make things worse if not done correctly.  
- **Accessible by Default**: Write and generate code with accessibility in mind from the start. Don’t plan to “add accessibility later.” For AI agents, this means including alt text for images, labels for inputs, and so on without being explicitly prompted. It’s part of the definition of “done” for any UI element.  

*Example*: **Compliant**: `<button onClick={save}>Save</button>` – This is a proper button, focusable and announcing itself as a button to assistive tech. **Non-compliant**: `<div onClick={save} tabindex="0">Save</div>` – Even if made focusable with tabindex, using a `<div>` requires adding ARIA role "button" and handling key presses manually to be equally accessible. It’s much safer to use the semantically correct `<button>` element.

## 18. **Final Summary (Non-Negotiable)**  
**Drupal decides, React displays.** Always place authoritative logic and decisions on the Drupal backend, and let the React frontend handle presentation, input, and API calls. **AI assists, but does not make architectural decisions.** The AI (and developers) must work within these guardrails. In essence: when in doubt, remember that **Drupal is the brain**, and **React is the interface**. All design and coding choices should respect that separation. If any directive conflicts with this principle, escalate it. These rules are **firm** – sticking to them is critical for security, correctness, and maintainability.