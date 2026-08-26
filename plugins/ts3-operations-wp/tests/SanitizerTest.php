<?php
/**
 * Sanitizer tests.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Ops\Security\Sanitizer;

final class SanitizerTest extends TestCase {
	public function test_endpoint_url_accepts_loopback_http(): void {
		$this->assertSame( 'http://127.0.0.1:17880', Sanitizer::endpoint_url( 'http://127.0.0.1:17880/' ) );
	}

	public function test_endpoint_url_rejects_credentials_and_bad_schemes(): void {
		$this->assertSame( '', Sanitizer::endpoint_url( 'https://user:pass@127.0.0.1:17880' ) );
		$this->assertSame( '', Sanitizer::endpoint_url( 'javascript:alert(1)' ) );
		$this->assertSame( '', Sanitizer::endpoint_url( 'ftp://example.com' ) );
	}

	public function test_join_policy_is_whitelisted(): void {
		$this->assertSame( 'logged_in', Sanitizer::join_policy( 'logged_in' ) );
		$this->assertSame( 'hidden', Sanitizer::join_policy( 'anything-else' ) );
	}

	public function test_positive_int_falls_back(): void {
		$this->assertSame( 5, Sanitizer::positive_int( 5, 10 ) );
		$this->assertSame( 10, Sanitizer::positive_int( -3, 10 ) );
		$this->assertSame( 10, Sanitizer::positive_int( 'abc', 10 ) );
	}
}
