<?php
/**
 * Bounded audit log stored in an option (ring buffer).
 *
 * Sensitive values (credentials, API keys, tokens) are never written here.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Audit;

final class AuditLog {
	private const OPTION        = 'ts3pilot_audit';
	private const LEGACY_OPTION = 'ts3cops_audit';
	private const MAX_ENTRIES   = 500;

	public static function append( string $action, string $target, string $result, string $error_code = '', string $node_id = '' ): void {
		$entries   = self::all();
		$entries[] = array(
			'time'       => time(),
			'wp_user_id' => get_current_user_id(),
			'action'     => sanitize_key( $action ),
			'target'     => sanitize_text_field( $target ),
			'result'     => in_array( $result, array( 'success', 'failed', 'pending' ), true ) ? $result : 'unknown',
			'error_code' => sanitize_key( $error_code ),
			'node_id'    => sanitize_text_field( $node_id ),
		);
		$entries   = array_slice( $entries, -self::MAX_ENTRIES );
		update_option( self::OPTION, $entries );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function all(): array {
		$entries = get_option( self::OPTION, array() );
		if ( ! is_array( $entries ) || count( $entries ) === 0 ) {
			$legacy = get_option( self::LEGACY_OPTION, array() );
			if ( is_array( $legacy ) && count( $legacy ) > 0 ) {
				$entries = $legacy;
			}
		}
		return is_array( $entries ) ? $entries : array();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function latest( int $limit = 50 ): array {
		return array_slice( array_reverse( self::all() ), 0, max( 1, $limit ) );
	}
}
