<?php
/**
 * Settings page node-test result rendering tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Admin\SettingsPage;
use Ts3Pilot\Agent\Client;
use Ts3Pilot\Settings\Repository;

final class SettingsPageTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_options']    = array();
		$GLOBALS['__ts3pilot_transients'] = array();
		unset( $_GET['ts3pilot_result'], $_GET['node'] );
	}

	private function render(): string {
		$repository = new Repository();
		ob_start();
		try {
			( new SettingsPage( new Client( $repository ), $repository ) )->render();
			return (string) ob_get_clean();
		} catch ( \Throwable $error ) {
			ob_end_clean();
			throw $error;
		}
	}

	public function test_test_ok_notice_renders_escaped_details(): void {
		$_GET['ts3pilot_result'] = 'test_ok'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- test only
		$_GET['node']            = 'node-a'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- test only
		set_transient(
			'ts3pilot_node_test_node-a',
			array(
				'nodeId'         => 'node-a',
				'mode'           => 'production',
				'cliVersion'     => '0.4.0',
				'ts3Provider'    => 'serverquery',
				'systemProvider' => 'systemd',
				'deployment'     => 'native',
				'remoteMode'     => true,
				'testedAt'       => time(),
			),
			60
		);
		$html = $this->render();
		$this->assertStringContainsString( 'Connection OK', $html );
		$this->assertStringContainsString( 'node-a', $html );
		$this->assertStringContainsString( 'CLI 0.4.0', $html );
		$this->assertStringContainsString( 'serverquery', $html );
		$this->assertStringContainsString( 'deployment native', $html );
		$this->assertStringContainsString( 'remote mode yes', $html );
	}

	public function test_test_failed_notice_renders(): void {
		$_GET['ts3pilot_result'] = 'test_failed'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- test only
		$html                    = $this->render();
		$this->assertStringContainsString( 'Connection test failed', $html );
	}

	public function test_node_test_button_is_rendered_for_registered_nodes(): void {
		$repository = new Repository();
		$registry   = new \Ts3Pilot\Settings\NodeRegistry( $repository );
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
		$html = $this->render();
		$this->assertStringContainsString( 'ts3pilot_node_test', $html );
		$this->assertStringContainsString( 'Run test', $html );
	}
}
