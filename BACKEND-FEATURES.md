# Backend Features

This document describes the target backend behavior to implement during the build phases.

## Overview

- The target backend is a Drupal 10 application running in Docker with Apache and PHP 8.3.
- Drupal is the system of record for authentication, authorization, workflow state, validation, and business rules.
- Backend exposes JSON:API resources and custom endpoints consumed by the JS frontend.
- Local development defaults to SQLite for lightweight startup and testing.
- The backend schema direction is multi-bundle: one reusable application field set, several concrete application bundles, and reusable support records for people and addresses.

## Runtime And Deployment Features

- Backend image is built from pinned upstream `php:8.3.30-apache-bookworm`.
- Apache is configured to serve Drupal from `/var/www/html/web`.
- Apache strips `WWW-Authenticate` response headers so browser-native 401 auth prompts are suppressed and the JS frontend handles unauthorized UX.
- Drush is installed and used for install-time/bootstrap operations.
- Stripe CLI is installed in the backend image for local webhook testing.
- Required PHP extensions for Drupal and media handling are installed, including:
  - `pdo_sqlite`
  - `gd`
  - `zip`
  - `opcache`

## Initialization And Bootstrap Features

- Container startup runs `backend/init.sh` before Apache foreground process.
- Startup script ensures:
  - `sites/default/files` exists and is owned by `www-data:www-data` with permissions `770` (`ug=rwx,o=` per Drupal's security guidance). No world read or execute permissions; only the owning user and group may access this directory.
    - On Fly.io, `sites/default/files` must be a symlink to `/data/files` (the `files` subfolder of the single `/data` volume). The init script creates this symlink if it does not already exist, then applies the correct ownership and permissions to the target directory.
    - On local Docker Compose, `sites/default/files` is a real directory backed by the named volume `backend_drupal_files` mounted directly at that path.
  - `settings.php` exists and is written during first-time setup.
  - Runtime trusted host patterns are regenerated on every startup from `BACKEND_URL` after sanitizing any accidental scheme, path, or port. Legacy `DRUPAL_HOSTNAME` remains available as an override when needed. Local defaults for `localhost`, `127.0.0.1`, and Fly domains remain allowed.
  - After `settings.php` is written, its permissions are locked to `440` (read-only for owner and group, no access for others) so the web server cannot modify it. This is a Drupal security requirement.
  - SQLite database configuration is present in `settings.php`. The SQLite database file path is read from the `DRUPAL_SQLITE_PATH` environment variable. The path must be **outside `sites/default/files`** and outside the webroot:
    - Local Docker Compose default: `/var/drupal-db/db.sqlite` (named volume `backend_drupal_db`)
    - Fly.io: `/data/db/db.sqlite` (subfolder of the single `/data` volume)
    Do not store the SQLite database inside `sites/default/files`; that directory is web-accessible and serves uploaded files.
  - Config sync directory is set to `/var/www/html/config/sync`.
- The Drupal codebase files (PHP, config, vendor) are owned by the container build user and are NOT writable by `www-data`. Codebase directories use permissions `750` and files use `640` per Drupal's security guidance. Only the `sites/default/files` directory requires web server write access.
- Fresh installs are automatic when no valid Drupal SQLite schema is detected.
- Installation uses configured admin credentials from environment variables.
- Backend startup fails if `DRUPAL_ADMIN_PASS` is missing or empty; local Docker Compose expects it to be set in the repository `.env` file.
- Backend dependency installs are lockfile-based: `backend/composer.lock` is required for image builds and Composer installs run against the committed lockfile.
- Required modules are enabled during install, including:
  - `jsonapi`
  - `serialization`
  - `basic_auth`
  - `rest`
  - `file`
  - `image`
  - `newschool_payments`
- JSON:API write mode is explicitly enabled (`read_only = 0`).
- Roles are created on first install:
  - `parent`
  - `applicant_reviewer`
- Configuration import is hash-gated:
  - Backend computes a hash over `config/sync` content.
  - Config import runs only when the hash changes.
  - Applied hash is recorded to avoid redundant imports.
- Drupal caches are rebuilt at the end of initialization.

## Configuration Management Features

- Drupal configuration lives in `backend/config/sync` and is imported at startup.
- Config synchronization includes content types, fields, form/view displays, and related settings.
- Startup script supports partial config import from the sync directory.
- Backend service CORS origins default to `FRONTEND_URL` and are written into `services.yml` by `init.sh` at startup.
- `CORS_ALLOWED_ORIGINS` is only honored in production runtime so multiple frontend origins can be allowed there when required. Local/dev always derives a single allowed origin from `FRONTEND_URL`.

## Schema And Scaffolding Features

- Primary schema source: `schema/v2/` (split v2 catalog files).
- The schema separates bundles into:
  - `reusable_bundles`
- `Export-DrXDrupalScaffoldConfig` in the `DrX-Schema` PowerShell module now supports:
  - catalog schemas with multiple bundles
  - split-schema directory input (merges all `.yaml` / `.yml` files deterministically)
  - inherited shared fields from a reusable base bundle
  - reusable supporting record bundles
  - multi-value typed contact-list fields
  - dedicated reference field mappings for person, address, and student relationships
  - generic node-reference fields with bundle targeting for master application and page/template relationships
  - boolean fields for simple on/off bundle settings
- Drupal field definition YAML should be generated from schema using the PowerShell module scaffolder entry point:
  - `pwsh -File Enable-DrX-Schema.ps1`
  - `Export-DrXDrupalScaffoldConfig`
- A shared PowerShell module now centralizes backend test and schema helpers at:
  - `schema/DrX-Schema/DrX-Schema.psd1`
- The easiest way to load that module into an interactive terminal from the repo root is:
  - `pwsh -File Enable-DrX-Schema.ps1`
- After running the loader once in a terminal session, the module can be used by name directly from the repo root. The commands load `.env` from the current directory first, then fall back to the repo root `.env`. Schema commands use `DRX_SCHEMA_PATH` when it is set in the process environment or `.env`, otherwise they default to `schema/v2`.
- Example direct commands:
  - `Invoke-DrXApiSmokeTest`
  - `Invoke-DrXDbSchemaValidation`
  - `Invoke-DrXInternalApiSchemaValidation`
  - `Invoke-DrXExternalApiSchemaValidation`
  - `Export-DrXDrupalScaffoldConfig`
- Command roles:
  - `Invoke-DrXApiSmokeTest` verifies authenticated backend session basics and JSON:API index availability.
  - `Invoke-DrXDbSchemaValidation` verifies Drupal bundle persistence through the internal entity API by creating, reloading, updating, and deleting one temporary node per schema bundle through Drush.
  - `Invoke-DrXInternalApiSchemaValidation` is a hybrid test: it creates temporary fixture nodes through Drush, then checks JSON:API index exposure plus authenticated `GET`, `PATCH`, and `DELETE` behavior for each bundle over HTTP.
  - `Invoke-DrXExternalApiSchemaValidation` is a pure external-client test: it creates, reads, updates, and deletes fixtures only through JSON:API over HTTP using schema-derived payloads.
- Schema location can be overridden in `.env` with:
  - `DRX_SCHEMA_PATH=schema/v2`
- If generated field-definition formatting or structure needs changes, update schema inputs and/or scaffolder functionality first, then regenerate. Do not treat generated field definition YAML as primary hand-maintained source.

## Authentication And Session Features

- Session-based authentication is fully handled by Drupal.
- Supported login patterns include:
  - Email/password login (`POST /user/login?_format=json`)
  - Drupal-managed social auth (Google and Microsoft modules)
- Backend provides session status check endpoint:
  - `GET /user/login_status?_format=json`
- Backend provides CSRF token endpoint for mutating requests:
  - `GET /session/token`
- Session invalidation uses Drupal logout token flow:
  - `GET /user/logout?_format=json&token={logoutToken}`
- Backend must expose a session info endpoint that returns the logout token for the active session so the frontend can perform logout after a bootstrapped session (one where no `/user/login` response was received by the frontend):
  - `GET /api/session/info?_format=json` returning at minimum `{ logout_token, current_user: { uid, name, mail, roles } }`
  - Endpoint is authenticated; returns 403 for unauthenticated requests
  - Used by `getLogoutToken()` in the frontend API utility

### Session And Auth Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/user/login?_format=json` | POST | Authenticate and establish Drupal session |
| `/user/logout?_format=json&token={token}` | GET | Invalidate authenticated Drupal session |
| `/user/login_status?_format=json` | GET | Return `1` or `0` for current session auth state |
| `/session/token` | GET | Return CSRF token for state-changing requests |
| `/api/session/info?_format=json` | GET | Return current user data and logout token for bootstrapped sessions |

## Bundle Type Catalog

- Reusable/shared bundle catalog include:
  - `application`
  - `application_form`
  - `student_information_page`
  - `health_information_page`
  - `parent_guardian_information_page`
  - `additional_support_declaration_page`
  - `parent_questionnaire_page`
  - `statement_of_commitment_page`
  - `person`
  - `student`
  - `address`
- Existing supporting bundles still expected by the broader platform include:
  - `student`
  - `document`
  - `payment`

### Reusable Application Bundle (`application`)

- Represents the submission node created each time a user starts an application form.
- Shared fields include:
  - application form template reference
  - date started
  - application process state (`draft`, `submitted`)
  - application result (`approved`, `denied`)
  - payment state (`paid`, `unpaid`)
- Detailed answers live on page-level application nodes rather than on the application submission itself.
- Admins and users create application nodes from this bundle directly when a new application is started.

### Application Form Bundle (`application_form`)

- `application_form` is the admin-managed template that defines which reusable page bundles appear in a given application flow and in what order.
- The Drupal node title is the form title.
- Template fields include:
  - `field_enabled`
  - `field_description`
  - `field_pages` as an ordered multi-value list of reusable page identifiers for the form type
- Admins create `application_form` nodes first, then application records link back to the chosen template through `field_application_form`.

### Application Page Bundles

- Each reusable page bundle directly includes `field_master_application` as a bundle-level system field pointing to the owning `application` record.
- `sections` now represent visual field groups on a page so the frontend can render titles, descriptions, borders, or other layout chrome around each group.
- Reusable pages are split into individual schema definitions so admins can compose form types from them:
  - `student_information_page`
  - `health_information_page`
  - `parent_guardian_information_page`
  - `additional_support_declaration_page`
  - `parent_questionnaire_page`
  - `statement_of_commitment_page`
- End-user answers are stored on these page nodes rather than directly on the master application node.

### Person Bundle (`person`)

- `person` is the normalized contact record for parents, guardians, and reusable emergency contacts.
- Identity fields include given name, middle name, surname, preferred name, and workplace.
- Contact methods are stored as multi-value typed lists:
  - `email_addresses`
  - `phone_numbers`
- Each contact value uses `type:value` formatting, for example `work:jdoe@contoso.com`.
- Address relationships are references to reusable address records rather than embedded address strings.
- The backend must validate contact formatting and cardinality rules.

### Student Profile Bundle (`student`)

- Label/intent: `student` - reusable student profile for school applications.
- Role in workflow: canonical student identity/demographic record that can be attached to applications.
- Key fields include:
  - `field_first_name`
  - `field_last_name`
  - `field_date_of_birth`
  - `field_grade_applying_for`
- Linked from applications through `field_student`.

### Document Bundle (`document`)

- Label/intent: `document` - uploaded document associated with an application.
- Role in workflow: stores document metadata and uploaded file references used during application review.
- Key fields include:
  - `field_application` -> owning `application`
  - `field_file` -> managed file entity
  - `field_document_type` -> classification of uploaded document
- Used to attach transcripts and other supporting files to an application.

### Address Bundle (`address`)

- Label/intent: `Address` - reusable address entity for forms.
- Role in workflow: normalized address record referenced by application for student and guardian addresses.
- Address fields include:
  - `field_address_line_1` (required string, max length 255)
  - `field_address_line_2` (optional string, max length 255)
  - `field_address_city` (required string, max length 255)
  - `field_address_state_province` (required string, max length 255)
  - `field_address_postal_zip` (required string, max length 255)
- Data-shape constraints:
  - Single-value fields (cardinality 1)
  - Non-translatable fields
- Application references are explicit and address-only:
  - `field_physical_address`, `field_mailing_address`, `field_father_address`, `field_mother_address`
  - Target bundle constrained to `address`
  - `auto_create: false` requires creating/selecting address nodes before linking
- JSON:API persistence pattern:
  - Create/update `address` node
  - Attach address node ID to relevant application relationship field(s)

### Payment Bundle (`payment`)

- Label/intent: `Payment` - authoritative payment record for application fees.
- Role in workflow: source of truth for checkout session IDs, payment state, and webhook-confirmed completion.
- Key relationship fields include:
  - `field_application` -> `application`
  - `field_payer` -> Drupal user
- Financial and Stripe tracking fields include:
  - `field_amount_cents`
  - `field_currency`
  - `field_status`
  - `field_stripe_checkout_session_id`
  - `field_stripe_payment_intent_id`
  - `field_paid_at`
  - `field_last_stripe_event_id`
  - `field_receipt_url`

## JSON:API Integration Features

- JSON:API is enabled and writable for authenticated requests.
- Backend supports CRUD operations consumed by frontend for application lifecycle operations.
- Relationships are used to connect data entities, including:
  - `application` -> `student`
  - `document` -> `application`
  - `application` -> `payment` (via payment module)
- Backend enforces auth and CSRF requirements for mutating operations.
- The backend data model expects JSON:API consumers to:
  - create and update reusable `person` records
  - create and update reusable `address` records
  - link those records into concrete application bundles through entity references

## User-Owned Reusable Record Library

- Authenticated users should be able to list and reuse their `person` and `address` records.
- Backend authorization remains responsible for ensuring users can only access their own reusable records.
- Reusing a person or address in a later application should happen by reference rather than by copying record contents into the application bundle.

## Custom Payments Module Features

- Custom module: `newschool_payments`.
- Payment data is modeled as a dedicated `payment` content type and acts as the canonical payment record.
- Module links payable application bundles to the current payment node through `field_payment`.

### Payment Data Fields

- Payment nodes include fields for:
  - Application reference (`field_application`)
  - Payer reference (`field_payer`)
  - Amount in cents (`field_amount_cents`)
  - Currency (`field_currency`)
  - Status (`field_status`)
  - Stripe checkout session ID (`field_stripe_checkout_session_id`)
  - Stripe payment intent ID (`field_stripe_payment_intent_id`)
  - Paid timestamp (`field_paid_at`)
  - Last processed Stripe event ID (`field_last_stripe_event_id`)
  - Receipt URL (`field_receipt_url`)

### Payment Status Model

- Payment status values include:
  - `unpaid`
  - `pending`
  - `paid`
  - `failed`
  - `canceled`

### Payment Admin Configuration

- Admin settings page: `/admin/config/newschool/payments`.
- Configurable values include:
  - Stripe secret key
  - Stripe webhook signing secret
  - Checkout success URL
  - Checkout cancel URL
  - Fee mapping by payable application bundle
- Fee mapping is configured per application bundle with:
  - Enabled flag
  - Amount (cents)
  - Currency
  - Fee label
- Only bundles that expose `field_payment` are available in the fee mapping table.
- Stripe key values support environment overrides:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

### Payment API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/payments/checkout-session` | POST | Create a pending payment and Stripe Checkout session |
| `/api/payments/stripe/webhook` | POST | Verify Stripe signature and finalize payment state |
| `/api/payments/checkout-status` | GET | Return payment/app submission confirmation for a checkout session |

### Checkout Session Behavior

- Endpoint requires authenticated Drupal user session.
- Endpoint requires CSRF request header token.
- Request body accepts application identifier (`nid` or UUID).
- Backend verifies user can pay the target application.
- Backend resolves fee from bundle-level payment configuration.
- Backend behavior for existing payment reference:
  - If linked payment is already `paid`, returns conflict response.
  - Otherwise creates a fresh `payment` record and replaces application reference.
- Stripe Checkout Session is created server-side with idempotency key.
- Payment node stores Stripe session metadata before response is returned.

### Webhook Behavior

- Webhook endpoint is public and signature-verified using Stripe signing secret.
- Only `checkout.session.completed` transitions payment to paid state.
- Matching strategy supports:
  - `client_reference_id` (`payment:{nid}`)
  - Fallback by stored Stripe checkout session ID
- Webhook handling includes:
  - Event idempotency using last Stripe event ID
  - Amount/currency consistency checks
  - Payment intent capture and receipt URL retrieval
  - Updating linked application reference when needed
  - Marking linked application as submitted and timestamping submission

## Access Control And Authorization Features

- Checkout creation checks ownership/permissions before initiating payment.
- Payment status lookup endpoint enforces payer/application/admin visibility checks.
- Drupal permission checks remain the final authority for node actions.
- Unauthorized payment actions return safe error responses.

## Error Handling And Reliability Features

- Backend returns explicit HTTP status codes for expected API failures.
- Stripe API failures mark payment nodes as `failed` where applicable.
- Missing fee configuration is handled as a client-visible validation error.
- Webhook endpoint returns `200` for non-applicable events to avoid unnecessary retries.
- Signature failures are rejected with `400`.
- Payment event replay and duplicate processing are guarded via idempotency checks.

## Backend Testing Coverage

- Node-based backend integration coverage exists in `backend/tests/api.test.js` for JSON:API operations.
- Custom module functional tests cover payment endpoints in `newschool_payments`.
- Existing backend tests validate scenarios including:
  - Authenticated and unauthenticated API behavior
  - Student profile CRUD via JSON:API
  - Application CRUD and entity relationships
  - Document CRUD and linkage
  - Checkout-session endpoint creates pending payment and links application
  - Stripe webhook transitions payment to paid and preserves application linkage

## Current Backend Boundaries

- Backend owns all authoritative decisions for auth, workflow, and payment state.
- Frontend is expected to consume backend responses and render state only.
- Stripe keys and verification remain backend-only concerns.
- Payment finalization is webhook-authoritative, not frontend redirect-authoritative.

## Known Behavior and Gotchas

These were discovered during active development. They are not documented in Drupal core docs.

### Required field cache after config changes

Drupal's entity field manager caches field definitions in the discovery cache. After changing `required: true` to `required: false` on a field (whether via config import or a PHP script), the old value is served until a full cache rebuild runs. A valid POST that omits a previously required field will fail with 422 until `drush cr` is run:

```bash
/var/www/html/vendor/bin/drush cr
```

Always flush caches after field config changes, not just after config import.

### Logout token is not the CSRF token

`GET /user/logout?_format=json` requires a `token` query parameter that is the **`logout_token`** returned in the `/user/login` response body — not the CSRF token from `/session/token`. Drupal returns a misleading 403 with "csrf_token URL query argument is missing" when the wrong token is provided. This is a Drupal core error message that does not accurately describe the problem.

### Session check — use login_status not JSON:API user

`GET /user/login_status?_format=json` is the correct endpoint for checking session state. It returns `1` or `0` and is safe for all authenticated roles. `/jsonapi/user/user/{id}` returns 403 for valid sessions belonging to non-admin users because of permission checks on the user entity — using it for session validation produces false session-expiry errors.

### Drush is not on PATH by default

Drush is installed at `/var/www/html/vendor/bin/drush` inside the container. It is not on the system PATH. Use the full path when running Drush commands:

```bash
docker compose exec backend /var/www/html/vendor/bin/drush <command>
```

### Guardian relationship fields on application bundles

The two application-level fields for guardian relationship type (`field_primary_guardian_re_630bb2` and `field_secondary_guardian__d20f5d`) are typed `text_long` in the Drupal field storage but function as relationship-type selects in the frontend. Their values are option strings such as `mother`, `father`, `guardian`. This is a modeling simplification — they were originally designed as notes fields before the relationship type was moved from the person record to the application.

