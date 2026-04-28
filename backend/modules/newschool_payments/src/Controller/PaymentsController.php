<?php

namespace Drupal\newschool_payments\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\node\Entity\Node;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Controller for payment API endpoints.
 *
 * All business logic (fee resolution, Stripe session creation, webhook
 * verification) lives here in the backend. The React frontend only passes
 * data to these endpoints and renders the responses.
 */
class PaymentsController extends ControllerBase {

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * Constructs a PaymentsController.
   *
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   Current user proxy.
   */
  public function __construct(AccountProxyInterface $current_user) {
    $this->currentUser = $current_user;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static($container->get('current_user'));
  }

  /**
   * GET /api/session/info
   *
   * Returns current user data and a fresh logout token for the active session.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Session info payload.
   */
  public function sessionInfo(): JsonResponse {
    if ($this->currentUser->isAnonymous()) {
      throw new AccessDeniedHttpException('Authentication required.');
    }

    /** @var \Drupal\user\UserInterface|null $account */
    $account = \Drupal\user\Entity\User::load($this->currentUser->id());

    return new JsonResponse([
      'logout_token' => \Drupal::csrfToken()->get('logout'),
      'current_user' => [
        'uid' => (int) $this->currentUser->id(),
        'name' => $this->currentUser->getAccountName(),
        'mail' => $account ? $account->getEmail() : '',
        'roles' => array_values($this->currentUser->getRoles()),
      ],
    ], 200);
  }

  /**
   * POST /api/payments/checkout-session
   *
   * Creates a Stripe Checkout session for an application fee. Requires an
   * authenticated session and a valid CSRF token in the X-CSRF-Token header.
   *
   * Request body (JSON):
   *   { "application_id": <nid or uuid> }
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The incoming request.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   JSON response with checkout URL or error details.
   */
  public function createCheckoutSession(Request $request): JsonResponse {
    if ($this->currentUser->isAnonymous()) {
      throw new AccessDeniedHttpException('Authentication required.');
    }

    $body = json_decode($request->getContent(), TRUE);
    if (empty($body['application_id'])) {
      throw new BadRequestHttpException('Missing required field: application_id.');
    }

    $application_id = $body['application_id'];

    // Load the application node.
    $node = is_numeric($application_id)
      ? Node::load($application_id)
      : $this->loadNodeByUuid($application_id);

    if (!$node) {
      return new JsonResponse(['error' => 'Application not found.'], 404);
    }

    // Verify ownership: only the application owner or admins may pay.
    if ($node->getOwnerId() !== (int) $this->currentUser->id() && !$this->currentUser->hasPermission('administer nodes')) {
      throw new AccessDeniedHttpException('You may not pay for this application.');
    }

    $config = $this->config('newschool_payments.settings');
    $stripe_key = getenv('STRIPE_SECRET_KEY') ?: $config->get('stripe_secret_key');

    if (empty($stripe_key)) {
      return new JsonResponse([
        'error' => 'Payment processing is not configured. Contact the administrator.',
      ], 503);
    }

    // Check for an existing paid payment.
    if ($node->hasField('field_payment') && !$node->get('field_payment')->isEmpty()) {
      $payment_ref = $node->get('field_payment')->first();
      if ($payment_ref) {
        $existing_payment = $payment_ref->entity;
        if ($existing_payment && $existing_payment->hasField('field_status')) {
          $status = $existing_payment->get('field_status')->value;
          if ($status === 'paid') {
            return new JsonResponse(['error' => 'Application fee has already been paid.'], 409);
          }
        }
      }
    }

    // Resolve fee from configuration.
    $bundle = $node->bundle();
    $fee_map = $config->get('fee_map') ?? [];
    $fee_config = $fee_map[$bundle] ?? NULL;

    if (empty($fee_config) || empty($fee_config['enabled'])) {
      return new JsonResponse([
        'error' => "No payment fee is configured for application type: {$bundle}.",
      ], 422);
    }

    $amount_cents = (int) $fee_config['amount_cents'];
    $currency     = $fee_config['currency'] ?? 'cad';
    $fee_label    = $fee_config['label'] ?? 'Application Fee';

    // Create a new payment node.
    $payment = Node::create([
      'type'         => 'payment',
      'title'        => "Payment for application {$node->id()}",
      'uid'          => $this->currentUser->id(),
      'field_application' => [['target_id' => $node->id()]],
      'field_payer'       => [['target_id' => $this->currentUser->id()]],
      'field_amount_cents' => $amount_cents,
      'field_currency'     => $currency,
      'field_status'       => 'pending',
    ]);
    $payment->save();

    $success_url = $config->get('checkout_success_url') ?: 'http://localhost:3000/application/payment-success?session_id={CHECKOUT_SESSION_ID}';
    $cancel_url  = $config->get('checkout_cancel_url') ?: 'http://localhost:3000/application/payment-cancel';

    // Build Stripe Checkout session via HTTP (no Stripe SDK dependency).
    $stripe_response = $this->callStripeApi(
      'POST',
      'https://api.stripe.com/v1/checkout/sessions',
      $stripe_key,
      [
        'payment_method_types' => ['card'],
        'line_items'           => [[
          'price_data' => [
            'currency'     => $currency,
            'unit_amount'  => $amount_cents,
            'product_data' => ['name' => $fee_label],
          ],
          'quantity' => 1,
        ]],
        'mode'                  => 'payment',
        'success_url'           => $success_url,
        'cancel_url'            => $cancel_url,
        'client_reference_id'   => "payment:{$payment->id()}",
      ]
    );

    if (!isset($stripe_response['id'])) {
      $payment->set('field_status', 'failed')->save();
      return new JsonResponse(['error' => 'Failed to create Stripe Checkout session.'], 502);
    }

    // Persist the Stripe session ID on the payment record.
    $payment->set('field_stripe_checkout_session_id', $stripe_response['id'])->save();

    // Link the new payment to the application.
    if ($node->hasField('field_payment')) {
      $node->set('field_payment', [['target_id' => $payment->id()]]);
      $node->save();
    }

    return new JsonResponse([
      'checkout_url' => $stripe_response['url'],
      'session_id'   => $stripe_response['id'],
      'payment_nid'  => $payment->id(),
    ], 200);
  }

  /**
   * GET /api/payments/checkout-status?session_id={id}
   *
   * Returns the current payment status for a Stripe checkout session. Access
   * is restricted to the original payer, admins, or applicant reviewers.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The incoming request.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Payment status details.
   */
  public function checkoutStatus(Request $request): JsonResponse {
    if ($this->currentUser->isAnonymous()) {
      throw new AccessDeniedHttpException('Authentication required.');
    }

    $session_id = $request->query->get('session_id');
    if (empty($session_id)) {
      throw new BadRequestHttpException('Missing required query parameter: session_id.');
    }

    // Find the payment node with this Stripe session ID.
    $nids = \Drupal::entityQuery('node')
      ->condition('type', 'payment')
      ->condition('field_stripe_checkout_session_id', $session_id)
      ->accessCheck(FALSE)
      ->execute();

    if (empty($nids)) {
      return new JsonResponse(['error' => 'Payment not found.'], 404);
    }

    $payment = Node::load(reset($nids));
    if (!$payment) {
      return new JsonResponse(['error' => 'Payment not found.'], 404);
    }

    // Enforce visibility: payer, admin, or reviewer.
    $payer_id = $payment->hasField('field_payer') ? $payment->get('field_payer')->target_id : NULL;
    $is_payer = $payer_id && ($payer_id == $this->currentUser->id());
    $is_admin = $this->currentUser->hasPermission('administer nodes');
    $is_reviewer = $this->currentUser->hasRole('applicant_reviewer');

    if (!$is_payer && !$is_admin && !$is_reviewer) {
      throw new AccessDeniedHttpException('Access denied.');
    }

    $status       = $payment->hasField('field_status') ? $payment->get('field_status')->value : 'unknown';
    $receipt_url  = $payment->hasField('field_receipt_url') ? $payment->get('field_receipt_url')->value : NULL;
    $application_id = NULL;

    if ($payment->hasField('field_application') && !$payment->get('field_application')->isEmpty()) {
      $application_id = (int) $payment->get('field_application')->target_id;
    }

    return new JsonResponse([
      'status'         => $status,
      'payment_nid'    => (int) $payment->id(),
      'application_id' => $application_id,
      'receipt_url'    => $receipt_url,
    ], 200);
  }

  /**
   * POST /api/payments/stripe/webhook
   *
   * Handles Stripe webhook events. The endpoint is public but verifies the
   * Stripe-Signature header before processing.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The incoming request.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   Acknowledgement response.
   */
  public function stripeWebhook(Request $request): JsonResponse {
    $config = $this->config('newschool_payments.settings');
    $webhook_secret = getenv('STRIPE_WEBHOOK_SECRET') ?: $config->get('stripe_webhook_secret');

    $payload   = $request->getContent();
    $signature = $request->headers->get('Stripe-Signature', '');

    if (empty($webhook_secret)) {
      // No secret configured — reject all webhook calls in this state.
      return new JsonResponse(['error' => 'Webhook secret not configured.'], 400);
    }

    if (!$this->verifyStripeSignature($payload, $signature, $webhook_secret)) {
      return new JsonResponse(['error' => 'Invalid Stripe signature.'], 400);
    }

    $event = json_decode($payload, TRUE);
    if (empty($event['type'])) {
      return new JsonResponse(['error' => 'Malformed event payload.'], 400);
    }

    // Only process checkout completion events; acknowledge all others silently.
    if ($event['type'] !== 'checkout.session.completed') {
      return new JsonResponse(['received' => TRUE], 200);
    }

    $session = $event['data']['object'] ?? [];
    $event_id = $event['id'] ?? '';

    $payment = $this->resolvePaymentNode($session);
    if (!$payment) {
      return new JsonResponse(['received' => TRUE], 200);
    }

    // Idempotency: skip if this event was already applied.
    $last_event_id = $payment->hasField('field_last_stripe_event_id')
      ? $payment->get('field_last_stripe_event_id')->value
      : '';

    if ($last_event_id === $event_id) {
      return new JsonResponse(['received' => TRUE], 200);
    }

    // Mark as paid.
    $payment->set('field_status', 'paid');
    $payment->set('field_last_stripe_event_id', $event_id);

    if (!empty($session['payment_intent'])) {
      $payment->set('field_stripe_payment_intent_id', $session['payment_intent']);
    }

    $payment->set('field_paid_at', date('Y-m-d\TH:i:s'));

    if (!empty($session['receipt_url'])) {
      $payment->set('field_receipt_url', $session['receipt_url']);
    }

    $payment->save();

    // Mark the linked application as submitted.
    if ($payment->hasField('field_application') && !$payment->get('field_application')->isEmpty()) {
      $app_node = $payment->get('field_application')->entity;
      if ($app_node && $app_node->hasField('field_application_status')) {
        $app_node->set('field_application_status', 'submitted');
        if ($app_node->hasField('field_submitted_at')) {
          $app_node->set('field_submitted_at', date('Y-m-d'));
        }
        $app_node->save();
      }
    }

    return new JsonResponse(['received' => TRUE], 200);
  }

  /**
   * Resolves a payment node from a Stripe Checkout session object.
   *
   * Tries client_reference_id first, falls back to the stored session ID.
   *
   * @param array $session
   *   Stripe checkout session data.
   *
   * @return \Drupal\node\Entity\Node|null
   *   The payment node, or NULL if not found.
   */
  protected function resolvePaymentNode(array $session): ?Node {
    // Primary: client_reference_id in the form "payment:{nid}".
    $client_ref = $session['client_reference_id'] ?? '';
    if (str_starts_with($client_ref, 'payment:')) {
      $nid = (int) substr($client_ref, strlen('payment:'));
      $node = Node::load($nid);
      if ($node && $node->bundle() === 'payment') {
        return $node;
      }
    }

    // Fallback: find by stored Stripe session ID.
    $stripe_session_id = $session['id'] ?? '';
    if ($stripe_session_id) {
      $nids = \Drupal::entityQuery('node')
        ->condition('type', 'payment')
        ->condition('field_stripe_checkout_session_id', $stripe_session_id)
        ->accessCheck(FALSE)
        ->execute();

      if (!empty($nids)) {
        return Node::load(reset($nids));
      }
    }

    return NULL;
  }

  /**
   * Verifies a Stripe webhook signature.
   *
   * Implements the Stripe v1 signature scheme without the Stripe PHP SDK to
   * avoid adding an unapproved dependency.
   *
   * @param string $payload
   *   Raw request body.
   * @param string $signature_header
   *   Value of the Stripe-Signature header.
   * @param string $secret
   *   Webhook signing secret.
   *
   * @return bool
   *   TRUE if the signature is valid.
   */
  protected function verifyStripeSignature(string $payload, string $signature_header, string $secret): bool {
    $parts = [];
    foreach (explode(',', $signature_header) as $part) {
      [$k, $v] = array_pad(explode('=', $part, 2), 2, '');
      $parts[$k] = $v;
    }

    if (empty($parts['t']) || empty($parts['v1'])) {
      return FALSE;
    }

    $signed_payload = $parts['t'] . '.' . $payload;
    $expected = hash_hmac('sha256', $signed_payload, $secret);

    return hash_equals($expected, $parts['v1']);
  }

  /**
   * Makes a Stripe API call using PHP's built-in HTTP stream wrappers.
   *
   * No external HTTP library is used to stay within the dependency policy.
   *
   * @param string $method
   *   HTTP method (GET or POST).
   * @param string $url
   *   Stripe API URL.
   * @param string $secret_key
   *   Stripe secret key.
   * @param array $data
   *   Request parameters.
   *
   * @return array
   *   Decoded JSON response.
   */
  protected function callStripeApi(string $method, string $url, string $secret_key, array $data = []): array {
    $encoded = $this->stripeFormEncode($data);

    $context = stream_context_create([
      'http' => [
        'method'  => $method,
        'header'  => implode("\r\n", [
          'Authorization: Bearer ' . $secret_key,
          'Content-Type: application/x-www-form-urlencoded',
          'Content-Length: ' . strlen($encoded),
          'Stripe-Version: 2023-10-16',
        ]),
        'content'         => $encoded,
        'ignore_errors'   => TRUE,
        'timeout'         => 30,
      ],
    ]);

    $response = @file_get_contents($url, FALSE, $context);
    if ($response === FALSE) {
      return [];
    }

    return json_decode($response, TRUE) ?? [];
  }

  /**
   * Recursively form-encodes an array for the Stripe API.
   *
   * @param array $data
   *   Data to encode.
   * @param string $prefix
   *   Key prefix for nested arrays.
   *
   * @return string
   *   URL-encoded string.
   */
  protected function stripeFormEncode(array $data, string $prefix = ''): string {
    $parts = [];
    foreach ($data as $key => $value) {
      $full_key = $prefix ? "{$prefix}[{$key}]" : $key;
      if (is_array($value)) {
        $parts[] = $this->stripeFormEncode($value, $full_key);
      }
      else {
        $parts[] = urlencode($full_key) . '=' . urlencode((string) $value);
      }
    }
    return implode('&', $parts);
  }

  /**
   * Loads a node by UUID.
   *
   * @param string $uuid
   *   Node UUID.
   *
   * @return \Drupal\node\Entity\Node|null
   *   Loaded node or NULL.
   */
  protected function loadNodeByUuid(string $uuid): ?Node {
    $entities = \Drupal::entityTypeManager()
      ->getStorage('node')
      ->loadByProperties(['uuid' => $uuid]);
    return $entities ? reset($entities) : NULL;
  }

}
