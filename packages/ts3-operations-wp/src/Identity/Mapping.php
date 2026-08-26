<?php
/**
 * WP user <-> TS3 identity mapping with an explicit state model.
 *
 * States: unbound, pending, verified, revoked.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Identity;

final class Mapping {
	public const UNBOUND  = 'unbound';
	public const PENDING  = 'pending';
	public const VERIFIED = 'verified';
	public const REVOKED  = 'revoked';

	private const META_KEY = 'ts3cops_identity';

	/**
	 * @return array<string, mixed>
	 */
	public static function get( int $user_id ): array {
		$data = get_user_meta( $user_id, self::META_KEY, true );
		if ( ! is_array( $data ) ) {
			$data = array();
		}
		return array_merge(
			array(
				'ts3_uid'      => '',
				'status'       => self::UNBOUND,
				'bound_at'     => 0,
				'verified_at'  => 0,
				'method'       => '',
				'last_sync_at' => 0,
				'node_id'      => '',
			),
			$data
		);
	}

	/**
	 * @param array<string, mixed> $data
	 */
	public static function set( int $user_id, array $data ): bool {
		$allowed = array( self::UNBOUND, self::PENDING, self::VERIFIED, self::REVOKED );
		if ( isset( $data['status'] ) && ! in_array( $data['status'], $allowed, true ) ) {
			unset( $data['status'] );
		}
		return (bool) update_user_meta( $user_id, self::META_KEY, array_merge( self::get( $user_id ), $data ) );
	}

	public static function mark_verified( int $user_id, string $ts3_uid, string $method, string $node_id ): bool {
		return self::set(
			$user_id,
			array(
				'ts3_uid'      => sanitize_text_field( $ts3_uid ),
				'status'       => self::VERIFIED,
				'verified_at'  => time(),
				'method'       => sanitize_key( $method ),
				'node_id'      => sanitize_text_field( $node_id ),
				'last_sync_at' => time(),
			)
		);
	}
}
