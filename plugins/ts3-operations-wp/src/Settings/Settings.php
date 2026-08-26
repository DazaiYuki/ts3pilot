<?php
/**
 * Settings API registration and sanitization.
 *
 * The agent credential is stored as a plugin option (server-side only). The
 * sanitize callback keeps the existing credential when the field is left blank
 * so saving unrelated settings never wipes the secret.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Settings;

use Ts3Ops\Security\Sanitizer;

final class Settings {
	public const GROUP = 'ts3cops_settings_group';

	public static function init( Repository $repository ): void {
		add_action(
			'admin_init',
			static function () use ( $repository ): void {
				register_setting(
					self::GROUP,
					Repository::OPTION_NAME,
					array(
						'type'              => 'array',
						'sanitize_callback' => static function ( $input ) use ( $repository ): array {
							return self::sanitize( $input, $repository );
						},
					)
				);
			}
		);
	}

	/**
	 * @param mixed $input
	 * @return array<string, mixed>
	 */
	public static function sanitize( $input, Repository $repository ): array {
		$current = $repository->all();
		$input   = is_array( $input ) ? $input : array();

		$agent_url  = Sanitizer::endpoint_url( (string) ( $input['agent_url'] ?? '' ) );
		$credential = sanitize_text_field( (string) ( $input['agent_credential'] ?? '' ) );
		if ( '' === $credential ) {
			$credential = (string) $current['agent_credential'];
		}

		return array(
			'agent_url'                => $agent_url,
			'agent_credential'         => $credential,
			'agent_node_id'            => sanitize_text_field( (string) ( $input['agent_node_id'] ?? $current['agent_node_id'] ) ),
			'status_cache_ttl'         => Sanitizer::positive_int( $input['status_cache_ttl'] ?? $current['status_cache_ttl'], 10 ),
			'join_policy'              => Sanitizer::join_policy( (string) ( $input['join_policy'] ?? 'hidden' ) ),
			'join_role'                => Sanitizer::role_name( (string) ( $input['join_role'] ?? '' ) ),
			'join_url'                 => esc_url_raw( (string) ( $input['join_url'] ?? '' ) ),
			'show_name'                => Sanitizer::boolish( $input['show_name'] ?? $current['show_name'] ),
			'show_online'              => Sanitizer::boolish( $input['show_online'] ?? $current['show_online'] ),
			'show_max'                 => Sanitizer::boolish( $input['show_max'] ?? $current['show_max'] ),
			'show_version'             => Sanitizer::boolish( $input['show_version'] ?? $current['show_version'] ),
			'show_channels'            => Sanitizer::boolish( $input['show_channels'] ?? $current['show_channels'] ),
			'theme'                    => in_array( (string) ( $input['theme'] ?? 'auto' ), array( 'auto', 'light', 'dark' ), true ) ? (string) $input['theme'] : 'auto',
			'delete_data_on_uninstall' => Sanitizer::boolish( $input['delete_data_on_uninstall'] ?? false ),
		);
	}
}
