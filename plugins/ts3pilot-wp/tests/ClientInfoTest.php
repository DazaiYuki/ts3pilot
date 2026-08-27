<?php
/**
 * Agent client info() tests (authenticated node introspection).
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Agent\AgentException;
use Ts3Pilot\Agent\Client;
use Ts3Pilot\Settings\Repository;

final class ClientInfoTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_options']    = array();
		$GLOBALS['__ts3pilot_http_queue'] = array();
		$GLOBALS['__ts3pilot_http_calls'] = array();
		$repository                       = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'secret-credential',
			)
		);
	}

	public function test_info_returns_node_details(): void {
		$GLOBALS['__ts3pilot_http_queue'][] = array(
			'response' => array( 'code' => 200 ),
			'body'     => wp_json_encode(
				array(
					'ok'   => true,
					'data' => array(
						'nodeId'         => 'node-1',
						'mode'           => 'production',
						'ts3Provider'    => 'serverquery',
						'systemProvider' => 'systemd',
						'remoteMode'     => true,
					),
				)
			),
		);
		$info                               = ( new Client( new Repository() ) )->info();
		$this->assertSame( 'node-1', (string) ( $info['nodeId'] ?? '' ) );
		$this->assertSame( 'serverquery', (string) ( $info['ts3Provider'] ?? '' ) );
		$this->assertTrue( (bool) ( $info['remoteMode'] ?? false ) );
		$this->assertCount( 1, $GLOBALS['__ts3pilot_http_calls'] );
	}

	public function test_info_throws_on_agent_error(): void {
		$GLOBALS['__ts3pilot_http_queue'][] = array(
			'response' => array( 'code' => 403 ),
			'body'     => wp_json_encode(
				array(
					'ok'    => false,
					'error' => array(
						'code'    => 'PERMISSION',
						'message' => 'Capability required: agent.pair',
					),
				)
			),
		);
		$this->expectException( AgentException::class );
		( new Client( new Repository() ) )->info();
	}
}
