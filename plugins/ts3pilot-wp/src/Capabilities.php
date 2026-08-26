<?php
/**
 * WordPress capabilities specific to TS3Pilot.
 *
 * These are completely separate from TeamSpeak 3 permissions: being a WP
 * administrator does not change anything inside TeamSpeak, and vice versa.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot;

final class Capabilities {
	public const MANAGE_VIEW        = 'manage_ts3_view';
	public const MANAGE_CLIENTS     = 'manage_ts3_clients';
	public const MANAGE_CHANNELS    = 'manage_ts3_channels';
	public const MANAGE_SERVER      = 'manage_ts3_server';
	public const MANAGE_MAINTENANCE = 'manage_ts3_maintenance';
	public const MANAGE_USERS       = 'manage_ts3_users';

	public const ALL = array(
		self::MANAGE_VIEW,
		self::MANAGE_CLIENTS,
		self::MANAGE_CHANNELS,
		self::MANAGE_SERVER,
		self::MANAGE_MAINTENANCE,
		self::MANAGE_USERS,
	);

	public static function register(): void {
		// Capabilities are mapped on demand; nothing to register at init.
	}

	public static function grant_defaults(): void {
		$admin = get_role( 'administrator' );
		if ( null === $admin ) {
			return;
		}
		foreach ( self::ALL as $capability ) {
			$admin->add_cap( $capability );
		}
	}

	public static function is_valid( string $capability ): bool {
		return in_array( $capability, self::ALL, true );
	}
}
