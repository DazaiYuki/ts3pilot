<?php
/**
 * Single-use, short-lived, attempt-limited binding challenge.
 *
 * The challenge proves that the WP user controls the TS3 client identity only
 * when combined with a verified channel (Bot or agent-side identity proof).
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Identity;

final class Challenge {
	private const META_KEY     = 'ts3cops_challenge';
	private const TTL_SECONDS  = 600;
	private const MAX_ATTEMPTS = 5;

	public static function start( int $user_id ): string {
		$code = strtoupper( bin2hex( random_bytes( 4 ) ) );
		update_user_meta(
			$user_id,
			self::META_KEY,
			array(
				'code_hash'  => hash( 'sha256', $code ),
				'expires_at' => time() + self::TTL_SECONDS,
				'attempts'   => 0,
				'consumed'   => false,
			)
		);
		return $code;
	}

	public static function verify( int $user_id, string $code ): bool {
		$challenge = get_user_meta( $user_id, self::META_KEY, true );
		if ( ! is_array( $challenge ) || empty( $challenge['code_hash'] ) ) {
			return false;
		}
		if ( true === ( $challenge['consumed'] ?? false ) ) {
			return false;
		}
		if ( (int) ( $challenge['expires_at'] ?? 0 ) < time() ) {
			return false;
		}
		$attempts = (int) ( $challenge['attempts'] ?? 0 );
		if ( $attempts >= self::MAX_ATTEMPTS ) {
			return false;
		}
		if ( ! hash_equals( (string) $challenge['code_hash'], hash( 'sha256', strtoupper( $code ) ) ) ) {
			$challenge['attempts'] = $attempts + 1;
			update_user_meta( $user_id, self::META_KEY, $challenge );
			return false;
		}
		$challenge['consumed'] = true;
		update_user_meta( $user_id, self::META_KEY, $challenge );
		return true;
	}
}
