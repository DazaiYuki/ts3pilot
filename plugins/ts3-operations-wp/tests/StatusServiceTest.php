<?php
/**
 * Status service projection tests.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Ops\Agent\Client;
use Ts3Ops\Services\StatusService;
use Ts3Ops\Settings\Repository;

final class StatusServiceTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3cops_options']    = array();
		$GLOBALS['__ts3cops_transients'] = array();
		$GLOBALS['__ts3cops_http_queue'] = array();
	}

	public function test_snapshot_projects_safe_fields_and_sanitizes(): void {
		$repository = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'secret-credential',
			)
		);
		$GLOBALS['__ts3cops_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'online'        => true,
						'name'          => 'Test <script>alert(1)</script> Server',
						'clientsOnline' => 12,
						'maxClients'    => 32,
						'version'       => '3.13.7',
					),
				)
			),
		);

		$service  = new StatusService( new Client( $repository ), $repository );
		$snapshot = $service->get_snapshot( true );
		$this->assertTrue( $snapshot['online'] );
		$this->assertSame( 'Test alert(1) Server', $snapshot['name'] );
		$this->assertSame( 12, $snapshot['clients'] );
		$this->assertSame( 32, $snapshot['max_clients'] );
		$this->assertArrayNotHasKey( 'credential', $snapshot );
		$this->assertArrayNotHasKey( 'agent_url', $snapshot );
	}

	public function test_snapshot_falls_back_offline_on_agent_error(): void {
		$repository = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'secret-credential',
			)
		);
		$GLOBALS['__ts3cops_http_queue'][] = new \WP_Error( 'http_request_failed', 'connection refused' );

		$service  = new StatusService( new Client( $repository ), $repository );
		$snapshot = $service->get_snapshot( true );
		$this->assertFalse( $snapshot['online'] );
		$this->assertTrue( $snapshot['error'] );
	}
}
