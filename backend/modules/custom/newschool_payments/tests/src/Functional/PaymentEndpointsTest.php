<?php

namespace Drupal\Tests\newschool_payments\Functional;

use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\BrowserTestBase;
use Drupal\newschool_payments\Service\StripeClientInterface;

/**
 * @group newschool_payments
 */
class PaymentEndpointsTest extends BrowserTestBase {

  protected static $modules = [
    'system',
    'user',
    'field',
    'node',
    'options',
    'datetime',
    'newschool_payments',
  ];

  protected $defaultTheme = 'stark';

  protected function setUp(): void {
    parent::setUp();

    if (!NodeType::load('application')) {
      NodeType::create([
        'type' => 'application',
        'name' => 'Application',
      ])->save();
    }

    // Ensure application nodes can reference payment nodes in test env.
    if (!FieldStorageConfig::loadByName('node', 'field_payment')) {
      FieldStorageConfig::create([
        'field_name' => 'field_payment',
        'entity_type' => 'node',
        'type' => 'entity_reference',
        'settings' => ['target_type' => 'node'],
      ])->save();
    }

    if (!FieldConfig::loadByName('node', 'application', 'field_payment')) {
      FieldConfig::create([
        'field_name' => 'field_payment',
        'entity_type' => 'node',
        'bundle' => 'application',
        'label' => 'Payment',
        'settings' => [
          'handler' => 'default:node',
          'handler_settings' => [
            'target_bundles' => ['payment' => 'payment'],
          ],
        ],
      ])->save();
    }

    $this->config('newschool_payments.settings')
      ->set('success_url', 'http://localhost:3000/pay/success')
      ->set('cancel_url', 'http://localhost:3000/pay/cancel')
      ->set('stripe_webhook_secret', 'whsec_test')
      ->set('fees', [
        'application' => [
          'amount_cents' => 10000,
          'currency' => 'CAD',
          'label' => 'Application Fee',
        ],
      ])
      ->save();
  }

  public function testCheckoutSessionEndpointCreatesPendingPayment(): void {
    $account = $this->drupalCreateUser([]);
    $this->drupalLogin($account);

    $application = Node::create([
      'type' => 'application',
      'title' => 'Test Application',
      'uid' => $account->id(),
    ]);
    $application->save();

    $stubStripe = new class() implements StripeClientInterface {
      public function createCheckoutSession(array $params, string $idempotencyKey): array {
        return [
          'id' => 'cs_test_123',
          'url' => 'https://checkout.stripe.test/session/cs_test_123',
          'payment_intent' => 'pi_test_123',
        ];
      }

      public function verifyWebhookEvent(string $rawPayload, string $signatureHeader): array {
        return json_decode($rawPayload, TRUE) ?: [];
      }

      public function getReceiptUrlForPaymentIntent(string $paymentIntentId): ?string {
        return 'https://pay.stripe.test/receipts/' . $paymentIntentId;
      }
    };
    $this->container->set('newschool_payments.stripe_client', $stubStripe);

    $client = $this->getSession()->getDriver()->getClient();
    $client->request('GET', '/session/token');
    $csrf = (string) $client->getResponse()->getContent();

    $client->request(
      'POST',
      '/api/payments/checkout-session',
      [],
      [],
      [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_CSRF_TOKEN' => $csrf,
      ],
      json_encode(['application_id' => (string) $application->id()], JSON_THROW_ON_ERROR)
    );

    $response = $client->getResponse();
    $this->assertSame(200, $response->getStatusCode());

    $decoded = json_decode($response->getContent() ?: '{}', TRUE);
    $this->assertSame('cs_test_123', $decoded['session_id'] ?? NULL);
    $this->assertNotEmpty($decoded['url'] ?? '');

    $application = Node::load((int) $application->id());
    $this->assertNotNull($application);
    $this->assertFalse($application->get('field_payment')->isEmpty());
    $this->assertSame(sprintf('Application %d', (int) $application->id()), (string) $application->label());

    $paymentId = (int) $application->get('field_payment')->target_id;
    $payment = Node::load($paymentId);
    $this->assertNotNull($payment);
    $this->assertSame('payment', $payment->bundle());
    $this->assertSame(sprintf('Payment for Application %d', (int) $application->id()), (string) $payment->label());
    $this->assertSame('pending', (string) $payment->get('field_status')->value);
    $this->assertSame('cs_test_123', (string) $payment->get('field_stripe_checkout_session_id')->value);
  }

  public function testWebhookMarksPaymentPaidAndKeepsApplicationReference(): void {
    $account = $this->drupalCreateUser([]);

    $application = Node::create([
      'type' => 'application',
      'title' => 'Webhook Application',
      'uid' => $account->id(),
    ]);
    $application->save();

    $payment = Node::create([
      'type' => 'payment',
      'title' => 'Payment Pending',
      'field_application' => ['target_id' => $application->id()],
      'field_payer' => ['target_id' => $account->id()],
      'field_amount_cents' => 10000,
      'field_currency' => 'CAD',
      'field_status' => 'pending',
      'field_stripe_checkout_session_id' => 'cs_test_abc',
    ]);
    $payment->save();

    $application->set('field_payment', ['target_id' => $payment->id()]);
    $application->save();

    $event = [
      'id' => 'evt_test_1',
      'type' => 'checkout.session.completed',
      'data' => [
        'object' => [
          'id' => 'cs_test_abc',
          'client_reference_id' => 'payment:' . $payment->id(),
          'payment_intent' => 'pi_test_abc',
          'amount_total' => 10000,
          'currency' => 'cad',
        ],
      ],
    ];

    $payload = json_encode($event, JSON_THROW_ON_ERROR);
    $timestamp = time();
    $signature = hash_hmac('sha256', $timestamp . '.' . $payload, 'whsec_test');

    $client = $this->getSession()->getDriver()->getClient();
    $client->request(
      'POST',
      '/api/payments/stripe/webhook',
      [],
      [],
      [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_STRIPE_SIGNATURE' => 't=' . $timestamp . ',v1=' . $signature,
      ],
      $payload
    );

    $response = $client->getResponse();
    $this->assertSame(200, $response->getStatusCode());

    $payment = Node::load((int) $payment->id());
    $application = Node::load((int) $application->id());

    $this->assertSame('paid', (string) $payment->get('field_status')->value);
    $this->assertSame('pi_test_abc', (string) $payment->get('field_stripe_payment_intent_id')->value);
    $this->assertSame('evt_test_1', (string) $payment->get('field_last_stripe_event_id')->value);
    $this->assertSame((int) $payment->id(), (int) $application->get('field_payment')->target_id);
    $this->assertSame('submitted', (string) $application->get('field_status')->value);
    $this->assertNotEmpty((string) $application->get('field_submitted_at')->value);
  }

}
