<?php
/**
 * Agent API authentication protocol (mirrors the TypeScript agent).
 *
 * Canonical string: "TS3COPS-HMAC-SHA256 v1\n<timestamp>\n<nonce>\n<METHOD>\n<path>\n<sha256(body)>"
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Agent;

final class Protocol {
	public const NAME    = 'TS3COPS-HMAC-SHA256';
	public const VERSION = 1;

	public static function build_canonical_string( string $timestamp, string $nonce, string $method, string $path, string $body_hash ): string {
		return implode(
			"\n",
			array(
				self::NAME . ' v' . self::VERSION,
				$timestamp,
				$nonce,
				strtoupper( $method ),
				$path,
				$body_hash,
			)
		);
	}

	public static function sign( string $secret, string $timestamp, string $nonce, string $method, string $path, string $body ): string {
		$canonical = self::build_canonical_string( $timestamp, $nonce, $method, $path, hash( 'sha256', $body ) );
		return hash_hmac( 'sha256', $canonical, $secret );
	}

	/**
	 * @return array<string, string>
	 */
	public static function headers( string $secret, string $method, string $path, string $body ): array {
		$timestamp = (string) time();
		$nonce     = bin2hex( random_bytes( 16 ) );
		return array(
			'X-TS3COPS-Timestamp' => $timestamp,
			'X-TS3COPS-Nonce'     => $nonce,
			'X-TS3COPS-Signature' => self::sign( $secret, $timestamp, $nonce, $method, $path, $body ),
		);
	}
}
