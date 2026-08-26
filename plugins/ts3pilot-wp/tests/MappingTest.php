<?php
/**
 * Identity mapping and challenge tests.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Tests;

use PHPUnit\Framework\TestCase;
use Ts3Pilot\Identity\Challenge;
use Ts3Pilot\Identity\Mapping;

final class MappingTest extends TestCase {
	protected function setUp(): void {
		$GLOBALS['__ts3pilot_usermeta'] = array();
	}

	public function test_default_mapping_is_unbound(): void {
		$mapping = Mapping::get( 1 );
		$this->assertSame( 'unbound', $mapping['status'] );
		$this->assertSame( '', $mapping['ts3_uid'] );
	}

	public function test_mark_verified_sets_state(): void {
		Mapping::mark_verified( 1, 'TS3UID123', 'agent-verified', 'node-1' );
		$mapping = Mapping::get( 1 );
		$this->assertSame( 'verified', $mapping['status'] );
		$this->assertSame( 'TS3UID123', $mapping['ts3_uid'] );
	}

	public function test_challenge_is_single_use_and_attempt_limited(): void {
		$code = Challenge::start( 1 );
		$this->assertMatchesRegularExpression( '/^[A-F0-9]{8}$/', $code );
		$this->assertTrue( Challenge::verify( 1, $code ) );
		$this->assertFalse( Challenge::verify( 1, $code ) );
	}

	public function test_challenge_blocks_after_max_attempts(): void {
		$code = Challenge::start( 2 );
		for ( $i = 0; $i < 5; $i++ ) {
			$this->assertFalse( Challenge::verify( 2, 'WRONG' ) );
		}
		$this->assertFalse( Challenge::verify( 2, $code ) );
	}
}
