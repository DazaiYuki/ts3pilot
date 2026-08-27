<?php
/**
 * View-only audit log page (capability: manage_options).
 *
 * The log is a bounded ring buffer; sensitive values are never stored.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Audit\AuditLog;

final class AuditLogPage {
	public const LIMIT = 200;

	public function render(): void {
		$entries = AuditLog::latest( self::LIMIT );
		echo '<div class="wrap"><h1>' . esc_html__( 'TS3Pilot Audit Log', 'ts3pilot' ) . '</h1>';
		if ( count( $entries ) === 0 ) {
			echo '<p>' . esc_html__( 'No audit events recorded yet.', 'ts3pilot' ) . '</p></div>';
			return;
		}
		// translators: %d is the maximum number of audit entries shown on this page.
		echo '<p class="description">' . esc_html( sprintf( __( 'Latest %d events. Credentials and tokens are never stored here.', 'ts3pilot' ), self::LIMIT ) ) . '</p>';
		echo '<table class="widefat striped"><thead><tr>'
			. '<th>' . esc_html__( 'Time (UTC)', 'ts3pilot' ) . '</th>'
			. '<th>' . esc_html__( 'User ID', 'ts3pilot' ) . '</th>'
			. '<th>' . esc_html__( 'Action', 'ts3pilot' ) . '</th>'
			. '<th>' . esc_html__( 'Target', 'ts3pilot' ) . '</th>'
			. '<th>' . esc_html__( 'Result', 'ts3pilot' ) . '</th>'
			. '<th>' . esc_html__( 'Error code', 'ts3pilot' ) . '</th>'
			. '<th>' . esc_html__( 'Node', 'ts3pilot' ) . '</th>'
			. '</tr></thead><tbody>';
		foreach ( $entries as $entry ) {
			echo '<tr>';
			echo '<td>' . esc_html( gmdate( 'Y-m-d H:i:s', (int) ( $entry['time'] ?? 0 ) ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['wp_user_id'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['action'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['target'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['result'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['error_code'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['node_id'] ?? '' ) ) . '</td>';
			echo '</tr>';
		}
		echo '</tbody></table></div>';
	}
}
