# NewSchool Payments (Drupal module)

`newschool_payments` is the backend authority for application fee checkout and payment status.

## What it does

- Creates `payment` nodes as the canonical payment record.
- Stores Stripe identifiers and payment snapshot data on the `payment` node.
- Links payable application bundles to the current/active payment via `field_payment`.
- Exposes backend endpoints for checkout session creation and Stripe webhooks.

## Admin configuration

Path: `/admin/config/newschool/payments`

Settings include:

- Stripe keys:
  - `stripe_secret_key`
  - `stripe_webhook_secret`
- Frontend URLs:
  - `success_url`
  - `cancel_url`
- Fee mapping by application bundle (no taxonomy)

Fee config shape:

```yaml
fees:
  application:
    amount_cents: 10000
    currency: CAD
    label: Application Fee
```

Only bundles that have `field_payment` are shown in the fee table.

## Environment override (recommended)

If set, these env vars override admin-stored keys:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

This keeps secrets out of exported config and source control.

## API routes

### 1) Create checkout session

- `POST /api/payments/checkout-session`
- Requires authenticated Drupal session + `X-CSRF-Token`
- Route has explicit `_csrf_token: 'TRUE'`

Request JSON:

```json
{
  "application_id": "123"
}
```

Response JSON:

```json
{
  "url": "https://checkout.stripe.com/c/session_id",
  "payment_id": 456,
  "session_id": "cs_test_..."
}
```

Pending-payment policy: the endpoint always creates a fresh `payment` node and replaces `application.field_payment` unless the currently linked payment is already `paid` (which returns `409`). This avoids reusing stale checkout sessions.

### 2) Stripe webhook

- `POST /api/payments/stripe/webhook`
- Public endpoint, no auth, no CSRF
- Verifies `Stripe-Signature` against webhook signing secret
- Handles `checkout.session.completed`

## Webhook setup guidance

In Stripe Dashboard:

1. Add webhook endpoint: `https://<your-drupal-host>/api/payments/stripe/webhook`
2. Subscribe to event: `checkout.session.completed`
3. Copy signing secret and set `STRIPE_WEBHOOK_SECRET`

## Why webhook is authoritative

Stripe redirects are user/browser-controlled and can be interrupted. The webhook is server-to-server and signed by Stripe, so the module marks payment as paid only after verified webhook delivery.
