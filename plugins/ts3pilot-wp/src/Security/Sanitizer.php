<?php
/**
 * Input validation and sanitization helpers.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Security;

final class Sanitizer {
	public const JOIN_POLICIES = array( 'hidden', 'public', 'logged_in', 'verified_ts_user', 'role' );

	public static function endpoint_url( string $value ): string {
		$value = trim( $value );
		if ( '' === $value ) {
			return '';
		}
		$parts = wp_parse_url( $value );
		if ( false === $parts || ! isset( $parts['scheme'], $parts['host'] ) ) {
			return '';
		}
		$scheme = strtolower( (string) $parts['scheme'] );
		if ( ! in_array( $scheme, array( 'http', 'https' ), true ) ) {
			return '';
		}
		if ( isset( $parts['user'], $parts['pass'] ) || isset( $parts['user'] ) ) {
			// Credentials in the URL would leak into logs and requests.
			return '';
		}
		$port = isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '';
		$path = isset( $parts['path'] ) ? rtrim( $parts['path'], '/' ) : '';
		return $scheme . '://' . $parts['host'] . $port . $path;
	}

	public static function join_policy( string $value ): string {
		return in_array( $value, self::JOIN_POLICIES, true ) ? $value : 'hidden';
	}

	public static function join_url( string $value ): string {
		$value = trim( $value );
		$parts = wp_parse_url( $value );
		if ( strlen( $value ) > 2048 || false === $parts || empty( $parts['host'] ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || ! in_array( strtolower( (string) ( $parts['scheme'] ?? '' ) ), array( 'ts3server', 'https', 'http' ), true ) ) {
			return '';
		}
		return esc_url_raw( $value, array( 'ts3server', 'https', 'http' ) );
	}

	public static function positive_int( $value, int $fallback ): int {
		$int = filter_var( $value, FILTER_VALIDATE_INT );
		return ( false === $int || $int < 0 ) ? $fallback : (int) $int;
	}

	public static function boolish( $value ): bool {
		return (bool) $value;
	}

	public static function role_name( string $value ): string {
		return sanitize_key( $value );
	}
}
