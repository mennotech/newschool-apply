<?php

namespace Drupal\newschool_payments\Form;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

class PaymentSettingsForm extends ConfigFormBase {

  public function __construct(
    ConfigFactoryInterface $config_factory,
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly EntityFieldManagerInterface $entityFieldManager,
  ) {
    parent::__construct($config_factory);
  }

  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('config.factory'),
      $container->get('entity_type.manager'),
      $container->get('entity_field.manager'),
    );
  }

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames(): array {
    return ['newschool_payments.settings'];
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId(): string {
    return 'newschool_payments_settings_form';
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state): array {
    $config = $this->config('newschool_payments.settings');
    $fees = $config->get('fees') ?: [];

    $form['stripe'] = [
      '#type' => 'details',
      '#title' => $this->t('Stripe settings'),
      '#open' => TRUE,
    ];

    $secretFromEnv = getenv('STRIPE_SECRET_KEY');
    $webhookFromEnv = getenv('STRIPE_WEBHOOK_SECRET');
    $storedSecret = (string) $config->get('stripe_secret_key');
    $storedWebhookSecret = (string) $config->get('stripe_webhook_secret');

    $activeSecret = (is_string($secretFromEnv) && $secretFromEnv !== '')
      ? $secretFromEnv
      : $storedSecret;
    $activeWebhookSecret = (is_string($webhookFromEnv) && $webhookFromEnv !== '')
      ? $webhookFromEnv
      : $storedWebhookSecret;

    $form['stripe']['stripe_secret_key'] = [
      '#type' => 'password',
      '#title' => $this->t('Stripe secret key'),
      '#description' => $secretFromEnv
        ? $this->t('Using STRIPE_SECRET_KEY from environment. This field is ignored while env var is set.')
        : ($config->get('stripe_secret_key')
          ? $this->t('A value is saved. Leave blank to keep the existing secret, or enter a new value to replace it.')
          : $this->t('Used only when STRIPE_SECRET_KEY env var is not set.')),
      '#default_value' => $storedSecret,
    ];

    $form['stripe']['stripe_secret_key_preview'] = [
      '#type' => 'item',
      '#title' => $this->t('Active secret preview'),
      '#plain_text' => $this->formatSecretPreview($activeSecret),
    ];

    $form['stripe']['stripe_webhook_secret'] = [
      '#type' => 'password',
      '#title' => $this->t('Stripe webhook signing secret'),
      '#description' => $webhookFromEnv
        ? $this->t('Using STRIPE_WEBHOOK_SECRET from environment. This field is ignored while env var is set.')
        : ($config->get('stripe_webhook_secret')
          ? $this->t('A value is saved. Leave blank to keep the existing secret, or enter a new value to replace it.')
          : $this->t('Used only when STRIPE_WEBHOOK_SECRET env var is not set.')),
      '#default_value' => $storedWebhookSecret,
    ];

    $form['stripe']['stripe_webhook_secret_preview'] = [
      '#type' => 'item',
      '#title' => $this->t('Active webhook secret preview'),
      '#plain_text' => $this->formatSecretPreview($activeWebhookSecret),
    ];

    $form['stripe']['success_url'] = [
      '#type' => 'url',
      '#title' => $this->t('Success URL'),
      '#required' => TRUE,
      '#default_value' => (string) $config->get('success_url'),
      '#description' => $this->t('Checkout success URL. Stripe appends session_id query parameter.'),
    ];

    $form['stripe']['cancel_url'] = [
      '#type' => 'url',
      '#title' => $this->t('Cancel URL'),
      '#required' => TRUE,
      '#default_value' => (string) $config->get('cancel_url'),
    ];

    $form['fees'] = [
      '#type' => 'details',
      '#title' => $this->t('Fee mapping by application bundle'),
      '#open' => TRUE,
    ];

    $form['fees']['table'] = [
      '#type' => 'table',
      '#header' => [
        $this->t('Enabled'),
        $this->t('Bundle machine name'),
        $this->t('Bundle label'),
        $this->t('Amount (cents)'),
        $this->t('Currency'),
        $this->t('Label'),
      ],
      '#empty' => $this->t('No payable application bundles found (field_payment missing).'),
    ];

    foreach ($this->getPayableBundles() as $bundle => $label) {
      $existing = $fees[$bundle] ?? [];
      $form['fees']['table'][$bundle]['enabled'] = [
        '#type' => 'checkbox',
        '#default_value' => isset($fees[$bundle]),
      ];
      $form['fees']['table'][$bundle]['bundle'] = [
        '#plain_text' => $bundle,
      ];
      $form['fees']['table'][$bundle]['bundle_label'] = [
        '#plain_text' => $label,
      ];
      $form['fees']['table'][$bundle]['amount_cents'] = [
        '#type' => 'number',
        '#step' => 1,
        '#min' => 0,
        '#default_value' => $existing['amount_cents'] ?? 0,
      ];
      $form['fees']['table'][$bundle]['currency'] = [
        '#type' => 'textfield',
        '#size' => 6,
        '#maxlength' => 3,
        '#default_value' => $existing['currency'] ?? 'CAD',
      ];
      $form['fees']['table'][$bundle]['label'] = [
        '#type' => 'textfield',
        '#size' => 32,
        '#maxlength' => 255,
        '#default_value' => $existing['label'] ?? 'Application Fee',
      ];
    }

    return parent::buildForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state): void {
    parent::validateForm($form, $form_state);

    $table = $form_state->getValue('table') ?? [];
    foreach ($table as $bundle => $row) {
      if (empty($row['enabled'])) {
        continue;
      }

      $amount = (int) ($row['amount_cents'] ?? 0);
      if ($amount < 0) {
        $form_state->setErrorByName("fees][table][$bundle][amount_cents", $this->t('Amount must be 0 or greater for %bundle.', ['%bundle' => $bundle]));
      }

      $currency = strtoupper(trim((string) ($row['currency'] ?? '')));
      if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        $form_state->setErrorByName("fees][table][$bundle][currency", $this->t('Currency for %bundle must be a 3-letter uppercase code.', ['%bundle' => $bundle]));
      }
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state): void {
    parent::submitForm($form, $form_state);

    $config = $this->configFactory->getEditable('newschool_payments.settings');

    $secretInput = (string) $form_state->getValue('stripe_secret_key');
    if ($secretInput !== '') {
      $config->set('stripe_secret_key', $secretInput);
    }

    $webhookSecretInput = (string) $form_state->getValue('stripe_webhook_secret');
    if ($webhookSecretInput !== '') {
      $config->set('stripe_webhook_secret', $webhookSecretInput);
    }

    $config
      ->set('success_url', (string) $form_state->getValue('success_url'))
      ->set('cancel_url', (string) $form_state->getValue('cancel_url'));

    $fees = [];
    $table = $form_state->getValue('table') ?? [];
    foreach ($table as $bundle => $row) {
      if (empty($row['enabled'])) {
        continue;
      }
      $fees[$bundle] = [
        'amount_cents' => (int) $row['amount_cents'],
        'currency' => strtoupper(trim((string) $row['currency'])),
        'label' => trim((string) $row['label']),
      ];
    }

    $config->set('fees', $fees)->save();
  }

  /**
   * @return array<string, string>
   */
  private function getPayableBundles(): array {
    $bundles = [];
    $nodeTypes = $this->entityTypeManager->getStorage('node_type')->loadMultiple();
    foreach ($nodeTypes as $nodeType) {
      $bundle = $nodeType->id();
      $definitions = $this->entityFieldManager->getFieldDefinitions('node', $bundle);
      if (!isset($definitions['field_payment'])) {
        continue;
      }
      $paymentField = $definitions['field_payment'];
      if ($paymentField->getType() !== 'entity_reference') {
        continue;
      }
      if ($paymentField->getSetting('target_type') !== 'node') {
        continue;
      }

      $handlerSettings = $paymentField->getSetting('handler_settings') ?: [];
      $targetBundles = $handlerSettings['target_bundles'] ?? [];
      if (!empty($targetBundles) && !isset($targetBundles['payment'])) {
        continue;
      }

      $bundles[$bundle] = $nodeType->label();
    }

    ksort($bundles);
    return $bundles;
  }

  private function formatSecretPreview(string $secret): string {
    if ($secret === '') {
      return (string) $this->t('Not set');
    }

    $length = strlen($secret);
    if ($length <= 8) {
      return str_repeat('*', max(0, $length - 2)) . substr($secret, -2) . ' (len ' . $length . ')';
    }

    $prefix = substr($secret, 0, 6);
    $suffix = substr($secret, -4);
    return $prefix . '...' . $suffix . ' (len ' . $length . ')';
  }

}
