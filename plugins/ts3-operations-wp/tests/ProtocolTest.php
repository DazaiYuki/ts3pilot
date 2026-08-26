<?php
/**
 * Cross-language HMAC protocol test (same vector as the Node agent).
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Ops\Agent\Protocol;

final class ProtocolTest extends TestCase {
	public function test_canonical_string_matches_protocol_v1(): void {
		$canonical = Protocol::build_canonical_string( '1700000000', str_repeat( 'a', 32 ), 'POST', '/v1/ts3/status', '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a' );
		$this->assertSame(
			implode(
				"\n",
				array(
					'TS3COPS-HMAC-SHA256 v1',
					'1700000000',
					str_repeat( 'a', 32 ),
					'POST',
					'/v1/ts3/status',
					'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
				)
			),
			$canonical
		);
	}

	public function test_signature_matches_node_vector(): void {
		$signature = Protocol::sign( 'test-secret', '1700000000', str_repeat( 'a', 32 ), 'POST', '/v1/ts3/status', '{}' );
		$this->assertSame( '0343c62690c421dda718aaa6f6f29289189ddfe9fae76b679e110c3f92b6145a', $signature );
	}

	public function test_headers_include_required_fields(): void {
		$headers = Protocol::headers( 'secret', 'GET', '/v1/health', '' );
		$this->assertArrayHasKey( 'X-TS3COPS-Timestamp', $headers );
		$this->assertArrayHasKey( 'X-TS3COPS-Nonce', $headers );
		$this->assertArrayHasKey( 'X-TS3COPS-Signature', $headers );
		$this->assertMatchesRegularExpression( '/^[0-9a-f]{64}$/', $headers['X-TS3COPS-Signature'] );
	}
}
