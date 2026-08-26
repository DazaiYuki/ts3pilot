<?php
/**
 * REST route registration.
 *
 * Every route has a strict permission_callback. Nonces protect against CSRF;
 * authorization always comes from WordPress capabilities.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Rest;

use Ts3Pilot\Agent\Client;
use Ts3Pilot\Capabilities;
use Ts3Pilot\Services\StatusService;
use Ts3Pilot\Settings\Repository;

final class Routes {
	public const NAMESPACE = 'ts3pilot/v1';

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
