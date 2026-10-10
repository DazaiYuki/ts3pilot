<?php
/**
 * [ts3_status] shortcode with strict attribute whitelisting.
 *
 * All TS3-derived strings are treated as untrusted and escaped on output.
 * Data always comes from the server-side cached snapshot; the browser never
 * talks to the agent directly.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Frontend;

use Ts3Pilot\Identity\Mapping;
use Ts3Pilot\Security\Sanitizer;
use Ts3Pilot\Services\StatusService;

final class Shortcode {
	private static ?StatusService $status = null;

	public static function init( StatusService $status ): void {
		self::$status = $status;
		add_shortcode( 'ts3_status', array( self::class, 'render' ) );
		add_shortcode( 'ts3_join', array( self::class, 'render_join' ) );
	}

	/**
	 * @param array<string, mixed> $attributes
	 */
	public static function render( array $attributes = array() ): string {
		if ( null === self::$status ) {
			return '';
		}
		$theme          = self::$status->theme_name();
		$defaults       = self::$status->display_settings();
		$attributes     = shortcode_atts(
			array(
				'node'          => '',
				'show_name'     => ! empty( $defaults['show_name'] ) ? 'true' : 'false',
				'show_online'   => ! empty( $defaults['show_online'] ) ? 'true' : 'false',
				'show_max'      => ! empty( $defaults['show_max'] ) ? 'true' : 'false',
				'show_version'  => ! empty( $defaults['show_version'] ) ? 'true' : 'false',
				'show_channels' => self::$status->show_channels_enabled() ? 'true' : 'false',
				'collapsible'   => 'false',
				'theme'         => $theme,
				'join_policy'   => $defaults['join_policy'],
				'join_role'     => $defaults['join_role'],
				'join_url'      => $defaults['join_url'],
				'join_label'    => $defaults['join_label'],
				'class'         => 'ts3-status-card',
			),
			$attributes,
			'ts3_status'
		);
		$show_name      = filter_var( $attributes['show_name'], FILTER_VALIDATE_BOOLEAN );
		$show_online    = filter_var( $attributes['show_online'], FILTER_VALIDATE_BOOLEAN );
		$show_max       = filter_var( $attributes['show_max'], FILTER_VALIDATE_BOOLEAN );
		$show_version   = filter_var( $attributes['show_version'], FILTER_VALIDATE_BOOLEAN );
		$show_channels  = filter_var( $attributes['show_channels'], FILTER_VALIDATE_BOOLEAN );
		$collapsible    = filter_var( $attributes['collapsible'], FILTER_VALIDATE_BOOLEAN );
		$theme_value    = in_array( (string) $attributes['theme'], array( 'auto', 'light', 'dark' ), true ) ? (string) $attributes['theme'] : 'auto';
		$join_policy    = Sanitizer::join_policy( (string) $attributes['join_policy'] );
		$join_role      = Sanitizer::role_name( (string) $attributes['join_role'] );
		$class          = sanitize_html_class( (string) $attributes['class'] );
		$requested_node = (string) ( $attributes['node'] ?? '' );
		$node_id        = '';
		if ( '' !== $requested_node && self::$status->is_valid_node( $requested_node ) ) {
			$node_id = $requested_node;
		}

		$snapshot = self::$status->get_snapshot( false, '' === $node_id ? null : $node_id );
		if ( ! empty( $snapshot['error'] ) ) {
			return '<div class="' . esc_attr( $class ) . ' ts3-status-error" data-ts3-theme="' . esc_attr( $theme_value ) . '">'
				. esc_html__( '暂时无法获取状态', 'ts3pilot' ) . '</div>';
		}

		$html = '<div class="' . esc_attr( $class ) . '" data-ts3-state="' . esc_attr( ! empty( $snapshot['online'] ) ? 'online' : 'offline' ) . '" data-ts3-theme="' . esc_attr( $theme_value ) . '">';
		if ( $show_name ) {
			$html .= '<div class="ts3-status-name">' . esc_html( (string) ( $snapshot['name'] ?? '' ) ) . '</div>';
		}
		if ( $show_online ) {
			$html .= '<div class="ts3-status-online">' . esc_html( ! empty( $snapshot['online'] ) ? 'Online' : 'Offline' ) . '</div>';
		}
		if ( $show_max ) {
			$html .= '<div class="ts3-status-count">' . esc_html( (string) ( $snapshot['clients'] ?? 0 ) . ' / ' . (string) ( $snapshot['max_clients'] ?? 0 ) ) . '</div>';
		}
		if ( $show_version && ! empty( $snapshot['version'] ) ) {
			$html .= '<div class="ts3-status-version">' . esc_html( (string) $snapshot['version'] ) . '</div>';
		}
		if ( $show_channels ) {
			$html .= self::render_channels( $collapsible, '' === $node_id ? null : $node_id );
		}
		$html .= self::join_button( $join_policy, $join_role, (string) $attributes['join_url'], (string) $attributes['join_label'] );
		$html .= '</div>';
		return $html;
	}

	private static function render_channels( bool $collapsible, ?string $node_id ): string {
		$channels = self::$status->get_channels_snapshot( false, $node_id );
		if ( empty( $channels ) || isset( $channels['error'] ) ) {
			return '';
		}
		$by_parent = array();
		foreach ( $channels as $channel ) {
			$parent                 = (int) ( $channel['parentId'] ?? 0 );
			$by_parent[ $parent ][] = $channel;
		}
		$content = '<ul class="ts3-status-channels">' . self::render_tree( $by_parent, 0 ) . '</ul>';
		if ( $collapsible ) {
			return '<details class="ts3-status-channels-wrap"><summary>' . esc_html__( 'Channels', 'ts3pilot' ) . '</summary>' . $content . '</details>';
		}
		return $content;
	}

	/**
	 * @param array<int, array<int, array<string, mixed>>> $by_parent
	 */
	private static function render_tree( array $by_parent, int $parent_id ): string {
		$html = '';
		foreach ( $by_parent[ $parent_id ] ?? array() as $channel ) {
			$name     = (string) ( $channel['name'] ?? '' );
			$clients  = (int) ( $channel['clients'] ?? 0 );
			$id       = (int) ( $channel['channelId'] ?? 0 );
			$html    .= '<li class="ts3-status-channel"><span class="ts3-status-channel-name">' . esc_html( $name ) . '</span>'
				. '<span class="ts3-status-channel-count">' . esc_html( (string) $clients ) . '</span>';
			$children = self::render_tree( $by_parent, $id );
			if ( '' !== $children ) {
				$html .= '<ul>' . $children . '</ul>';
			}
			$html .= '</li>';
		}
		return $html;
	}

	/**
	 * @param array<string, mixed> $attributes
	 */
	public static function render_join( array $attributes = array() ): string {
		if ( null === self::$status ) {
			return '';
		}
		$settings = array_merge( self::$status->display_settings(), array_intersect_key( $attributes, array_flip( array( 'join_policy', 'join_role', 'join_url', 'join_label' ) ) ) );
		return self::join_button( Sanitizer::join_policy( (string) $settings['join_policy'] ), Sanitizer::role_name( (string) $settings['join_role'] ), (string) $settings['join_url'], (string) $settings['join_label'] );
	}

	private static function join_button( string $policy, string $join_role, string $url, string $label ): string {
		if ( 'hidden' === $policy ) {
			return '';
		}
		if ( 'public' === $policy ) {
			return self::render_join_button( $url, $label );
		}
		if ( 'logged_in' === $policy ) {
			return is_user_logged_in() ? self::render_join_button( $url, $label ) : '';
		}
		if ( 'verified_ts_user' === $policy ) {
			$user_id = get_current_user_id();
			if ( $user_id > 0 ) {
				$mapping = Mapping::get( $user_id );
				if ( 'verified' === ( $mapping['status'] ?? '' ) ) {
					return self::render_join_button( $url, $label );
				}
			}
			return '';
		}
		if ( 'role' === $policy && '' !== $join_role ) {
			$user = wp_get_current_user();
			return in_array( $join_role, (array) $user->roles, true ) ? self::render_join_button( $url, $label ) : '';
		}
		return '';
	}

	private static function render_join_button( string $url, string $label ): string {
		$url = Sanitizer::join_url( $url );
		if ( '' === $url ) {
			return '';
		}
		return '<a class="ts3-status-join" href="' . esc_url( $url, array( 'ts3server', 'https', 'http' ) ) . '" rel="nofollow noopener">' . esc_html( '' === $label ? __( '加入语音', 'ts3pilot' ) : $label ) . '</a>';
	}
}
