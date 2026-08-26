<?php
/**
 * Multi-node registry tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Settings\NodeRegistry;
use Ts3Pilot\Settings\Repository;

final class NodeRegistryTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_options'] = array();
	}

	public function test_legacy_settings_migrate_into_a_node(): void {
		$repository = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'legacy-secret',
				'agent_node_id'    => 'legacy-node',
			)
		);
		$registry = new NodeRegistry( $repository );
		$node     = $registry->active();
		$this->assertSame( 'legacy-node', (string) ( $node['node_id'] ?? '' ) );
		$this->assertSame( 'http://127.0.0.1:17880', (string) ( $node['endpoint'] ?? '' ) );
		$this->assertSame( 'legacy-secret', (string) ( $node['credential'] ?? '' ) );
	}

	public function test_upsert_get_active_and_remove(): void {
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
		$registry->set_active( 'node-b' );

		$this->assertSame( 'node-b', $registry->active_id() );
		$this->assertSame( 'secret-b', (string) ( $registry->get( 'node-b' )['credential'] ?? '' ) );
		$this->assertTrue( $registry->is_valid_id( 'node-a' ) );
		$this->assertFalse( $registry->is_valid_id( 'nope' ) );

		$registry->remove( 'node-b' );
		$this->assertFalse( $registry->is_valid_id( 'node-b' ) );
		$this->assertSame( 'node-a', $registry->active_id() );
	}

	public function test_legacy_option_names_are_read_as_fallback(): void {
		$GLOBALS['__ts3pilot_options'] = array(
			'ts3cops_settings' => array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'legacy-secret',
				'agent_node_id'    => 'legacy-node',
			),
		);
		$repository                    = new Repository();
		$this->assertSame( 'http://127.0.0.1:17880', (string) $repository->get( 'agent_url' ) );
		$registry = new NodeRegistry( $repository );
		$node     = $registry->active();
		$this->assertSame( 'legacy-node', (string) ( $node['node_id'] ?? '' ) );
		$this->assertSame( 'legacy-secret', (string) ( $node['credential'] ?? '' ) );
	}
}
