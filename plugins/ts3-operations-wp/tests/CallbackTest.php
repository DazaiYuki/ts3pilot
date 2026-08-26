<?php
/**
 * Agent->WordPress callback signature verification tests.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Ops\Agent\Protocol;
use Ts3Ops\Identity\Callback;
use Ts3Ops\Settings\Repository;

final class CallbackTest extends TestCase {
	private const PATH = '/wp-json/ts3-operations/v1/identity/callback';

	protected function setUp(): void {
		$GLOBALS['__ts3cops_options'] = array();
		$repository                   = new Repository();
		$repository->set_many(
			array(
				'agent_url'        => 'http://127.0.0.1:17880',
				'agent_credential' => 'secret-credential',
			)
		);
	}

	public function test_valid_signature_is_accepted(): void {
		$body    = '{"wpUserId":7,"ts3Uid":"TS3UID123","verifiedAt":1700000000000,"nodeId":"node-1"}';
		$headers = Protocol::headers( 'secret-credential', 'POST', self::PATH, $body );
		$this->assertTrue( Callback::verify( new Repository(), $headers, $body, self::PATH ) );
	}

	public function test_wrong_secret_is_rejected(): void {
		$body    = '{"wpUserId":7}';
		$headers = Protocol::headers( 'other-secret', 'POST', self::PATH, $body );
		$this->assertFalse( Callback::verify( new Repository(), $headers, $body, self::PATH ) );
	}

	public function test_stale_timestamp_is_rejected(): void {
		$body      = '{"wpUserId":7}';
		$timestamp = '1000000000';
		$nonce     = bin2hex( random_bytes( 16 ) );
		$canonical = Protocol::build_canonical_string( $timestamp, $nonce, 'POST', self::PATH, hash( 'sha256', $body ) );
		$signature = hash_hmac( 'sha256', $canonical, 'secret-credential' );
		$headers   = array(
			'X-TS3COPS-Timestamp' => $timestamp,
			'X-TS3COPS-Nonce'     => $nonce,
			'X-TS3COPS-Signature' => $signature,
		);
		$this->assertFalse( Callback::verify( new Repository(), $headers, $body, self::PATH ) );
	}

	public function test_missing_credential_is_rejected(): void {
		$GLOBALS['__ts3cops_options'] = array();
		$body                         = '{}';
		$headers                      = Protocol::headers( 'secret-credential', 'POST', self::PATH, $body );
		$this->assertFalse( Callback::verify( new Repository(), $headers, $body, self::PATH ) );
	}
}
