<?php

namespace Drupal\newschool_payments\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Drupal\Core\Session\AccountInterface;

/**
 * Provides session info endpoint for bootstrapped frontend sessions.
 */
class SessionInfoController extends ControllerBase {

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountInterface
   */
  protected $currentUser;

  /**
   * Constructor.
   */
  public function __construct(AccountInterface $current_user) {
    $this->currentUser = $current_user;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('current_user')
    );
  }

  /**
   * Returns session info including logout token for the active session.
   *
   * GET /api/session/info?_format=json
   * Requires authentication (returns 403 for anonymous).
   */
  public function info(Request $request): JsonResponse {
    $user = $this->currentUser;

    if ($user->isAnonymous()) {
      return new JsonResponse(['error' => 'Forbidden'], 403);
    }

    // Generate logout token for the current session.
    $token_generator = \Drupal::service('csrf_token');
    $logout_token = $token_generator->get('logout');

    // Load full user entity to get email.
    $account = \Drupal\user\Entity\User::load($user->id());
    $mail = $account ? $account->getEmail() : '';
    $roles = array_values($user->getRoles());

    return new JsonResponse([
      'current_user' => [
        'uid' => (string) $user->id(),
        'name' => $user->getDisplayName(),
        'mail' => $mail,
        'roles' => $roles,
      ],
      'logout_token' => $logout_token,
    ]);
  }

}
