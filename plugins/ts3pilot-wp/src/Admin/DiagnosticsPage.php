<?php
/**
 * Diagnostics page: audit log + redacted configuration summary.
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Audit\AuditLog;
use Ts3Pilot\Settings\Repository;

final class DiagnosticsPage {
	public function __construct( private readonly Repository $repository ) {}

	public function render(): void {
		echo '<div class="wrap"><h1>Diagnostics</h1>';
		echo '<h2>Audit log (last 50)</h2>';
		echo '<table class="widefat striped"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Result</th><th>Error</th></tr></thead><tbody>';
		foreach ( AuditLog::latest( 50 ) as $entry ) {
			echo '<tr>';
			echo '<td>' . esc_html( gmdate( 'Y-m-d H:i:s', (int) ( $entry['time'] ?? 0 ) ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['wp_user_id'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['action'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['target'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['result'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( (string) ( $entry['error_code'] ?? '' ) ) . '</td>';
			echo '</tr>';
		}
		echo '</tbody></table>';
		$settings = $this->repository->all();
		echo '<h2>Configuration</h2>';
		echo '<p>Agent URL: ' . esc_html( (string) $settings['agent_url'] ) . '</p>';
		echo '<p>Agent node ID: ' . esc_html( (string) $settings['agent_node_id'] ) . '</p>';
		echo '<p>Credential: ' . esc_html( '' === (string) $settings['agent_credential'] ? 'not set' : 'set (redacted)' ) . '</p>';
		echo '</div>';
	}
}
