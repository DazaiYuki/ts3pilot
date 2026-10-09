<?php
/**
 * Pairing rollback regression tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Agent\Client;
use Ts3Pilot\Agent\Pairing;
use Ts3Pilot\Settings\NodeRegistry;
use Ts3Pilot\Settings\Repository;

final class PairingTest extends TestCase {
	public function test_failed_pairing_preserves_existing_active_node(): void {
		$GLOBALS['__ts3pilot_options']    = array();
		$GLOBALS['__ts3pilot_http_calls'] = array();
		$repository                       = new Repository();
		$registry                         = new NodeRegistry( $repository );
		$registry->upsert(
			array(
				'node_id'    => 'existing',
				'endpoint'   => 'http://127.0.0.1:17880',
				'credential' => 'existing-secret',
			)
		);
		$registry->set_active( 'existing' );
		$before                           = $registry->all();
		$GLOBALS['__ts3pilot_http_queue'] = array(
			array(
				'response' => array( 'code' => 401 ),
				'body'     => wp_json_encode(
					array(
						'ok'    => false,
						'error' => array(
							'code'    => 'AUTH',
							'message' => 'Invalid pairing code',
						),
					)
				),
			),
		);
		$result                           = ( new Pairing( new Client( $repository ), $repository ) )->pair( 'http://127.0.0.1:17881', 'BADCODE123' );
		$this->assertFalse( $result['ok'] );
		$this->assertSame( 'existing', $registry->active_id() );
		$this->assertSame( $before, $registry->all() );
	}
}
