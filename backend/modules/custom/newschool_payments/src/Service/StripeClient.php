<?php

namespace Drupal\newschool_payments\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use Psr\Log\LoggerAwareTrait;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class StripeClient implements StripeClientInterface {

  use LoggerAwareTrait;

  private const STRIPE_API_BASE = 'https://api.stripe.com/v1';

  public function __construct(
    private readonly ClientInterface $httpClient,
    private readonly ConfigFactoryInterface $configFactory,
    \Drupal\Core\Logger\LoggerChannelFactoryInterface $loggerFactory,
  ) {
    $this->setLogger($loggerFactory->get('newschool_payments'));
  }

  /**
   * {@inheritdoc}
   */
  public function createCheckoutSession(array $params, string $idempotencyKey): array {
    $secretKey = $this->getStripeSecretKey();
    if ($secretKey === '') {
      throw new \RuntimeException('Stripe secret key is not configured.');
    }

    try {
      $response = $this->httpClient->request('POST', self::STRIPE_API_BASE . '/checkout/sessions', [
        'auth' => [$secretKey, ''],
        'headers' => [
          'Idempotency-Key' => $idempotencyKey,
        ],
        'form_params' => $params,
      ]);
      $decoded = json_decode((string) $response->getBody(), TRUE);
      if (!is_array($decoded)) {
        throw new \RuntimeException('Unexpected Stripe response format.');
      }
      return $decoded;
    }
    catch (GuzzleException $exception) {
      $this->logger?->error('Failed creating Stripe Checkout Session: @message', [
        '@message' => $exception->getMessage(),
      ]);
      throw new \RuntimeException('Unable to create checkout session right now.');
    }
  }

  /**
   * {@inheritdoc}
   */
  public function verifyWebhookEvent(string $rawPayload, string $signatureHeader): array {
    $secret = $this->getStripeWebhookSecret();
    if ($secret === '') {
      throw new BadRequestHttpException('Stripe webhook secret is not configured.');
    }

    $parts = [];
    foreach (explode(',', $signatureHeader) as $part) {
      [$key, $value] = array_pad(explode('=', trim($part), 2), 2, NULL);
      if ($key !== NULL && $value !== NULL) {
        $parts[$key] = $value;
      }
    }

    if (empty($parts['t']) || empty($parts['v1'])) {
      throw new BadRequestHttpException('Missing Stripe signature values.');
    }

    $timestamp = (int) $parts['t'];
    $signedPayload = $timestamp . '.' . $rawPayload;
    $expected = hash_hmac('sha256', $signedPayload, $secret);

    if (!hash_equals($expected, $parts['v1'])) {
      throw new BadRequestHttpException('Invalid Stripe signature.');
    }

    // Reject stale replay attempts older than 5 minutes.
    if (abs(time() - $timestamp) > 300) {
      throw new BadRequestHttpException('Expired Stripe signature timestamp.');
    }

    $decoded = json_decode($rawPayload, TRUE);
    if (!is_array($decoded)) {
      throw new BadRequestHttpException('Invalid JSON payload.');
    }

    return $decoded;
  }

  /**
   * {@inheritdoc}
   */
  public function getReceiptUrlForPaymentIntent(string $paymentIntentId): ?string {
    if ($paymentIntentId === '') {
      return NULL;
    }

    $secretKey = $this->getStripeSecretKey();
    if ($secretKey === '') {
      return NULL;
    }

    try {
      $intentResponse = $this->httpClient->request('GET', self::STRIPE_API_BASE . '/payment_intents/' . rawurlencode($paymentIntentId), [
        'auth' => [$secretKey, ''],
        'query' => [
          'expand[]' => 'latest_charge',
        ],
      ]);
      $intent = json_decode((string) $intentResponse->getBody(), TRUE);
      if (!is_array($intent)) {
        return NULL;
      }

      $latestCharge = $intent['latest_charge'] ?? NULL;
      if (is_array($latestCharge)) {
        $receiptUrl = $latestCharge['receipt_url'] ?? NULL;
        return $this->normalizeReceiptUrl($receiptUrl);
      }

      if (is_string($latestCharge) && $latestCharge !== '') {
        $chargeResponse = $this->httpClient->request('GET', self::STRIPE_API_BASE . '/charges/' . rawurlencode($latestCharge), [
          'auth' => [$secretKey, ''],
        ]);
        $charge = json_decode((string) $chargeResponse->getBody(), TRUE);
        if (!is_array($charge)) {
          return NULL;
        }

        $receiptUrl = $charge['receipt_url'] ?? NULL;
        return $this->normalizeReceiptUrl($receiptUrl);
      }
    }
    catch (GuzzleException $exception) {
      $this->logger?->warning('Failed retrieving Stripe receipt URL for payment intent @intent: @message', [
        '@intent' => $paymentIntentId,
        '@message' => $exception->getMessage(),
      ]);
    }

    return NULL;
  }

  private function getStripeSecretKey(): string {
    $env = getenv('STRIPE_SECRET_KEY');
    if (is_string($env) && $env !== '') {
      return $env;
    }

    return (string) $this->configFactory->get('newschool_payments.settings')->get('stripe_secret_key');
  }

  private function getStripeWebhookSecret(): string {
    $env = getenv('STRIPE_WEBHOOK_SECRET');
    if (is_string($env) && $env !== '') {
      return $env;
    }

    return (string) $this->configFactory->get('newschool_payments.settings')->get('stripe_webhook_secret');
  }

  private function normalizeReceiptUrl(mixed $receiptUrl): ?string {
    if (!is_string($receiptUrl) || $receiptUrl === '') {
      return NULL;
    }

    if (filter_var($receiptUrl, FILTER_VALIDATE_URL) === FALSE) {
      return NULL;
    }

    $scheme = parse_url($receiptUrl, PHP_URL_SCHEME);
    if (!is_string($scheme)) {
      return NULL;
    }

    $scheme = strtolower($scheme);
    if ($scheme !== 'https' && $scheme !== 'http') {
      return NULL;
    }

    return $receiptUrl;
  }

}
