<?php
/**
 * REST route registration.
 *
 * Every route has a strict permission_callback. Nonces protect against CSRF;
 * authorization always comes from WordPress capabilities.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Rest;

use Ts3Ops\Agent\Client;
use Ts3Ops\Capabilities;
use Ts3Ops\Services\StatusService;
use Ts3Ops\Settings\Repository;

final class Routes {
	public const NAMESPACE = 'ts3-operations/v1';

	public static function init( Client $client, StatusService $status, Repository $repository ): void {
		add_action(
			'rest_api_init',
			static function () use ( $client, $status, $repository ): void {
				$controller = new AdminController( $client, $status, $repository );
				$controller->register_routes();
			}
		);
	}
}
