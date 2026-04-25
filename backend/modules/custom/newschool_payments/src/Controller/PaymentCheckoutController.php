<?php

namespace Drupal\newschool_payments\Controller;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\newschool_payments\Service\StripeClientInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class PaymentCheckoutController extends ControllerBase {

  public function __construct(
    private readonly EntityTypeManagerInterface $nodeEntityTypeManager,
    private readonly AccountProxyInterface $requestUser,
    private readonly ConfigFactoryInterface $paymentConfigFactory,
    private readonly StripeClientInterface $paymentStripeClient,
  ) {}

  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('entity_type.manager'),
      $container->get('current_user'),
      $container->get('config.factory'),
      $container->get('newschool_payments.stripe_client'),
    );
  }

  public function createCheckoutSession(Request $request): JsonResponse {
    $payload = json_decode($request->getContent(), TRUE);
    if (!is_array($payload) || empty($payload['application_id'])) {
      return new JsonResponse(['message' => 'application_id is required.'], 400);
    }

    $application = $this->loadApplicationNode((string) $payload['application_id']);
    if (!$application) {
      return new JsonResponse(['message' => 'Application not found.'], 404);
    }

    if (!$this->canPayApplication($application)) {
      return new JsonResponse(['message' => 'You are not allowed to pay this application.'], 403);
    }

    $fee = $this->getFeeForBundle($application->bundle());
    if ($fee === NULL) {
      return new JsonResponse(['message' => 'No fee configured for this application type.'], 400);
    }

    $nodeStorage = $this->nodeEntityTypeManager->getStorage('node');

    if ($application->hasField('field_payment') && !$application->get('field_payment')->isEmpty()) {
      $existingPayment = $application->get('field_payment')->entity;
      if ($existingPayment && $existingPayment->bundle() === 'payment') {
        $status = (string) $existingPayment->get('field_status')->value;
        if ($status === 'paid') {
          return new JsonResponse(['message' => 'Application fee is already paid.'], 409);
        }
      }
    }

    $payment = $nodeStorage->create([
      'type' => 'payment',
      'title' => sprintf('Payment for application %d', (int) $application->id()),
      'field_application' => ['target_id' => $application->id()],
      'field_payer' => ['target_id' => $this->requestUser->id()],
      'field_amount_cents' => (int) $fee['amount_cents'],
      'field_currency' => strtoupper((string) $fee['currency']),
      'field_status' => 'pending',
      'status' => 1,
    ]);
    $payment->save();

    $application->set('field_payment', ['target_id' => $payment->id()]);
    $application->save();

    $settings = $this->paymentConfigFactory->get('newschool_payments.settings');
    $successUrl = (string) $settings->get('success_url');
    $cancelUrl = (string) $settings->get('cancel_url');

    if ($successUrl === '' || $cancelUrl === '') {
      $payment->set('field_status', 'failed');
      $payment->save();
      return new JsonResponse(['message' => 'Stripe success/cancel URLs are not configured.'], 500);
    }

    if (!str_contains($successUrl, '{CHECKOUT_SESSION_ID}')) {
      $separator = str_contains($successUrl, '?') ? '&' : '?';
      $successUrl .= $separator . 'session_id={CHECKOUT_SESSION_ID}';
    }

    $params = [
      'mode' => 'payment',
      'success_url' => $successUrl,
      'cancel_url' => $cancelUrl,
      'client_reference_id' => 'payment:' . $payment->id(),
      'line_items[0][quantity]' => 1,
      'line_items[0][price_data][currency]' => strtolower((string) $fee['currency']),
      'line_items[0][price_data][unit_amount]' => (int) $fee['amount_cents'],
      'line_items[0][price_data][product_data][name]' => (string) $fee['label'],
    ];

    try {
      $session = $this->paymentStripeClient->createCheckoutSession($params, 'checkout_session_payment_' . $payment->id());
    }
    catch (\Throwable $throwable) {
      $payment->set('field_status', 'failed');
      $payment->save();
      return new JsonResponse(['message' => 'Unable to create checkout session. Please try again.'], 502);
    }

    if (empty($session['id']) || empty($session['url'])) {
      $payment->set('field_status', 'failed');
      $payment->save();
      return new JsonResponse(['message' => 'Stripe did not return a checkout URL.'], 502);
    }

    $payment->set('field_stripe_checkout_session_id', (string) $session['id']);
    if (!empty($session['payment_intent']) && is_string($session['payment_intent'])) {
      $payment->set('field_stripe_payment_intent_id', $session['payment_intent']);
    }
    $payment->save();

    return new JsonResponse([
      'url' => (string) $session['url'],
      'payment_id' => (int) $payment->id(),
      'session_id' => (string) $session['id'],
    ]);
  }

  public function getCheckoutStatus(Request $request): JsonResponse {
    $sessionId = trim((string) $request->query->get('session_id', ''));
    if ($sessionId === '') {
      return new JsonResponse(['message' => 'session_id is required.'], 400);
    }

    $storage = $this->nodeEntityTypeManager->getStorage('node');
    $matches = $storage->loadByProperties([
      'type' => 'payment',
      'field_stripe_checkout_session_id' => $sessionId,
    ]);
    $payment = $matches ? reset($matches) : NULL;

    if (!$payment) {
      return new JsonResponse([
        'payment_found' => FALSE,
        'payment_confirmed' => FALSE,
        'application_submitted' => FALSE,
        'message' => 'Payment not found for this session.',
      ], 404);
    }

    if (!$this->canViewPayment($payment)) {
      return new JsonResponse(['message' => 'You are not allowed to view this payment.'], 403);
    }

    $paymentStatus = (string) $payment->get('field_status')->value;
    $applicationSubmitted = FALSE;
    $applicationId = NULL;
    $receiptUrl = NULL;

    if ($payment->hasField('field_receipt_url') && !$payment->get('field_receipt_url')->isEmpty()) {
      $candidateReceiptUrl = (string) $payment->get('field_receipt_url')->value;
      if (
        $candidateReceiptUrl !== ''
        && filter_var($candidateReceiptUrl, FILTER_VALIDATE_URL) !== FALSE
      ) {
        $scheme = strtolower((string) parse_url($candidateReceiptUrl, PHP_URL_SCHEME));
        if ($scheme !== 'http' && $scheme !== 'https') {
          $candidateReceiptUrl = '';
        }
      }

      if ($candidateReceiptUrl !== '') {
        $receiptUrl = $candidateReceiptUrl;
      }
    }

    if (!$payment->get('field_application')->isEmpty()) {
      $application = $payment->get('field_application')->entity;
      if ($application) {
        $applicationId = (int) $application->id();
        if ($application->hasField('field_status')) {
          $applicationSubmitted = ((string) $application->get('field_status')->value) === 'submitted';
        }
      }
    }

    return new JsonResponse([
      'payment_found' => TRUE,
      'payment_confirmed' => ($paymentStatus === 'paid' && $applicationSubmitted),
      'application_submitted' => $applicationSubmitted,
      'payment_status' => $paymentStatus,
      'payment_id' => (int) $payment->id(),
      'application_id' => $applicationId,
      'confirmation_number' => sprintf('PAY-%06d', (int) $payment->id()),
      'receipt_url' => $receiptUrl,
    ]);
  }

  private function loadApplicationNode(string $identifier): ?\Drupal\node\NodeInterface {
    $storage = $this->nodeEntityTypeManager->getStorage('node');
    $candidate = ctype_digit($identifier)
      ? $storage->load((int) $identifier)
      : NULL;

    if ($candidate && $candidate->hasField('field_payment')) {
      return $candidate;
    }

    if (!ctype_digit($identifier)) {
      $matches = $storage->loadByProperties(['uuid' => $identifier]);
      $node = $matches ? reset($matches) : NULL;
      if ($node && $node->hasField('field_payment')) {
        return $node;
      }
    }

    return NULL;
  }

  private function canPayApplication(\Drupal\node\NodeInterface $application): bool {
    if ($application->getOwnerId() === (int) $this->requestUser->id()) {
      return TRUE;
    }

    if ($application->access('update', $this->requestUser, TRUE)->isAllowed()) {
      return TRUE;
    }

    return $this->requestUser->hasPermission('administer nodes');
  }

  private function canViewPayment(\Drupal\node\NodeInterface $payment): bool {
    if (!$payment->hasField('field_payer') || $payment->get('field_payer')->isEmpty()) {
      return $this->requestUser->hasPermission('administer nodes');
    }

    if ((int) $payment->get('field_payer')->target_id === (int) $this->requestUser->id()) {
      return TRUE;
    }

    if (!$payment->get('field_application')->isEmpty()) {
      $application = $payment->get('field_application')->entity;
      if ($application && $this->canPayApplication($application)) {
        return TRUE;
      }
    }

    return $this->requestUser->hasPermission('administer nodes');
  }

  /**
   * @return array<string, mixed>|null
   */
  private function getFeeForBundle(string $bundle): ?array {
    $fees = $this->paymentConfigFactory->get('newschool_payments.settings')->get('fees') ?: [];
    if (!isset($fees[$bundle]) || !is_array($fees[$bundle])) {
      return NULL;
    }

    return [
      'amount_cents' => (int) ($fees[$bundle]['amount_cents'] ?? 0),
      'currency' => strtoupper((string) ($fees[$bundle]['currency'] ?? 'CAD')),
      'label' => (string) ($fees[$bundle]['label'] ?? 'Application Fee'),
    ];
  }

}
