<?php
/**
 * Users / Identity page: binding state list, challenge start and status
 * transitions (capability + nonce protected).
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Identity\Mapping;

final class UsersPage {
	public function render(): void {
		echo '<div class="wrap"><h1>Users / Identity</h1>';
		$this->render_notice();
		$users = get_users(
			array(
				'number' => 200,
				'fields' => array( 'ID', 'user_login', 'display_name' ),
			)
		);
		echo '<table class="widefat striped"><thead><tr>'
			. '<th>ID</th><th>Login</th><th>Display name</th><th>TS3 UID</th><th>Status</th><th>Actions</th>'
			. '</tr></thead><tbody>';
		foreach ( $users as $user ) {
			$id      = (int) $user->ID;
			$mapping = Mapping::get( $id );
			echo '<tr>';
			echo '<td>' . esc_html( (string) $id ) . '</td>';
			echo '<td>' . esc_html( (string) $user->user_login ) . '</td>';
			echo '<td>' . esc_html( (string) $user->display_name ) . '</td>';
			echo '<td>' . esc_html( (string) ( $mapping['ts3_uid'] ?? '' ) ) . '</td>';
			echo '<td><span class="ts3pilot-status ts3pilot-status-' . esc_attr( (string) ( $mapping['status'] ?? 'unbound' ) ) . '">'
				. esc_html( (string) ( $mapping['status'] ?? 'unbound' ) ) . '</span></td>';
			$actions = $this->challenge_form( $id ) . $this->status_form( $id );
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- HTML built from escaped fragments only.
			echo '<td>' . $actions . '</td>';
			echo '</tr>';
		}
		echo '</tbody></table></div>';
	}

	private function render_notice(): void {
		if ( isset( $_GET['ts3pilot_code'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$code = sanitize_text_field( wp_unslash( $_GET['ts3pilot_code'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="notice notice-success"><p>'
				. esc_html__( '挑战码（仅显示一次，10 分钟有效）：', 'ts3pilot' )
				. ' <strong>' . esc_html( $code ) . '</strong></p></div>';
		}
		if ( isset( $_GET['ts3pilot_result'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$result = sanitize_text_field( wp_unslash( $_GET['ts3pilot_result'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="notice notice-' . esc_attr( str_starts_with( $result, 'ok' ) ? 'success' : 'error' ) . '"><p>'
				. esc_html( str_starts_with( $result, 'ok' ) ? 'Identity updated.' : 'Identity update failed.' )
				. '</p></div>';
		}
	}

	private function challenge_form( int $user_id ): string {
		$html  = '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline">';
		$html .= '<input type="hidden" name="action" value="ts3pilot_identity_challenge" />';
		$html .= '<input type="hidden" name="user_id" value="' . esc_attr( (string) $user_id ) . '" />';
		wp_nonce_field( 'ts3pilot_identity_challenge_' . $user_id, 'ts3pilot_nonce' );
		$html .= '<button class="button button-small" type="submit">Challenge</button></form> ';
		return $html;
	}

	private function status_form( int $user_id ): string {
		$html  = '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline">';
		$html .= '<input type="hidden" name="action" value="ts3pilot_identity_status" />';
		$html .= '<input type="hidden" name="user_id" value="' . esc_attr( (string) $user_id ) . '" />';
		wp_nonce_field( 'ts3pilot_identity_status_' . $user_id, 'ts3pilot_nonce' );
		$html .= '<input type="text" name="ts3_uid" placeholder="' . esc_attr__( 'TS3 UID (for verified)', 'ts3pilot' ) . '" maxlength="128" />';
		$html .= '<select name="status">';
		foreach ( array( 'unbound', 'pending', 'verified', 'revoked' ) as $status ) {
			$html .= '<option value="' . esc_attr( $status ) . '">' . esc_html( $status ) . '</option>';
		}
		$html .= '</select>';
		$html .= '<button class="button button-small" type="submit">Set status</button></form>';
		return $html;
	}
}
