<?php
/**
 * Multi-node routing and credential isolation tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Agent\Client;
use Ts3Pilot\Agent\Protocol;
use Ts3Pilot\Rest\AdminController;
use Ts3Pilot\Services\StatusService;
use Ts3Pilot\Settings\NodeRegistry;
use Ts3Pilot\Settings\Repository;
use WP_REST_Request;

final class NodeRoutingTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_options']          = array();
		$GLOBALS['__ts3pilot_http_queue']       = array();
		$GLOBALS['__ts3pilot_http_calls']       = array();
		$GLOBALS['__ts3pilot_transients']       = array();
		$GLOBALS['__ts3pilot_current_user_can'] = true;
		$GLOBALS['__ts3pilot_current_user']     = 1;
	}

	private function setup_nodes(): Repository {
		$repository = new Repository();
		$registry   = new NodeRegistry( $repository );
		$registry->upsert(
			array(
				'node_id'      => 'node-a',
				'display_name' => 'Frankfurt',
				'endpoint'     => 'http://127.0.0.1:17880',
				'credential'   => 'secret-a',
				'timeout'      => 5,
				'is_active'    => true,
			)
		);
		$registry->upsert(
			array(
				'node_id'      => 'node-b',
				'display_name' => 'Singapore',
				'endpoint'     => 'http://127.0.0.1:17881',
				'credential'   => 'secret-b',
				'timeout'      => 8,
				'is_active'    => false,
			)
		);
		$registry->set_active( 'node-a' );
		return $repository;
	}

	public function test_requests_route_to_the_selected_node_and_sign_with_its_credential(): void {
		$repository                         = $this->setup_nodes();
		$client                             = new Client( $repository );
		$controller                         = new AdminController( $client, new StatusService( $client, $repository ), $repository );
		$GLOBALS['__ts3pilot_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(),
				)
			),
		);

		$response = $controller->clients( new WP_REST_Request( array( 'node_id' => 'node-b' ) ) );
		$this->assertSame( 200, $response->get_status() );
		$call = $GLOBALS['__ts3pilot_http_calls'][0] ?? array();
		$this->assertSame( 'http://127.0.0.1:17881/v1/ts3/clients', (string) ( $call['url'] ?? '' ) );

		$headers     = (array) ( $call['args']['headers'] ?? array() );
		$body        = (string) ( $call['args']['body'] ?? '' );
		$path        = '/v1/ts3/clients';
		$canonical_a = Protocol::build_canonical_string(
			(string) $headers['X-TS3PILOT-Timestamp'],
			(string) $headers['X-TS3PILOT-Nonce'],
			'GET',
			$path,
			hash( 'sha256', $body )
		);
		$this->assertSame(
			(string) $headers['X-TS3PILOT-Signature'],
			hash_hmac( 'sha256', $canonical_a, 'secret-b' )
		);
		$this->assertNotSame(
			hash_hmac( 'sha256', $canonical_a, 'secret-a' ),
			(string) $headers['X-TS3PILOT-Signature']
		);
	}

	public function test_invalid_node_id_is_rejected(): void {
		$repository = $this->setup_nodes();
		$client     = new Client( $repository );
		$controller = new AdminController( $client, new StatusService( $client, $repository ), $repository );
		$response   = $controller->clients( new WP_REST_Request( array( 'node_id' => 'does-not-exist' ) ) );
		$this->assertSame( 400, $response->get_status() );
	}
}
