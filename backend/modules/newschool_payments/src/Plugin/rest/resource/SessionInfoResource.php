<?php

namespace Drupal\newschool_payments\Plugin\rest\resource;

use Drupal\Core\Session\AccountProxyInterface;
use Drupal\rest\Plugin\ResourceBase;
use Drupal\rest\ResourceResponse;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Provides a REST resource for current-session info including the logout token.
 *
 * Used by the frontend to bootstrap an existing Drupal session (e.g. after a
 * Drupal admin-UI login in the same browser) without requiring a re-login
 * through the React UI.
 *
 * @RestResource(
 *   id = "newschool_session_info",
 *   label = @Translation("NewSchool Session Info"),
 *   uri_paths = {
 *     "canonical" = "/api/session/info"
 *   }
 * )
 */
class SessionInfoResource extends ResourceBase {

  /**
   * The current user proxy.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected $currentUser;

  /**
   * The current HTTP request.
   *
   * @var \Symfony\Component\HttpFoundation\Request
   */
  protected $request;

  /**
   * Constructs a SessionInfoResource object.
   *
   * @param array $configuration
   *   Plugin configuration.
   * @param string $plugin_id
   *   Plugin ID.
   * @param mixed $plugin_definition
   *   Plugin definition.
   * @param array $serializer_formats
   *   Supported serializer formats.
   * @param \Psr\Log\LoggerInterface $logger
   *   Logger channel.
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   Current user.
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   Current request.
   */
  public function __construct(
    array $configuration,
    $plugin_id,
    $plugin_definition,
    array $serializer_formats,
    LoggerInterface $logger,
    AccountProxyInterface $current_user,
    Request $request
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition, $serializer_formats, $logger);
    $this->currentUser = $current_user;
    $this->request = $request;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition) {
    return new static(
      $configuration,
      $plugin_id,
      $plugin_definition,
      $container->getParameter('serializer.formats'),
      $container->get('logger.factory')->get('newschool_payments'),
      $container->get('current_user'),
      $container->get('request_stack')->getCurrentRequest()
    );
  }

  /**
   * Responds to GET requests.
   *
   * Returns current user data and a fresh logout token for the active session.
   * Anonymous requests are rejected with 403.
   *
   * @return \Drupal\rest\ResourceResponse
   *   The session info response.
   */
  public function get() {
    if ($this->currentUser->isAnonymous()) {
      throw new AccessDeniedHttpException('Authentication required.');
    }

    /** @var \Drupal\user\UserInterface $account */
    $account = \Drupal\user\Entity\User::load($this->currentUser->id());

    $logout_token = \Drupal::csrfToken()->get('logout');

    $data = [
      'logout_token'  => $logout_token,
      'current_user'  => [
        'uid'   => (int) $this->currentUser->id(),
        'name'  => $this->currentUser->getAccountName(),
        'mail'  => $account ? $account->getEmail() : '',
        'roles' => array_values($this->currentUser->getRoles()),
      ],
    ];

    $response = new ResourceResponse($data, 200);
    // Ensure the response is not cached for anonymous users and is
    // invalidated when the current user's session changes.
    $response->getCacheableMetadata()->addCacheContexts(['user', 'session']);

    return $response;
  }

}
