<?php

namespace Drupal\newschool_payments\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;

/**
 * Handles Stripe payment checkout sessions and webhooks.
 */
class PaymentController extends ControllerBase {

  /**
   * @var \Drupal\Core\Session\AccountInterface
   */
  protected $currentUser;

  /**
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * Constructor.
   */
  public function __construct(AccountInterface $current_user, EntityTypeManagerInterface $entity_type_manager) {
    $this->currentUser = $current_user;
    $this->entityTypeManager = $entity_type_manager;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('current_user'),
      $container->get('entity_type.manager')
    );
  }

  /**
   * Creates a Stripe Checkout Session.
   *
   * POST /api/payments/checkout-session
   * Body: { application_id: "uuid" }
   */
  public function createCheckoutSession(Request $request): JsonResponse {
    if ($this->currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Unauthorized'], 401);
    }

    $body = json_decode($request->getContent(), TRUE);
    $application_id = $body['application_id'] ?? NULL;

    if (!$application_id) {
      return new JsonResponse(['error' => 'application_id is required'], 400);
    }

    $stripe_secret = getenv('STRIPE_SECRET_KEY');
    if (!$stripe_secret) {
      return new JsonResponse(['error' => 'Payment not configured'], 503);
    }

    // Build Stripe checkout session via cURL (no Stripe SDK dependency).
    $frontend_base = getenv('CORS_ALLOWED_ORIGINS') ?: 'http://localhost:3000';
    $frontend_base = explode(',', $frontend_base)[0];
    $success_url = rtrim($frontend_base, '/') . '/payment-success?session_id={CHECKOUT_SESSION_ID}';
    $cancel_url = rtrim($frontend_base, '/') . '/apply/commitment';

    $payload = http_build_query([
      'payment_method_types[]' => 'card',
      'mode' => 'payment',
      'line_items[0][price_data][currency]' => 'cad',
      'line_items[0][price_data][product_data][name]' => 'Application Fee',
      'line_items[0][price_data][unit_amount]' => 10000, // $100.00 CAD
      'line_items[0][quantity]' => 1,
      'success_url' => $success_url,
      'cancel_url' => $cancel_url,
      'metadata[application_id]' => $application_id,
      'metadata[user_id]' => $this->currentUser->id(),
    ]);

    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
    curl_setopt($ch, CURLOPT_POST, TRUE);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_USERPWD, $stripe_secret . ':');
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code !== 200) {
      $error = json_decode($response, TRUE);
      return new JsonResponse(['error' => $error['error']['message'] ?? 'Stripe error'], $http_code);
    }

    $session = json_decode($response, TRUE);

    // Create a payment node to track this checkout.
    // (Webhook will update it when payment completes.)
    $payment = $this->entityTypeManager->getStorage('node')->create([
      'type' => 'payment',
      'title' => 'Payment for ' . $application_id,
      'field_stripe_session_id' => $session['id'],
      'field_payment_status' => 'pending',
      'uid' => $this->currentUser->id(),
    ]);
    try {
      $payment->save();
      $payment_id = $payment->uuid();
    }
    catch (\Exception $e) {
      $payment_id = NULL;
    }

    return new JsonResponse([
      'checkout_url' => $session['url'],
      'session_id' => $session['id'],
      'payment_id' => $payment_id,
    ]);
  }

  /**
   * Checks the status of a Stripe Checkout Session.
   *
   * GET /api/payments/checkout-status?session_id=...
   */
  public function checkoutStatus(Request $request): JsonResponse {
    if ($this->currentUser->isAnonymous()) {
      return new JsonResponse(['error' => 'Unauthorized'], 401);
    }

    $session_id = $request->query->get('session_id');
    if (!$session_id) {
      return new JsonResponse(['error' => 'session_id is required'], 400);
    }

    $stripe_secret = getenv('STRIPE_SECRET_KEY');
    if (!$stripe_secret) {
      return new JsonResponse(['error' => 'Payment not configured'], 503);
    }

    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions/' . urlencode($session_id));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
    curl_setopt($ch, CURLOPT_USERPWD, $stripe_secret . ':');
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code !== 200) {
      return new JsonResponse(['error' => 'Could not retrieve session'], $http_code);
    }

    $session = json_decode($response, TRUE);
    $payment_status = $session['payment_status'] ?? 'unpaid';
    $receipt_url = NULL;

    if ($payment_status === 'paid' && isset($session['payment_intent'])) {
      // Fetch payment intent to get charge receipt URL.
      $pi_id = $session['payment_intent'];
      $pi_ch = curl_init('https://api.stripe.com/v1/payment_intents/' . urlencode($pi_id) . '?expand[]=latest_charge');
      curl_setopt($pi_ch, CURLOPT_RETURNTRANSFER, TRUE);
      curl_setopt($pi_ch, CURLOPT_USERPWD, $stripe_secret . ':');
      $pi_response = curl_exec($pi_ch);
      curl_close($pi_ch);
      $pi_data = json_decode($pi_response, TRUE);
      $receipt_url = $pi_data['latest_charge']['receipt_url'] ?? NULL;
    }

    return new JsonResponse([
      'status' => $payment_status,
      'receipt_url' => $receipt_url,
    ]);
  }

  /**
   * Handles Stripe webhook events.
   *
   * POST /api/payments/webhook
   */
  public function webhook(Request $request): JsonResponse {
    $webhook_secret = getenv('STRIPE_WEBHOOK_SECRET');
    $payload = $request->getContent();
    $sig_header = $request->headers->get('stripe-signature');

    if ($webhook_secret && $sig_header) {
      // Verify webhook signature.
      if (!$this->verifyStripeSignature($payload, $sig_header, $webhook_secret)) {
        return new JsonResponse(['error' => 'Invalid signature'], 400);
      }
    }

    $event = json_decode($payload, TRUE);
    $event_type = $event['type'] ?? '';

    switch ($event_type) {
      case 'checkout.session.completed':
        $session_data = $event['data']['object'];
        $session_id = $session_data['id'];
        $application_id = $session_data['metadata']['application_id'] ?? NULL;

        // Mark the application as paid/submitted if not already.
        if ($application_id) {
          $this->handlePaymentComplete($session_id, $application_id);
        }
        break;

      case 'payment_intent.payment_failed':
        // Log failure but don't update application status.
        \Drupal::logger('newschool_payments')->warning(
          'Payment failed for session: @session',
          ['@session' => $event['data']['object']['id'] ?? 'unknown']
        );
        break;
    }

    return new JsonResponse(['received' => TRUE]);
  }

  /**
   * Handles payment completion for a checkout session.
   */
  protected function handlePaymentComplete(string $session_id, string $application_uuid): void {
    // Find the payment node by session ID.
    $nodes = $this->entityTypeManager->getStorage('node')->loadByProperties([
      'type' => 'payment',
      'field_stripe_session_id' => $session_id,
    ]);

    foreach ($nodes as $payment_node) {
      $payment_node->set('field_payment_status', 'paid');
      try {
        $payment_node->save();
      }
      catch (\Exception $e) {
        \Drupal::logger('newschool_payments')->error('Failed to update payment node: @msg', ['@msg' => $e->getMessage()]);
      }
    }
  }

  /**
   * Verifies a Stripe webhook signature.
   */
  protected function verifyStripeSignature(string $payload, string $sig_header, string $secret): bool {
    $parts = explode(',', $sig_header);
    $timestamp = NULL;
    $signatures = [];

    foreach ($parts as $part) {
      $part = trim($part);
      if (str_starts_with($part, 't=')) {
        $timestamp = substr($part, 2);
      }
      elseif (str_starts_with($part, 'v1=')) {
        $signatures[] = substr($part, 3);
      }
    }

    if (!$timestamp || empty($signatures)) {
      return FALSE;
    }

    $signed_payload = $timestamp . '.' . $payload;
    $expected = hash_hmac('sha256', $signed_payload, $secret);

    foreach ($signatures as $sig) {
      if (hash_equals($expected, $sig)) {
        return TRUE;
      }
    }

    return FALSE;
  }

}
