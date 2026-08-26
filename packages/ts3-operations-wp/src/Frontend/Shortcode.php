<?php
/**
 * [ts3_status] shortcode with strict attribute whitelisting.
 *
 * All TS3-derived strings are treated as untrusted and escaped on output.
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Frontend;

use Ts3Ops\Security\Sanitizer;
use Ts3Ops\Services\StatusService;

final class Shortcode {
	private static ?StatusService $status = null;

	public static function init( StatusService $status ): void {
		self::$status = $status;
		add_shortcode( 'ts3_status', array( self::class, 'render' ) );
	}

	/**
	 * @param array<string, mixed> $attributes
	 */
	public static function render( array $attributes = array() ): string {
		if ( null === self::$status ) {
			return '';
		}
		$attributes   = shortcode_atts(
			array(
				'show_name'    => 'true',
				'show_online'  => 'true',
				'show_max'     => 'true',
				'show_version' => 'false',
				'join_policy'  => 'hidden',
				'join_role'    => '',
				'class'        => 'ts3-status-card',
			),
			$attributes,
			'ts3_status'
		);
		$show_name    = filter_var( $attributes['show_name'], FILTER_VALIDATE_BOOLEAN );
		$show_online  = filter_var( $attributes['show_online'], FILTER_VALIDATE_BOOLEAN );
		$show_max     = filter_var( $attributes['show_max'], FILTER_VALIDATE_BOOLEAN );
		$show_version = filter_var( $attributes['show_version'], FILTER_VALIDATE_BOOLEAN );
		$join_policy  = Sanitizer::join_policy( (string) $attributes['join_policy'] );
		$join_role    = Sanitizer::role_name( (string) $attributes['join_role'] );
		$class        = sanitize_html_class( (string) $attributes['class'] );

		$snapshot = self::$status->get_snapshot();
		if ( ! empty( $snapshot['error'] ) ) {
			return '<div class="' . esc_attr( $class ) . ' ts3-status-error">' . esc_html__( '暂时无法获取状态', 'ts3-operations' ) . '</div>';
		}

		$html = '<div class="' . esc_attr( $class ) . '">';
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
		$html .= self::join_button( $join_policy, $join_role );
		$html .= '</div>';
		return $html;
	}

	private static function join_button( string $policy, string $join_role ): string {
		if ( 'hidden' === $policy ) {
			return '';
		}
		if ( 'public' === $policy ) {
			return self::render_join_button();
		}
		if ( 'logged_in' === $policy ) {
			return is_user_logged_in() ? self::render_join_button() : '';
		}
		if ( 'verified_ts_user' === $policy ) {
			$user_id = get_current_user_id();
			if ( $user_id > 0 ) {
				$mapping = \Ts3Ops\Identity\Mapping::get( $user_id );
				if ( 'verified' === ( $mapping['status'] ?? '' ) ) {
					return self::render_join_button();
				}
			}
			return '';
		}
		if ( 'role' === $policy && '' !== $join_role ) {
			return current_user_can( $join_role ) ? self::render_join_button() : '';
		}
		return '';
	}

	private static function render_join_button(): string {
		$join_url = get_option( 'ts3cops_settings', array() );
		$url      = is_array( $join_url ) ? (string) ( $join_url['join_url'] ?? '' ) : '';
		if ( '' === $url ) {
			return '';
		}
		return '<a class="ts3-status-join" href="' . esc_url( $url ) . '" rel="nofollow noopener">' . esc_html__( '加入语音', 'ts3-operations' ) . '</a>';
	}
}
