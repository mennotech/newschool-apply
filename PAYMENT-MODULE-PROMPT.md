You are working inside a monorepo where /backend is a Drupal 10 app and /frontend is a plain React SPA.

Follow the architectural guardrails from AGENTS.md:
- Drupal is the single source of truth for business logic and payment status.
- React is UI only and uses Drupal session cookies.
- All state-changing requests from React include an X-CSRF-Token fetched from /session/token.
Do not move payment logic to React. Keep secrets server-side. 

Goal
Build a small Drupal 10 custom module that:
1) Creates a new node type “payment” that stores all payment info (Stripe ids, amount, currency, status, paid_at, etc.).
2) Ensures an “application” node references the current/active “payment” node.
3) Provides an admin config page where fees are configured by APPLICATION NODE TYPE (bundle). No taxonomy.
4) Exposes a POST API endpoint to create a Stripe Checkout Session for the application fee.
5) Exposes a public POST webhook endpoint that verifies Stripe signatures and marks the Payment node as paid.

Stripe approach
Use Stripe Checkout Sessions API and confirm payment via webhook, not browser redirects. 

Implementation Requirements (Backend / Drupal)

A. Module name
Create custom module newschool_payments and find a suitable folder in the backend to store. The module should be added into the image and then enabled with init on clean install. Add:
- newschool_payments.info.yml
- newschool_payments.routing.yml
- newschool_payments.services.yml (if needed)
- src/Controller/*
- src/Form/*
- config/install/* for content types, fields, and default config

B. Content types / fields

B1. Create new content type: Payment (node bundle = payment)
Add fields (via config/install):
- field_application (entity reference to node; required; points to the application being paid for)
- field_payer (entity reference to user; optional; set to current user when created)
- field_amount_cents (integer; required)
- field_currency (string; required; e.g., CAD)
- field_status (list string): unpaid | pending | paid | failed | canceled
- field_stripe_checkout_session_id (string)
- field_stripe_payment_intent_id (string)
- field_paid_at (datetime)
- field_last_stripe_event_id (string) for webhook idempotency tracking
Payment node is the authoritative record.

B2. Application node references Payment node
Ensure every application bundle that should be payable has:
- field_payment (entity reference to node:payment; cardinality 1)
If the repo already has an “application” content type, update it via config/install (or config update hook). If multiple application bundles exist, add field_payment to each of them.

C. Fee config (NO taxonomy): mapping by application bundle
Create an admin settings form that stores:
1) Stripe settings:
- stripe_secret_key (use env override if STRIPE_SECRET_KEY exists)
- stripe_webhook_secret (use env override if STRIPE_WEBHOOK_SECRET exists)
- success_url and cancel_url (frontend URLs)
2) Fee mapping:
- For each selected application bundle: amount_cents, currency, label
Implementation:
- Use node_type storage (entity_type.manager) to list node bundles that have a field reference to payment
- Present a table on the admin form:
  [Enabled checkbox] [Bundle machine name] [Human label] [Amount (cents)] [Currency] [Label/description]
- Save in config like:
  fees:
    application_bundle_machine_name:
      amount_cents: 10000
      currency: CAD
      label: "Application Fee"
Validation:
- amount_cents integer >= 0
- currency 3-letter uppercase
- if Enabled unchecked, remove mapping for that bundle

D. API endpoint: create checkout session
Route:
- POST /api/payments/checkout-session
- Must require auth (session cookie) and CSRF protection.
Drupal now requires explicit _csrf_token requirement on routes; set _csrf_token: 'TRUE' for this route. 

Request body JSON: { "application_id": "<nid or uuid>" }

Behavior:
1) Load application node; verify current user is allowed to pay it (ownership/perms).
2) Determine fee from config based on $application->bundle():
   - If no fee configured, return 400 with safe message.
3) Handle existing payment reference:
   - If application.field_payment references a payment whose status == paid => return 409.
   - If status == pending and has stripe_checkout_session_id => optionally return existing session URL only if still valid; otherwise create a new payment and replace reference. Choose one policy and document.
4) Create a new Payment node:
   - field_application = application
   - field_payer = current user
   - field_amount_cents, field_currency from config snapshot
   - field_status = pending
   - save
5) Link application.field_payment = payment node; save application
6) Create Stripe Checkout Session (server-side) using Stripe secret key:
   - mode = payment
   - client_reference_id = "payment:{payment_nid}" so webhook can reconcile
   - success_url includes ?session_id={CHECKOUT_SESSION_ID}
   - cancel_url from config
   - line_items uses price_data with unit_amount = amount_cents, currency, product_data.name = label
Stripe API reference supports client_reference_id. 
Reliability: Use idempotency key for session creation (e.g. "checkout_session_payment_{payment_nid}") 
7) Save Stripe session id to Payment.field_stripe_checkout_session_id; save Payment
8) Return JSON: { url, payment_id, session_id }

E. Webhook endpoint: verify signature + mark Payment paid
Route:
- POST /api/payments/stripe/webhook
- Public, no CSRF, no auth.
Must read RAW body and verify Stripe-Signature using signing secret. 

Behavior:
1) Verify signature; return 400 if invalid
2) Handle checkout.session.completed:
   - Extract client_reference_id (preferred) and session id
   - Load Payment node by nid parsed from "payment:{nid}" OR fallback query by stripe_checkout_session_id
   - Idempotent: if already paid, return 200
   - Validate currency/amount if available in event (compare to Payment snapshot); if mismatch, set failed and return 200
   - Set Payment.status = paid, set payment_intent id, set paid_at, save
   - Ensure linked Application.field_payment points to this Payment; set if missing/wrong; save
Return 200 quickly. Stripe retries on non-2xx. 

F. CSRF + headers
For the checkout-session route, accept X-CSRF-Token header (React fetches from /session/token). Keep it consistent with existing headless patterns.

G. Tests
Add minimal automated coverage:
1) Functional test:
- Create user + application node in a bundle with configured fee
- Authenticate + pass CSRF token
- POST /api/payments/checkout-session
- Assert Payment node created (pending), Application references it, response returns url
2) Webhook test:
- Simulate checkout.session.completed payload where client_reference_id references the Payment nid
- Verify Payment transitions to paid and Application reference remains correct
If signature generation is heavy, isolate verification in a service and unit test; controller test can stub verification.

H. Documentation
Document:
- Admin fee mapping by bundle
- Routes + payloads
- Stripe secrets via env override
- Webhook setup guidance
- Why webhooks are authoritative

Deliverables Checklist
- payment content type + fields (config/install)
- application bundles updated to reference payment
- admin config page includes fee mapping by bundle
- POST /api/payments/checkout-session with explicit _csrf_token: 'TRUE' 
- POST /api/payments/stripe/webhook signature verified, handles checkout.session.completed 
- Tests
- No frontend changes required besides calling endpoint and redirecting to returned url

Now implement in /backend only. Before creating new fields, scan existing application bundle names and avoid inventing mismatched names.