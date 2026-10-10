<?php
/**
 * Maintenance page (restart is the only implemented high-risk action).
 *
 * @package Ts3Pilot
 */

declare(strict_types=1);

namespace Ts3Pilot\Admin;

use Ts3Pilot\Agent\AgentException;
use Ts3Pilot\Agent\Client;

final class MaintenancePage {
	public function __construct( private readonly Client $client ) {}

	public function render(): void {
		echo '<div class="wrap"><h1>Maintenance</h1>';
		if ( isset( $_GET['ts3pilot_result'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$result = sanitize_text_field( wp_unslash( $_GET['ts3pilot_result'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			echo '<div class="notice notice-' . esc_attr( 'success' === $result ? 'success' : 'error' ) . '"><p>'
				. esc_html( 'success' === $result ? 'Service action completed.' : 'Service action failed.' )
				. '</p></div>';
		}
		echo '<h2>TS3 service control</h2><p>Only the configured instance is managed. Script deployments must use the same operating-system account that owns the running server; systemd deployments require the documented authorization.</p>';
		try {
			$state = $this->client->request( 'GET', '/v1/system/status' );
			echo '<p><strong>Service: </strong>' . esc_html( (string) ( $state['state'] ?? 'unknown' ) ) . ' / ' . esc_html( (string) ( $state['provider'] ?? 'unknown' ) ) . '</p>';
		} catch ( AgentException $error ) {
			echo '<div class="notice notice-warning"><p>Service status unavailable. Check the configured provider and node permissions.</p></div>';
		}
		foreach ( array(
			'start'   => 'Start server',
			'stop'    => 'Stop server',
			'restart' => 'Restart server',
		) as $verb => $label ) {
			echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" data-confirm="' . esc_attr( $verb ) . '">';
			echo '<input type="hidden" name="action" value="ts3pilot_service" /><input type="hidden" name="service_action" value="' . esc_attr( $verb ) . '" />';
			wp_nonce_field( 'ts3pilot_service', 'ts3pilot_nonce' );
			echo '<p><button class="button button-secondary" type="submit">' . esc_html( $label ) . '</button></p></form>';
		}
		echo '<p><em>Update / Backup / Restore 属于高风险操作，将在后续迭代提供并始终要求独立 capability（server.update / server.restore）。</em></p>';
		echo '</div>';
	}
}
