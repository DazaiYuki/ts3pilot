<?php
/**
 * Audit log page rendering and escaping tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Admin\AuditLogPage;
use Ts3Pilot\Audit\AuditLog;

final class AuditLogPageTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_options']      = array();
		$GLOBALS['__ts3pilot_current_user'] = 1;
	}

	public function test_empty_state(): void {
		ob_start();
		( new AuditLogPage() )->render();
		$html = (string) ob_get_clean();
		$this->assertStringContainsString( 'No audit events recorded yet.', $html );
	}

	public function test_renders_escaped_entries(): void {
		AuditLog::append( 'kick', 'client:1', 'success' );
		$GLOBALS['__ts3pilot_options']['ts3pilot_audit'][] = array(
			'time'       => 1700000000,
			'wp_user_id' => 2,
			'action'     => 'channel.create',
			'target'     => '<script>alert(1)</script>',
			'result'     => 'success',
			'error_code' => '',
			'node_id'    => 'node-a',
		);

		ob_start();
		( new AuditLogPage() )->render();
		$html = (string) ob_get_clean();

		$this->assertStringContainsString( 'client:1', $html );
		$this->assertStringContainsString( 'node-a', $html );
		$this->assertStringNotContainsString( '<script>alert(1)</script>', $html );
		$this->assertStringContainsString( '&lt;script&gt;alert(1)&lt;/script&gt;', $html );
	}
}
