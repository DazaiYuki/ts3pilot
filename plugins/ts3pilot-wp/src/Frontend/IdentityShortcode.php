<?php
/**
 * [ts3_identity] self-service binding shortcode.
 *
 * Logged-in users start a one-time challenge and receive instructions; the
 * agent verifies the code in TeamSpeak and calls the REST callback to mark the
 * mapping verified without admin involvement.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Frontend;

use Ts3Pilot\Identity\Mapping;

final class IdentityShortcode {
	public static function init(): void {
		add_shortcode( 'ts3_identity', array( self::class, 'render' ) );
	}

	public static function render(): string {
		if ( ! is_user_logged_in() ) {
			return '<div class="ts3-identity ts3-identity-login">'
				. esc_html__( '请先登录后绑定 TeamSpeak 身份。', 'ts3pilot' )
				. '</div>';
		}
		$user_id = get_current_user_id();
		$mapping = Mapping::get( $user_id );
		$status  = (string) ( $mapping['status'] ?? 'unbound' );

		$html  = '<div class="ts3-identity" id="ts3-identity-root">';
		$html .= '<div class="ts3-identity-status">' . esc_html( '当前状态：' . $status ) . '</div>';
		if ( 'verified' === $status ) {
			$html .= '<div class="ts3-identity-uid">TS3 UID: ' . esc_html( (string) ( $mapping['ts3_uid'] ?? '' ) ) . '</div>';
		}
		$html .= '<button type="button" data-action="start" class="ts3-identity-start">'
			. esc_html__( '开始绑定', 'ts3pilot' ) . '</button>';
		$html .= '<div class="ts3-identity-instructions" hidden></div>';
		$html .= '</div>';
		return $html;
	}
}
