<?php
/**
 * HMAC verification for agent->WordPress identity callbacks.
 *
 * The agent signs the callback with the same protocol v1 canonical string the
 * plugin uses for outgoing requests, using the long-term agent credential as
 * the shared secret.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Identity;

use Ts3Pilot\Agent\Protocol;
use Ts3Pilot\Settings\Repository;

final class Callback {
	private const CLOCK_SKEW_SEC = 300;

	/**
	 * @param array<string, string|null> $headers
	 */
	public static function verify( Repository $repository, array $headers, string $raw_body, string $path ): bool {
		$secret = (string) $repository->get( 'agent_credential' );
		if ( '' === $secret ) {
			return false;
		}
		$normalized = array();
		foreach ( $headers as $key => $value ) {
			$normalized[ strtolower( (string) $key ) ] = $value;
		}
		$timestamp = $normalized['x-ts3pilot-timestamp'] ?? '';
		$nonce     = $normalized['x-ts3pilot-nonce'] ?? '';
		$signature = $normalized['x-ts3pilot-signature'] ?? '';
		if ( ! is_string( $timestamp ) || ! is_string( $nonce ) || ! is_string( $signature ) ) {
			return false;
		}
		if ( ! ctype_digit( $timestamp ) ) {
			return false;
		}
		if ( abs( time() - (int) $timestamp ) > self::CLOCK_SKEW_SEC ) {
			return false;
		}
		if ( 64 !== strlen( $signature ) || ! ctype_xdigit( $signature ) ) {
			return false;
		}
		$canonical = Protocol::build_canonical_string( $timestamp, $nonce, 'POST', $path, hash( 'sha256', $raw_body ) );
		$expected  = hash_hmac( 'sha256', $canonical, $secret );
		return hash_equals( $expected, strtolower( $signature ) );
	}
}
