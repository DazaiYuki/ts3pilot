<?php
/**
 * Cross-language HMAC protocol test (same vector as the Node agent).
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Agent\Protocol;

final class ProtocolTest extends TestCase {
	public function test_canonical_string_matches_protocol_v1(): void {
		$canonical = Protocol::build_canonical_string( '1700000000', str_repeat( 'a', 32 ), 'POST', '/v1/ts3/status', '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a' );
		$this->assertSame(
			implode(
				"\n",
				array(
					'TS3PILOT-HMAC-SHA256 v1',
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
		$this->assertSame( 'b8ea68ab27fdc4bc30753a62507e9030bcb217a8f897807ea097728d5436836b', $signature );
	}

	public function test_headers_include_required_fields(): void {
		$headers = Protocol::headers( 'secret', 'GET', '/v1/health', '' );
		$this->assertArrayHasKey( 'X-TS3PILOT-Timestamp', $headers );
		$this->assertArrayHasKey( 'X-TS3PILOT-Nonce', $headers );
		$this->assertArrayHasKey( 'X-TS3PILOT-Signature', $headers );
		$this->assertMatchesRegularExpression( '/^[0-9a-f]{64}$/', $headers['X-TS3PILOT-Signature'] );
	}
}
