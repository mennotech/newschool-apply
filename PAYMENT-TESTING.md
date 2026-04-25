# Local Payment Testing Guide

This document explains how to test the local Stripe payment flow with the Stripe CLI and local Drupal/React services.

## Prerequisites

- Docker services are running for backend and frontend.
- You have a Stripe account and can access a development/test instance in stripe.com.
- Stripe CLI is installed locally on your computer.

### Install Stripe CLI on Debian (host machine)

Run:

```bash
sudo apt-get update && sudo apt-get install -y curl gnupg && curl -fsSL https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null && echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee /etc/apt/sources.list.d/stripe.list > /dev/null && sudo apt-get update && sudo apt-get install -y stripe
```

Verify:

```bash
stripe --version
```

## 1) Log in to Stripe from your local machine

Run:

```bash
stripe login
```

This opens a browser for Stripe CLI authentication.

## 2) Start webhook forwarding from Stripe CLI

Run:

```bash
stripe listen --forward-to http://localhost:8080/api/payments/stripe/webhook
```

Port note:

- If Stripe CLI runs on your local host (outside Docker), include `:8080` because Drupal is exposed on host port 8080.
- If Stripe CLI runs inside the backend container, use the container-local URL (for example `http://localhost/api/payments/stripe/webhook` from inside that container).

Keep this command running in a terminal window while testing.

After it starts, Stripe CLI prints a signing secret that looks like:

- `whsec_...`

You will use this value in Drupal payment settings as the webhook secret.

## 3) Get your Stripe test secret key

In Stripe dashboard (development/test mode):

1. Open stripe.com and switch to your dev/test instance.
2. Go to Developers -> API keys.
3. Copy the Secret key (starts with `sk_test_`).

Use only test keys for local testing.

## 4) Update Drupal payment settings

Open:

- http://localhost:8080/admin/config/newschool/payments

Set the following fields:

- Stripe secret key: your `sk_test_...` value from Stripe dashboard
- Stripe webhook signing secret: the `whsec_...` value from `stripe listen`
- Success URL: http://localhost:3000/pay/success
- Cancel URL: http://localhost:3000/apply/commitment

Save configuration.

## 5) Run a local checkout flow

1. In the frontend, proceed to the commitment/payment step.
2. Start checkout and complete payment using a Stripe test card.
3. Confirm Stripe CLI shows event delivery to the webhook endpoint.
4. Confirm local app returns to success URL and payment status is updated.

## 5.1) Stripe test credit cards

Use these test cards in Stripe Checkout (test mode only):

- Successful payment (Visa): `4242 4242 4242 4242`
- Requires authentication (3D Secure): `4000 0025 0000 3155`
- Declined card (generic): `4000 0000 0000 0002`
- Insufficient funds: `4000 0000 0000 9995`

Test input tips:

- Use any future expiry date.
- Use any 3-digit CVC.
- Use any valid postal code.
- If prompted for 3D Secure challenge, complete it to simulate a successful authenticated payment.

## 6) Quick verification checklist

- Stripe CLI terminal shows `checkout.session.completed` delivered.
- Drupal payment record is marked paid.
- Application submission status is set as expected.
- Receipt URL (if returned by Stripe charge) is saved and appears in UI where applicable.

## Notes

- Keep `stripe listen` running during testing; stop it after you are done.
- If webhooks are not being processed, re-check the webhook signing secret in Drupal.
- If checkout session creation fails, re-check Stripe secret key and ensure it is a test key.
