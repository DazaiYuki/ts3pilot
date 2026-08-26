<?php
/**
 * [ts3_identity] shortcode tests.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Ops\Frontend\IdentityShortcode;
use Ts3Ops\Identity\Mapping;

final class IdentityShortcodeTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3cops_usermeta']         = array();
		$GLOBALS['__ts3cops_current_user']     = 0;
		$GLOBALS['__ts3cops_current_user_can'] = true;
	}

	public function test_requires_login(): void {
		$html = IdentityShortcode::render();
		$this->assertStringContainsString( '请先登录后绑定', $html );
	}

	public function test_logged_in_user_sees_binding_widget(): void {
		$GLOBALS['__ts3cops_current_user'] = 5;
		Mapping::set( 5, array( 'status' => 'pending' ) );
		$html = IdentityShortcode::render();
		$this->assertStringContainsString( 'ts3-identity-root', $html );
		$this->assertStringContainsString( 'data-action="start"', $html );
		$this->assertStringContainsString( 'pending', $html );
	}

	public function test_verified_user_sees_uid(): void {
		$GLOBALS['__ts3cops_current_user'] = 5;
		Mapping::mark_verified( 5, 'TS3UID123', 'agent-auto', 'node-1' );
		$html = IdentityShortcode::render();
		$this->assertStringContainsString( 'TS3UID123', $html );
		$this->assertStringContainsString( 'verified', $html );
	}
}
