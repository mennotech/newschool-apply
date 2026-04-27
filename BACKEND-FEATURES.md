# Backend Features

## Overview

- Backend is a Drupal 10 application running in Docker with Apache and PHP 8.2.
- Drupal is the system of record for authentication, authorization, workflow state, validation, and business rules.
- Backend exposes JSON:API resources and custom endpoints consumed by the React frontend.
- Local development defaults to SQLite for lightweight startup and testing.

## Runtime And Deployment Features

- Backend image is built from `php:8.2-apache-bookworm`.
- Apache is configured to serve Drupal from `/var/www/html/web`.
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
  - `sites/default/files` exists and is writable.
  - `settings.php` exists.
  - SQLite database configuration is present in `settings.php`.
  - Config sync directory is set to `/var/www/html/config/sync`.
- Fresh installs are automatic when no valid Drupal SQLite schema is detected.
- Installation uses configured admin credentials from environment variables.
- Required modules are enabled during install, including:
  - `jsonapi`
  - `serialization`
  - `basic_auth`
  - `rest`
  - `file`
  - `image`
  - Social auth modules when available
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
- Backend service CORS origins are injected from env via `services.yml.template`.

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

### Session And Auth Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/user/login?_format=json` | POST | Authenticate and establish Drupal session |
| `/user/logout?_format=json&token={token}` | GET | Invalidate authenticated Drupal session |
| `/user/login_status?_format=json` | GET | Return `1` or `0` for current session auth state |
| `/session/token` | GET | Return CSRF token for state-changing requests |

## Content Model Features

- Backend provides Drupal content entities for the admissions workflow, including:
  - Application records
  - Student profiles
  - Documents
  - Addresses
  - Profile data
- Application and profile fields are configured and versioned through Drupal config exports.
- JSON:API exposes CRUD operations for configured node bundles and related resources.
- Backend remains authoritative for persisted workflow status and submission timestamps.

## Bundle Type Catalog

- Backend currently uses five primary node bundles:
  - `application`
  - `student_profile`
  - `document`
  - `address`
  - `payment` (provided by `newschool_payments`)

### Application Bundle (`application`)

- Label/intent: `Application` - school application submitted by a parent on behalf of a student.
- Role in workflow: primary aggregate record for the full multi-step admissions process.
- Stores student, health, guardian, support, questionnaire, commitment, and section-review status fields.
- Key relationship fields include:
  - `field_student_profile` -> `student_profile`
  - `field_physical_address` -> `address`
  - `field_mailing_address` -> `address`
  - `field_father_address` -> `address`
  - `field_mother_address` -> `address`
  - `field_payment` -> `payment` (added by payment module)
- Workflow/status fields include:
  - `field_status` (draft/submitted lifecycle)
  - `field_submitted_at`
  - `field_section_1_reviewed` through `field_section_6_reviewed`
- Address decision flags on application include:
  - `field_mailing_address_differs` (`yes|no`)
  - `field_father_address_same_a45c44` (`yes|no`)
  - `field_mother_address_same_afa04c` (`yes|no`)

### Student Profile Bundle (`student_profile`)

- Label/intent: `student_profile` - reusable student profile for school applications.
- Role in workflow: canonical student identity/demographic record that can be attached to applications.
- Key fields include:
  - `field_first_name`
  - `field_last_name`
  - `field_date_of_birth`
  - `field_grade_applying_for`
- Linked from applications through `field_student_profile`.

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
  - `application` -> `student_profile`
  - `document` -> `application`
  - `application` -> `payment` (via payment module)
- Backend enforces auth and CSRF requirements for mutating operations.

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
