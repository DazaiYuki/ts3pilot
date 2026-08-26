<?php
/**
 * Options repository for plugin settings.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Settings;

final class Repository {
	public const OPTION_NAME         = 'ts3pilot_settings';
	private const LEGACY_OPTION_NAME = 'ts3cops_settings';

	private const DEFAULTS = array(
		'agent_url'                => '',
		'agent_credential'         => '',
		'agent_node_id'            => '',
		'status_cache_ttl'         => 10,
		'join_policy'              => 'hidden',
		'join_role'                => '',
		'join_url'                 => '',
		'show_name'                => true,
		'show_online'              => true,
		'show_max'                 => true,
		'show_version'             => false,
		'show_channels'            => false,
		'theme'                    => 'auto',
		'delete_data_on_uninstall' => false,
	);

	/**
	 * @return array<string, mixed>
	 */
	public function all(): array {
		$stored = get_option( self::OPTION_NAME, array() );
		if ( ! is_array( $stored ) || count( $stored ) === 0 ) {
			$legacy = get_option( self::LEGACY_OPTION_NAME, array() );
			if ( is_array( $legacy ) && count( $legacy ) > 0 ) {
				$stored = $legacy;
			}
		}
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}
		return array_merge( self::DEFAULTS, $stored );
	}

	/**
	 * @return mixed
	 */
	public function get( string $key ) {
		$all = $this->all();
		return $all[ $key ] ?? null;
	}

	/**
	 * @param mixed $value
	 */
	public function set( string $key, $value ): bool {
		$all         = $this->all();
		$all[ $key ] = $value;
		return update_option( self::OPTION_NAME, $all );
	}

	/**
	 * @param array<string, mixed> $values
	 */
	public function set_many( array $values ): bool {
		return update_option( self::OPTION_NAME, array_merge( $this->all(), $values ) );
	}
}
