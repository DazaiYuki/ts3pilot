<?php
/**
 * Capability tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Capabilities;

final class CapabilitiesTest extends TestCase {
	public function test_all_capabilities_are_defined(): void {
		$this->assertContains( 'manage_ts3_view', Capabilities::ALL );
		$this->assertContains( 'manage_ts3_clients', Capabilities::ALL );
		$this->assertContains( 'manage_ts3_channels', Capabilities::ALL );
		$this->assertContains( 'manage_ts3_server', Capabilities::ALL );
		$this->assertContains( 'manage_ts3_maintenance', Capabilities::ALL );
		$this->assertContains( 'manage_ts3_users', Capabilities::ALL );
		$this->assertCount( 6, Capabilities::ALL );
	}

	public function test_grant_defaults_adds_caps_to_admin_role(): void {
		$admin                                        = new class() {
			public array $caps = array();

			public function add_cap( string $capability ): void {
				$this->caps[] = $capability;
			}
		};
		$GLOBALS['__ts3pilot_roles']['administrator'] = $admin;
		Capabilities::grant_defaults();
		$this->assertContains( 'manage_ts3_view', $admin->caps );
		$this->assertContains( 'manage_ts3_users', $admin->caps );
	}
}
