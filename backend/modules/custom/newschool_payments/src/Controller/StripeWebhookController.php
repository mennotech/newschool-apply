<?php

namespace Drupal\newschool_payments\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Datetime\DrupalDateTime;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\newschool_payments\Service\StripeClientInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class StripeWebhookController extends ControllerBase {

  public function __construct(
    private readonly EntityTypeManagerInterface $nodeEntityTypeManager,
    private readonly StripeClientInterface $paymentStripeClient,
  ) {}

  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('entity_type.manager'),
      $container->get('newschool_payments.stripe_client'),
    );
  }

  public function handle(Request $request): JsonResponse {
    $rawPayload = (string) $request->getContent();
    $signatureHeader = (string) $request->headers->get('Stripe-Signature', '');

    try {
      $event = $this->paymentStripeClient->verifyWebhookEvent($rawPayload, $signatureHeader);
    }
    catch (\Throwable) {
      return new JsonResponse(['message' => 'Invalid Stripe signature.'], 400);
    }

    if (($event['type'] ?? '') !== 'checkout.session.completed') {
      return new JsonResponse(['received' => TRUE], 200);
    }

    $eventId = (string) ($event['id'] ?? '');
    $object = $event['data']['object'] ?? [];
    if (!is_array($object)) {
      return new JsonResponse(['received' => TRUE], 200);
    }

    $sessionId = (string) ($object['id'] ?? '');
    $clientReferenceId = (string) ($object['client_reference_id'] ?? '');

    $payment = $this->findPayment($clientReferenceId, $sessionId);
    if (!$payment) {
      return new JsonResponse(['received' => TRUE], 200);
    }

    if ($eventId !== '' && (string) $payment->get('field_last_stripe_event_id')->value === $eventId) {
      return new JsonResponse(['received' => TRUE], 200);
    }

    if ((string) $payment->get('field_status')->value === 'paid') {
      if ($eventId !== '') {
        $payment->set('field_last_stripe_event_id', $eventId);
        $payment->save();
      }
      return new JsonResponse(['received' => TRUE], 200);
    }

    if (!$this->amountAndCurrencyMatch($payment, $object)) {
      $payment->set('field_status', 'failed');
      if ($eventId !== '') {
        $payment->set('field_last_stripe_event_id', $eventId);
      }
      $payment->save();
      return new JsonResponse(['received' => TRUE], 200);
    }

    $paymentIntentId = '';
    if (!empty($object['payment_intent']) && is_string($object['payment_intent'])) {
      $paymentIntentId = $object['payment_intent'];
    }
    elseif (!$payment->get('field_stripe_payment_intent_id')->isEmpty()) {
      $paymentIntentId = (string) $payment->get('field_stripe_payment_intent_id')->value;
    }

    $receiptUrl = $paymentIntentId !== ''
      ? $this->paymentStripeClient->getReceiptUrlForPaymentIntent($paymentIntentId)
      : NULL;

    $payment->set('field_status', 'paid');
    $payment->set('field_paid_at', (new DrupalDateTime('now', new \DateTimeZone('UTC')))->format('Y-m-d\\TH:i:s'));
    if ($paymentIntentId !== '') {
      $payment->set('field_stripe_payment_intent_id', $paymentIntentId);
    }
    if ($sessionId !== '') {
      $payment->set('field_stripe_checkout_session_id', $sessionId);
    }
    if ($payment->hasField('field_receipt_url') && is_string($receiptUrl) && $receiptUrl !== '') {
      $payment->set('field_receipt_url', $receiptUrl);
    }
    if ($eventId !== '') {
      $payment->set('field_last_stripe_event_id', $eventId);
    }
    $payment->save();

    if (!$payment->get('field_application')->isEmpty()) {
      $application = $payment->get('field_application')->entity;
      if ($application && $application->hasField('field_payment')) {
        $linkedPayment = $application->get('field_payment')->target_id;
        if ((int) $linkedPayment !== (int) $payment->id()) {
          $application->set('field_payment', ['target_id' => $payment->id()]);
        }

        if ($application->hasField('field_status')) {
          $application->set('field_status', 'submitted');
        }

        if ($application->hasField('field_submitted_at') && $application->get('field_submitted_at')->isEmpty()) {
          $application->set('field_submitted_at', (new DrupalDateTime('now', new \DateTimeZone('UTC')))->format('Y-m-d\\TH:i:s'));
        }

        $application->save();
      }
    }

    return new JsonResponse(['received' => TRUE], 200);
  }

  private function findPayment(string $clientReferenceId, string $sessionId): ?\Drupal\node\NodeInterface {
    $storage = $this->nodeEntityTypeManager->getStorage('node');

    if (str_starts_with($clientReferenceId, 'payment:')) {
      $nid = (int) substr($clientReferenceId, strlen('payment:'));
      if ($nid > 0) {
        $candidate = $storage->load($nid);
        if ($candidate && $candidate->bundle() === 'payment') {
          return $candidate;
        }
      }
    }

    if ($sessionId !== '') {
      $matches = $storage->loadByProperties([
        'type' => 'payment',
        'field_stripe_checkout_session_id' => $sessionId,
      ]);
      $payment = $matches ? reset($matches) : NULL;
      if ($payment) {
        return $payment;
      }
    }

    return NULL;
  }

  private function amountAndCurrencyMatch(\Drupal\node\NodeInterface $payment, array $sessionObject): bool {
    if (isset($sessionObject['amount_total'])) {
      $amountTotal = (int) $sessionObject['amount_total'];
      if ($amountTotal !== (int) $payment->get('field_amount_cents')->value) {
        return FALSE;
      }
    }

    if (!empty($sessionObject['currency'])) {
      $currency = strtoupper((string) $sessionObject['currency']);
      if ($currency !== strtoupper((string) $payment->get('field_currency')->value)) {
        return FALSE;
      }
    }

    return TRUE;
  }

}
