<?php

namespace Drupal\newschool_payments\Service;

interface StripeClientInterface {

  /**
   * Creates a Stripe Checkout Session.
   *
   * @param array<string, mixed> $params
   *   Session create parameters.
   * @param string $idempotencyKey
   *   Idempotency key.
   *
   * @return array<string, mixed>
   *   Stripe response payload.
   */
  public function createCheckoutSession(array $params, string $idempotencyKey): array;

  /**
   * Verifies webhook signature and returns the decoded payload.
   *
   * @param string $rawPayload
   *   Raw JSON body.
   * @param string $signatureHeader
   *   Stripe-Signature header value.
   *
   * @return array<string, mixed>
   *   Decoded Stripe event.
   */
  public function verifyWebhookEvent(string $rawPayload, string $signatureHeader): array;

  /**
   * Returns Stripe-hosted receipt URL for a paid payment intent when available.
   *
   * @param string $paymentIntentId
   *   Stripe payment_intent identifier.
   *
   * @return string|null
   *   Receipt URL, or NULL when unavailable.
   */
  public function getReceiptUrlForPaymentIntent(string $paymentIntentId): ?string;

}
