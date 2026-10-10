<?php
/**
 * Status service projection tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Agent\Client;
use Ts3Pilot\Services\StatusService;
use Ts3Pilot\Settings\Repository;
use Ts3Pilot\Settings\NodeRegistry;

final class StatusServiceTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_options']    = array();
		$GLOBALS['__ts3pilot_transients'] = array();
		$GLOBALS['__ts3pilot_http_queue'] = array();
	}

	public function test_snapshot_projects_safe_fields_and_sanitizes(): void {
		$repository = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'secret-credential',
			)
		);
		$GLOBALS['__ts3pilot_http_queue'][] = array(
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
		$GLOBALS['__ts3pilot_http_queue'][] = new \WP_Error( 'http_request_failed', 'connection refused' );

		$service  = new StatusService( new Client( $repository ), $repository );
		$snapshot = $service->get_snapshot( true );
		$this->assertFalse( $snapshot['online'] );
		$this->assertTrue( $snapshot['error'] );
	}

	public function test_channels_snapshot_fails_closed_to_an_empty_list(): void {
		$repository = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'secret-credential',
			)
		);
		$GLOBALS['__ts3pilot_http_queue'][] = new \WP_Error( 'http_request_failed', 'connection refused' );

		$service  = new StatusService( new Client( $repository ), $repository );
		$channels = $service->get_channels_snapshot( true );
		$this->assertSame( array(), $channels );
		$this->assertArrayNotHasKey( 'error', $channels );
	}
	public function test_switching_active_nodes_does_not_reuse_another_nodes_cached_status(): void {
		$repository = new Repository();
		$registry   = new NodeRegistry( $repository );
		$service    = new StatusService( new Client( $repository ), $repository );
		foreach ( array( 'same-prefix-123456-first', 'same-prefix-123456-second' ) as $id ) {
			$registry->upsert(
				array(
					'node_id'    => $id,
					'endpoint'   => 'http://127.0.0.1:17880',
					'credential' => 'secret',
				)
			);
			$registry->set_active( $id );
			$GLOBALS['__ts3pilot_http_queue'][] = array(
				'response' => array( 'code' => 200 ),
				'body'     => wp_json_encode(
					array(
						'ok'   => true,
						'data' => array(
							'online' => true,
							'name'   => $id,
						),
					)
				),
			);
			$this->assertSame( $id, $service->get_snapshot()['name'] );
			$this->assertSame( $id, $service->get_snapshot( false, $id )['name'] );
		}
		$this->assertCount( 0, $GLOBALS['__ts3pilot_http_queue'] );
	}
}
