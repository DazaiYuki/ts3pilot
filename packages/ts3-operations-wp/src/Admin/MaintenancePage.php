<?php
/**
 * Maintenance page (restart is the only implemented high-risk action).
 *
 * @package Ts3Ops
 */

declare(strict_types=1);

namespace Ts3Ops\Admin;

use Ts3Ops\Agent\AgentException;
use Ts3Ops\Agent\Client;

final class MaintenancePage {
	public function __construct( private readonly Client $client ) {}

	public function render(): void {
		echo '<div class="wrap"><h1>Maintenance</h1>';
		if ( isset( $_GET['ts3cops_result'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$result = sanitize_text_field( wp_unslash( $_GET['ts3cops_result'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="notice notice-' . esc_attr( 'success' === $result ? 'success' : 'error' ) . '"><p>'
				. esc_html( 'success' === $result ? 'Restart requested.' : 'Restart failed.' )
				. '</p></div>';
		}
		echo '<h2>Restart TS3 server</h2>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" data-confirm="restart">';
		echo '<input type="hidden" name="action" value="ts3cops_restart" />';
		wp_nonce_field( 'ts3cops_restart', 'ts3cops_nonce' );
		echo '<button class="button button-secondary" type="submit">Restart server</button>';
		echo '</form>';
		echo '<p><em>Update / Backup / Restore 属于高风险操作，将在后续迭代提供并始终要求独立 capability（server.update / server.restore）。</em></p>';
		echo '</div>';
	}
}
